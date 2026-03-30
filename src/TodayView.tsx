import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, Dispatch, SetStateAction } from "react";
import type { CoursePpqMap } from "./coursePpq";
import { PpqStopwatch, type PpqStopwatchHandle } from "./PpqStopwatch";
import { newAttemptId, type PpqData } from "./ppqStorage";
import { getQuestionsForCourse } from "./triposTopicMap";
import type { CourseWithTerm, TopicData, TriposQuestion } from "./types";
import { formatDuration, formatQuestionKeyForDisplay, stableQuestionKey } from "./ppqUtils";
import {
  datesFromHeatmapRangeIso,
  dayIntensity,
  isoDayKey,
  mondayOfWeek,
  newDailyEntryId,
  parseDayKey,
  startOfDay,
  type DailyEntry,
  type DailyLogByDay,
  type HeatmapRangeIso,
} from "./dailyLog";

const MS_DAY = 86400000;
const THEORY_BUMP = 5;
const PPQ_COURSE_BUMP = 5;

const HEAT_BG = ["#0f172a", "#14532d", "#166534", "#22c55e", "#4ade80"];

/** Fixed square cells; grid width stays natural (not stretched full-bleed). */
const HEAT_CELL_PX = 12;
const HEAT_GAP_PX = 4;

/** Inclusive revision window. Weeks are padded to full Mon–Sun columns. */
type HeatCell = { date: Date; key: string; inRange: boolean };

function formatHeatmapDay(d: Date): string {
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function buildWeekColumnsForRange(rangeStart: Date, rangeEnd: Date): HeatCell[][] {
  const rangeT0 = rangeStart.getTime();
  const rangeT1 = rangeEnd.getTime();
  const firstMonday = mondayOfWeek(rangeStart);
  const lastMonday = mondayOfWeek(rangeEnd);
  const weeks: HeatCell[][] = [];
  for (let w = 0; ; w++) {
    const mon = new Date(firstMonday);
    mon.setDate(firstMonday.getDate() + w * 7);
    if (mon.getTime() > lastMonday.getTime()) break;
    const col: HeatCell[] = [];
    for (let r = 0; r < 7; r++) {
      const d = new Date(mon);
      d.setDate(mon.getDate() + r);
      const t = d.getTime();
      const inRange = t >= rangeT0 && t <= rangeT1;
      col.push({ date: d, key: isoDayKey(d), inRange });
    }
    weeks.push(col);
  }
  return weeks;
}

function sortQuestions(qs: TriposQuestion[]): TriposQuestion[] {
  return [...qs].sort((a, b) => Number(b.year) - Number(a.year) || Number(a.paper) - Number(b.paper) || Number(a.question) - Number(b.question));
}

const WEEKDAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export interface TodayViewProps {
  /** Full list — used to resolve course names on past log lines. */
  allCourses: CourseWithTerm[];
  /** Courses checked in Topics → “Courses” dropdown (overview selection only). */
  visibleCourses: CourseWithTerm[];
  dailyLog: DailyLogByDay;
  setDailyLog: Dispatch<SetStateAction<DailyLogByDay>>;
  setTopicData: Dispatch<SetStateAction<Record<string, TopicData>>>;
  setCoursePpq: Dispatch<SetStateAction<CoursePpqMap>>;
  setPpqData: Dispatch<SetStateAction<PpqData>>;
  triposQuestions: TriposQuestion[] | null;
  triposLoading: boolean;
  triposError: string | null;
  onRetryTripos: () => void;
  heatmapRange: HeatmapRangeIso;
  setHeatmapRange: Dispatch<SetStateAction<HeatmapRangeIso>>;
}

export default function TodayView({
  allCourses,
  visibleCourses,
  dailyLog,
  setDailyLog,
  setTopicData,
  setCoursePpq,
  setPpqData,
  triposQuestions,
  triposLoading,
  triposError,
  onRetryTripos,
  heatmapRange,
  setHeatmapRange,
}: TodayViewProps) {
  const [anchorToday] = useState(() => startOfDay(new Date()));
  const todayKey = isoDayKey(anchorToday);
  const [selectedDayKey, setSelectedDayKey] = useState(todayKey);

  const { start: heatmapRangeStart, end: heatmapRangeEnd } = useMemo(
    () => datesFromHeatmapRangeIso(heatmapRange),
    [heatmapRange],
  );

  /** Rigid block types + optional note-only. */
  const [blockMode, setBlockMode] = useState<"theory" | "question" | "note">("theory");

  const [theoryCourseId, setTheoryCourseId] = useState("");
  const [theoryPicked, setTheoryPicked] = useState<Set<number>>(new Set());
  const [theoryNotes, setTheoryNotes] = useState("");

  const [qCourseId, setQCourseId] = useState("");
  const [qKey, setQKey] = useState("");
  const [qTopicPicked, setQTopicPicked] = useState<Set<number>>(new Set());
  const [syncPpqBank, setSyncPpqBank] = useState(true);
  const [bumpCoursePpq, setBumpCoursePpq] = useState(true);
  const ppqSwRef = useRef<PpqStopwatchHandle>(null);

  const [noteDraft, setNoteDraft] = useState("");

  const selectedDate = useMemo(() => parseDayKey(selectedDayKey), [selectedDayKey]);
  const isFuture = selectedDate != null && selectedDate.getTime() > anchorToday.getTime();

  const weeks = useMemo(
    () => buildWeekColumnsForRange(heatmapRangeStart, heatmapRangeEnd),
    [heatmapRangeStart, heatmapRangeEnd],
  );
  const entriesForDay = dailyLog[selectedDayKey]?.entries ?? [];

  useEffect(() => {
    setSelectedDayKey((prev) => {
      const t = parseDayKey(prev);
      if (!t) return prev;
      const t0 = heatmapRangeStart.getTime();
      const t1 = heatmapRangeEnd.getTime();
      const st = t.getTime();
      if (st >= t0 && st <= t1) return prev;
      const todayT = anchorToday.getTime();
      if (todayT >= t0 && todayT <= t1) return isoDayKey(anchorToday);
      if (todayT > t1) return isoDayKey(heatmapRangeEnd);
      return isoDayKey(heatmapRangeStart);
    });
  }, [heatmapRangeStart, heatmapRangeEnd, anchorToday]);

  const coursesWithPpq = useMemo(() => {
    const qs = triposQuestions ?? [];
    return visibleCourses.filter((c) => getQuestionsForCourse(c.id, qs).length > 0);
  }, [visibleCourses, triposQuestions]);

  const theoryCourse = theoryCourseId ? visibleCourses.find((c) => c.id === theoryCourseId) : undefined;
  const theoryTopics = theoryCourse?.topics ?? [];

  const qCourse = qCourseId ? visibleCourses.find((c) => c.id === qCourseId) : undefined;
  const questionsForCourse = useMemo(() => {
    if (!qCourseId || !triposQuestions?.length) return [] as TriposQuestion[];
    return sortQuestions(getQuestionsForCourse(qCourseId, triposQuestions));
  }, [qCourseId, triposQuestions]);

  useEffect(() => {
    if (!questionsForCourse.length) {
      setQKey("");
      return;
    }
    const valid = questionsForCourse.some((q) => stableQuestionKey(q) === qKey);
    if (!valid) setQKey(stableQuestionKey(questionsForCourse[0]));
  }, [questionsForCourse, qKey]);

  const appendEntry = (entry: DailyEntry) => {
    setDailyLog((prev) => ({
      ...prev,
      [selectedDayKey]: {
        entries: [...(prev[selectedDayKey]?.entries ?? []), entry],
      },
    }));
  };

  const addTheoryBlock = () => {
    if (isFuture || !theoryCourseId || theoryPicked.size === 0) return;
    const indices = [...theoryPicked].sort((a, b) => a - b);
    const text = theoryNotes.trim() || `Revised theory: ${indices.length} topic(s)`;

    appendEntry({
      id: newDailyEntryId(),
      at: new Date().toISOString(),
      kind: "topic",
      text,
      courseId: theoryCourseId,
      topicIndices: indices,
      theoryDelta: THEORY_BUMP,
    });

    setTopicData((prev) => {
      const next = { ...prev };
      for (const idx of indices) {
        const tKey = `${theoryCourseId}_${idx}`;
        const cur = next[tKey] ?? { theory: 0 };
        next[tKey] = { ...cur, theory: Math.min(100, cur.theory + THEORY_BUMP) };
      }
      return next;
    });

    setTheoryNotes("");
    setTheoryPicked(new Set());
  };

  const addQuestionBlock = () => {
    if (isFuture || !qCourseId || !qKey) return;

    const snap = ppqSwRef.current?.getSnapshot() ?? { durationSec: null as number | null, notes: "", marks: "", openBook: false };
    const topicIndices = [...qTopicPicked].sort((a, b) => a - b);
    const text = snap.notes.trim() || `Attempt: ${formatQuestionKeyForDisplay(qKey)}`;

    appendEntry({
      id: newDailyEntryId(),
      at: new Date().toISOString(),
      kind: "question",
      text,
      courseId: qCourseId,
      ppqQuestionKey: qKey,
      topicIndices: topicIndices.length ? topicIndices : undefined,
      ppqMarks: snap.marks.trim() || undefined,
      ppqDurationSec: snap.durationSec,
      ppqOpenBook: snap.openBook || undefined,
      theoryDelta: topicIndices.length ? THEORY_BUMP : undefined,
      ppqDelta: bumpCoursePpq ? PPQ_COURSE_BUMP : undefined,
    });

    if (topicIndices.length) {
      setTopicData((prev) => {
        const next = { ...prev };
        for (const idx of topicIndices) {
          const tKey = `${qCourseId}_${idx}`;
          const cur = next[tKey] ?? { theory: 0 };
          next[tKey] = { ...cur, theory: Math.min(100, cur.theory + THEORY_BUMP) };
        }
        return next;
      });
    }

    if (bumpCoursePpq) {
      setCoursePpq((prev) => ({
        ...prev,
        [qCourseId]: Math.min(100, (prev[qCourseId] ?? 0) + PPQ_COURSE_BUMP),
      }));
    }

    if (syncPpqBank) {
      setPpqData((prev) => ({
        ...prev,
        questions: {
          ...prev.questions,
          [qKey]: {
            attempts: [
              ...(prev.questions[qKey]?.attempts ?? []),
              {
                id: newAttemptId(),
                at: new Date().toISOString(),
                durationSec: snap.durationSec,
                notes: snap.notes,
                marks: snap.marks,
                openBook: snap.openBook || undefined,
              },
            ],
          },
        },
      }));
    }

    ppqSwRef.current?.reset();
    setQTopicPicked(new Set());
  };

  const addNoteOnly = () => {
    const text = noteDraft.trim();
    if (!text || isFuture) return;
    appendEntry({
      id: newDailyEntryId(),
      at: new Date().toISOString(),
      kind: "note",
      text,
    });
    setNoteDraft("");
  };

  const removeEntry = (id: string) => {
    setDailyLog((prev) => {
      const list = prev[selectedDayKey]?.entries ?? [];
      const next = list.filter((e) => e.id !== id);
      const copy = { ...prev };
      if (next.length === 0) delete copy[selectedDayKey];
      else copy[selectedDayKey] = { entries: next };
      return copy;
    });
  };

  const shiftSelectedDay = (deltaDays: number) => {
    const base = parseDayKey(selectedDayKey) ?? anchorToday;
    const d = new Date(base.getTime() + deltaDays * MS_DAY);
    setSelectedDayKey(isoDayKey(d));
  };

  const toggleTheoryTopic = (i: number) => {
    setTheoryPicked((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };

  const toggleQTopic = (i: number) => {
    setQTopicPicked((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto" }}>
      <p style={{ fontSize: 11, color: "#64748b", margin: "0 0 16px", lineHeight: 1.55 }}>
        Add <strong style={{ color: "#94a3b8" }}>structured blocks</strong> for this day: either a <strong style={{ color: "#818cf8" }}>theory revision</strong> (pick topics → bumps
        theory on the Topics tab) or a <strong style={{ color: "#f472b6" }}>PPQ question attempt</strong> (pick a question → optional PPQ bank entry + course PPQ on Topics). No LLM — just
        selectors.
      </p>

      <div
        style={{
          background: "#0f172a",
          border: "1px solid #1e293b",
          borderRadius: 8,
          padding: "12px 14px",
          marginBottom: 16,
          overflowX: "auto",
        }}
      >
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: "10px 14px",
            marginBottom: 10,
            rowGap: 8,
          }}
        >
          <div style={{ fontSize: 9, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.6 }}>
            Heatmap · {formatHeatmapDay(heatmapRangeStart)} – {formatHeatmapDay(heatmapRangeEnd)} · {weeks.length} week{weeks.length === 1 ? "" : "s"}
          </div>
          <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 10, color: "#94a3b8" }}>
            <span style={{ color: "#64748b" }}>Start</span>
            <input
              type="date"
              value={heatmapRange.start}
              onChange={(e) => {
                const v = e.target.value;
                if (!v) return;
                const parsed = parseDayKey(v);
                if (!parsed) return;
                setHeatmapRange((prev) => {
                  const endD = parseDayKey(prev.end);
                  const startIso = isoDayKey(parsed);
                  if (!endD) return { ...prev, start: startIso };
                  if (parsed.getTime() > endD.getTime()) return { start: startIso, end: startIso };
                  return { ...prev, start: startIso };
                });
              }}
              style={{
                fontSize: 11,
                color: "#e2e8f0",
                background: "#020617",
                border: "1px solid #334155",
                borderRadius: 4,
                padding: "4px 6px",
              }}
            />
          </label>
          <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 10, color: "#94a3b8" }}>
            <span style={{ color: "#64748b" }}>End</span>
            <input
              type="date"
              value={heatmapRange.end}
              onChange={(e) => {
                const v = e.target.value;
                if (!v) return;
                const parsed = parseDayKey(v);
                if (!parsed) return;
                setHeatmapRange((prev) => {
                  const startD = parseDayKey(prev.start);
                  const endIso = isoDayKey(parsed);
                  if (!startD) return { ...prev, end: endIso };
                  if (parsed.getTime() < startD.getTime()) return { start: endIso, end: endIso };
                  return { ...prev, end: endIso };
                });
              }}
              style={{
                fontSize: 11,
                color: "#e2e8f0",
                background: "#020617",
                border: "1px solid #334155",
                borderRadius: 4,
                padding: "4px 6px",
              }}
            />
          </label>
        </div>
        <div style={{ paddingBottom: 4 }}>
          <div
            style={{
              display: "grid",
              width: "fit-content",
              maxWidth: "100%",
              gridTemplateColumns: `minmax(26px, auto) repeat(${weeks.length}, ${HEAT_CELL_PX}px)`,
              gridTemplateRows: `repeat(7, ${HEAT_CELL_PX}px)`,
              gap: HEAT_GAP_PX,
              alignItems: "stretch",
              justifyItems: "stretch",
            }}
          >
            {WEEKDAY_SHORT.map((d, ri) => (
              <Fragment key={d}>
                <div
                  style={{
                    fontSize: 8,
                    color: "#475569",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "flex-end",
                    paddingRight: 2,
                    lineHeight: 1,
                    minHeight: HEAT_CELL_PX,
                  }}
                >
                  {d}
                </div>
                {weeks.map((col, wi) => {
                  const { date, key, inRange } = col[ri];
                  const inten = dayIntensity(key, dailyLog);
                  const isSel = key === selectedDayKey;
                  const fut = date.getTime() > anchorToday.getTime();
                  const dead = fut || !inRange;
                  return (
                    <button
                      key={key}
                      type="button"
                      title={
                        dead
                          ? !inRange
                            ? `${key} · outside revision window`
                            : `${key} · future`
                          : `${key} · ${dailyLog[key]?.entries?.length ?? 0} block(s)`
                      }
                      onClick={() => !dead && setSelectedDayKey(key)}
                      disabled={dead}
                      style={{
                        width: HEAT_CELL_PX,
                        height: HEAT_CELL_PX,
                        minWidth: HEAT_CELL_PX,
                        minHeight: HEAT_CELL_PX,
                        padding: 0,
                        borderRadius: 2,
                        border: isSel ? "1px solid #93c5fd" : "1px solid #1e293b",
                        background: dead ? "#020617" : HEAT_BG[inten],
                        opacity: dead ? 0.22 : 1,
                        cursor: dead ? "default" : "pointer",
                        boxSizing: "border-box",
                      }}
                    />
                  );
                })}
              </Fragment>
            ))}
          </div>
        </div>
        <div style={{ display: "flex", gap: 12, marginTop: 10, flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ fontSize: 8, color: "#475569" }}>Less</span>
          {HEAT_BG.map((c, i) => (
            <span key={i} style={{ width: HEAT_CELL_PX, height: HEAT_CELL_PX, borderRadius: 2, background: c, border: "1px solid #1e293b" }} />
          ))}
          <span style={{ fontSize: 8, color: "#475569" }}>More</span>
        </div>
      </div>

      <div
        style={{
          background: "#0f172a",
          border: "1px solid #1e293b",
          borderRadius: 8,
          padding: "14px 16px",
        }}
      >
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10, marginBottom: 14 }}>
          <button type="button" onClick={() => shiftSelectedDay(-1)} style={navBtn}>
            ← Prev day
          </button>
          <button type="button" onClick={() => setSelectedDayKey(todayKey)} style={navBtn}>
            Today
          </button>
          <button type="button" onClick={() => shiftSelectedDay(1)} style={navBtn} disabled={selectedDayKey >= todayKey}>
            Next day →
          </button>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#e2e8f0", marginLeft: 4 }}>{selectedDayKey}</span>
          {isFuture && <span style={{ fontSize: 10, color: "#f87171" }}>Future day — logging disabled</span>}
        </div>

        <div style={{ fontSize: 10, color: "#64748b", marginBottom: 8 }}>Blocks for this day</div>
        <ul style={{ listStyle: "none", margin: "0 0 18px", padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
          {entriesForDay.length === 0 && <li style={{ fontSize: 11, color: "#475569" }}>Nothing yet — add a block below.</li>}
          {entriesForDay.map((e) => (
            <EntryCard key={e.id} e={e} allCourses={allCourses} onRemove={() => removeEntry(e.id)} />
          ))}
        </ul>

        <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
          {(
            [
              { id: "theory" as const, label: "Theory revision", sub: "Topics tab · per topic +5%" },
              { id: "question" as const, label: "PPQ attempt", sub: "Question + PPQ bank / course PPQ" },
              { id: "note" as const, label: "Note only", sub: "No sync to other tabs" },
            ] as const
          ).map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setBlockMode(m.id)}
              style={{
                ...modeBtn,
                border: blockMode === m.id ? "1px solid #818cf8" : "1px solid #334155",
                background: blockMode === m.id ? "#1e1b4b" : "#020617",
                color: blockMode === m.id ? "#e2e8f0" : "#94a3b8",
              }}
            >
              <span style={{ fontWeight: 700, display: "block" }}>{m.label}</span>
              <span style={{ fontSize: 8, color: "#64748b" }}>{m.sub}</span>
            </button>
          ))}
        </div>

        {visibleCourses.length === 0 && (
          <p style={{ fontSize: 11, color: "#94a3b8", marginBottom: 12 }}>
            No courses in your overview — open <strong style={{ color: "#cbd5e1" }}>Topics &amp; theory</strong> and use the <strong style={{ color: "#cbd5e1" }}>Courses</strong> dropdown to show
            courses here.
          </p>
        )}

        {blockMode === "theory" && (
          <div style={panelStyle}>
            <div style={{ fontSize: 10, color: "#818cf8", fontWeight: 700, marginBottom: 10 }}>Revised theory — pick a course, tick one or more topics, then add.</div>
            <label style={labelCol}>
              <span>Course</span>
              <select
                value={theoryCourseId}
                onChange={(e) => {
                  setTheoryCourseId(e.target.value);
                  setTheoryPicked(new Set());
                }}
                disabled={isFuture}
                style={selectStyle}
              >
                <option value="">Choose course…</option>
                {visibleCourses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            {theoryCourse && theoryTopics.length > 0 && (
              <div style={{ marginTop: 10 }}>
                <div style={{ fontSize: 9, color: "#64748b", marginBottom: 6 }}>Topics revised (each gets +{THEORY_BUMP}% theory on Topics tab)</div>
                <div
                  style={{
                    maxHeight: 220,
                    overflowY: "auto",
                    border: "1px solid #334155",
                    borderRadius: 6,
                    padding: 8,
                    background: "#020617",
                    display: "flex",
                    flexDirection: "column",
                    gap: 6,
                  }}
                >
                  {theoryTopics.map((t, i) => (
                    <label
                      key={i}
                      style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 10, color: "#cbd5e1", cursor: isFuture ? "default" : "pointer" }}
                    >
                      <input
                        type="checkbox"
                        checked={theoryPicked.has(i)}
                        onChange={() => toggleTheoryTopic(i)}
                        disabled={isFuture}
                        style={{ marginTop: 2 }}
                      />
                      <span>{t}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
            <label style={{ ...labelCol, marginTop: 10 }}>
              <span>Notes (optional)</span>
              <textarea
                value={theoryNotes}
                onChange={(e) => setTheoryNotes(e.target.value)}
                rows={2}
                disabled={isFuture}
                placeholder="What you covered…"
                style={{ ...textareaStyle, minHeight: 56 }}
              />
            </label>
            <button
              type="button"
              onClick={addTheoryBlock}
              disabled={isFuture || !theoryCourseId || theoryPicked.size === 0}
              style={addBtn}
            >
              Add theory block · +{THEORY_BUMP}% per selected topic
            </button>
          </div>
        )}

        {blockMode === "question" && (
          <div style={panelStyle}>
            <div style={{ fontSize: 10, color: "#f472b6", fontWeight: 700, marginBottom: 10 }}>PPQ question attempt — pick course, then question.</div>
            {triposLoading && <div style={{ fontSize: 11, color: "#64748b" }}>Loading question list…</div>}
            {triposError && (
              <div style={{ fontSize: 11, color: "#f87171", marginBottom: 8 }}>
                {triposError}
                <button type="button" onClick={onRetryTripos} style={{ ...navBtn, marginLeft: 8 }}>
                  Retry
                </button>
              </div>
            )}
            {!triposLoading && !triposError && triposQuestions && coursesWithPpq.length === 0 && (
              <p style={{ fontSize: 11, color: "#64748b" }}>
                No courses map to Tripos questions yet — add topic names in <code style={{ color: "#94a3b8" }}>src/triposTopicMap.ts</code>.
              </p>
            )}
            {!triposLoading && !triposError && coursesWithPpq.length > 0 && (
              <>
                <label style={labelCol}>
                  <span>Course (with PPQ data)</span>
                  <select
                    value={qCourseId}
                    onChange={(e) => {
                      const id = e.target.value;
                      setQCourseId(id);
                      setQTopicPicked(new Set());
                      const qs = id ? sortQuestions(getQuestionsForCourse(id, triposQuestions ?? [])) : [];
                      setQKey(qs[0] ? stableQuestionKey(qs[0]) : "");
                    }}
                    disabled={isFuture}
                    style={selectStyle}
                  >
                    <option value="">Choose…</option>
                    {coursesWithPpq.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
                {qCourse && questionsForCourse.length > 0 && (
                  <label style={{ ...labelCol, marginTop: 10 }}>
                    <span>Question</span>
                    <select value={qKey} onChange={(e) => setQKey(e.target.value)} disabled={isFuture} style={{ ...selectStyle, maxWidth: "100%" }}>
                      {questionsForCourse.map((q) => {
                        const k = stableQuestionKey(q);
                        return (
                          <option key={k} value={k}>
                            {q.year} · paper {q.paper} · Q{q.question} — {q.topic.length > 40 ? `${q.topic.slice(0, 40)}…` : q.topic}
                          </option>
                        );
                      })}
                    </select>
                  </label>
                )}
                {qCourse && qCourse.topics.length > 0 && (
                  <div style={{ marginTop: 10 }}>
                    <div style={{ fontSize: 9, color: "#64748b", marginBottom: 6 }}>
                      Topics covered with this attempt (optional — each selected topic gets +{THEORY_BUMP}% theory on the Topics tab)
                    </div>
                    <div
                      style={{
                        maxHeight: 180,
                        overflowY: "auto",
                        border: "1px solid #334155",
                        borderRadius: 6,
                        padding: 8,
                        background: "#020617",
                        display: "flex",
                        flexDirection: "column",
                        gap: 6,
                      }}
                    >
                      {qCourse.topics.map((t, i) => (
                        <label
                          key={i}
                          style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 10, color: "#cbd5e1", cursor: isFuture ? "default" : "pointer" }}
                        >
                          <input
                            type="checkbox"
                            checked={qTopicPicked.has(i)}
                            onChange={() => toggleQTopic(i)}
                            disabled={isFuture}
                            style={{ marginTop: 2 }}
                          />
                          <span>{t}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
                <div style={{ marginTop: 10 }}>
                  <div style={{ fontSize: 9, color: "#64748b", marginBottom: 4 }}>Timer, marks, notes — same fields as the PPQ bank tab</div>
                  <PpqStopwatch ref={ppqSwRef} disabled={isFuture} />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10, marginBottom: 12 }}>
                  <label style={chkLabel}>
                    <input type="checkbox" checked={syncPpqBank} onChange={(e) => setSyncPpqBank(e.target.checked)} disabled={isFuture} />
                    Record attempt in <strong style={{ color: "#e2e8f0" }}>PPQ bank</strong> tab (same as logging there)
                  </label>
                  <label style={chkLabel}>
                    <input type="checkbox" checked={bumpCoursePpq} onChange={(e) => setBumpCoursePpq(e.target.checked)} disabled={isFuture} />
                    +{PPQ_COURSE_BUMP}% <strong style={{ color: "#e2e8f0" }}>course PPQ</strong> on Topics tab
                  </label>
                </div>
                <button
                  type="button"
                  onClick={addQuestionBlock}
                  disabled={isFuture || !qCourseId || !qKey}
                  style={{ ...addBtn, background: "#831843", borderColor: "#f472b6", color: "#fce7f3" }}
                >
                  Add PPQ attempt block
                </button>
              </>
            )}
          </div>
        )}

        {blockMode === "note" && (
          <div style={panelStyle}>
            <div style={{ fontSize: 10, color: "#94a3b8", marginBottom: 8 }}>Free text only — does not change Topics or PPQ data.</div>
            <textarea
              value={noteDraft}
              onChange={(e) => setNoteDraft(e.target.value)}
              rows={3}
              disabled={isFuture}
              placeholder="Anything…"
              style={{ ...textareaStyle, marginBottom: 10 }}
            />
            <button type="button" onClick={addNoteOnly} disabled={isFuture || !noteDraft.trim()} style={addBtn}>
              Add note
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function EntryCard({
  e,
  allCourses,
  onRemove,
}: {
  e: DailyEntry;
  allCourses: CourseWithTerm[];
  onRemove: () => void;
}) {
  const course = e.courseId ? allCourses.find((c) => c.id === e.courseId) : undefined;

  const badge =
    e.kind === "question" ? { t: "PPQ", c: "#f472b6", bg: "#3b0a1a" } : e.kind === "topic" ? { t: "Theory", c: "#818cf8", bg: "#1e1b4b" } : { t: "Note", c: "#94a3b8", bg: "#1e293b" };

  return (
    <li
      style={{
        fontSize: 11,
        padding: "10px 12px",
        background: "#020617",
        borderRadius: 8,
        border: "1px solid #1e293b",
        color: "#cbd5e1",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <span style={{ fontSize: 8, fontWeight: 800, color: badge.c, background: badge.bg, padding: "2px 6px", borderRadius: 4, marginRight: 8 }}>{badge.t}</span>
          {e.kind === "question" && e.ppqQuestionKey && (
            <div style={{ marginTop: 6, fontSize: 10, color: "#f472b6", fontWeight: 600 }}>{formatQuestionKeyForDisplay(e.ppqQuestionKey)}</div>
          )}
          {e.kind === "question" && e.courseId && (
            <div style={{ marginTop: 6, fontSize: 10, color: "#e2e8f0" }}>
              {course?.name ?? e.courseId}
              {course && e.topicIndices?.length ? (
                <span style={{ color: "#94a3b8" }}>
                  {" "}
                  · topics:{" "}
                  {e.topicIndices.map((i) => (course.topics[i] ? course.topics[i].slice(0, 48) : `#${i}`)).join("; ")}
                </span>
              ) : null}
              {e.theoryDelta && e.topicIndices?.length ? (
                <span style={{ color: "#a5b4fc" }}> · +{e.theoryDelta}% theory each (Topics tab)</span>
              ) : null}
            </div>
          )}
          {e.kind === "question" && (e.ppqDurationSec != null && e.ppqDurationSec > 0 || e.ppqMarks?.trim() || e.ppqOpenBook) ? (
            <div style={{ marginTop: 6, fontSize: 10, color: "#f9a8d4", display: "flex", flexWrap: "wrap", gap: 10 }}>
              {e.ppqDurationSec != null && e.ppqDurationSec > 0 ? <span>Time: {formatDuration(e.ppqDurationSec)}</span> : null}
              {e.ppqMarks?.trim() ? <span>Marks: {e.ppqMarks.trim()}</span> : null}
              {e.ppqOpenBook ? <span style={{ color: "#a78bfa" }}>Open book</span> : null}
            </div>
          ) : null}
          {e.kind === "topic" && course && (
            <div style={{ marginTop: 6, fontSize: 10, color: "#818cf8" }}>
              {course.name}
              {e.topicIndices?.length ? (
                <span style={{ color: "#94a3b8" }}>
                  {" "}
                  · topics:{" "}
                  {e.topicIndices.map((i) => (course.topics[i] ? course.topics[i].slice(0, 48) : `#${i}`)).join("; ")}
                </span>
              ) : e.topicIdx != null ? (
                <span style={{ color: "#94a3b8" }}> · topic {e.topicIdx + 1}</span>
              ) : null}
              {e.theoryDelta ? <span style={{ color: "#a5b4fc" }}> · +{e.theoryDelta}% theory each</span> : null}
            </div>
          )}
          {e.text ? <div style={{ marginTop: 8, whiteSpace: "pre-wrap" }}>{e.text}</div> : null}
          {e.kind === "question" && e.ppqDelta ? (
            <div style={{ marginTop: 6, fontSize: 9, color: "#a78bfa" }}>Also: +{e.ppqDelta}% course PPQ (Topics tab)</div>
          ) : null}
          {e.kind === "note" && (e.courseId || e.theoryDelta || e.ppqDelta) ? (
            <div style={{ marginTop: 6, fontSize: 9, color: "#a78bfa" }}>
              {e.courseId && (
                <span>
                  Legacy link: {allCourses.find((c) => c.id === e.courseId)?.name ?? e.courseId}
                  {e.topicIdx != null && e.theoryDelta ? ` · topic ${e.topicIdx + 1}` : ""}
                  {e.theoryDelta ? ` · +${e.theoryDelta}% theory` : ""}
                  {e.ppqDelta ? ` · +${e.ppqDelta}% PPQ (course)` : ""}
                </span>
              )}
            </div>
          ) : null}
        </div>
        <button type="button" onClick={onRemove} style={removeBtn}>
          Remove
        </button>
      </div>
    </li>
  );
}

const modeBtn: CSSProperties = {
  fontSize: 10,
  padding: "8px 12px",
  borderRadius: 6,
  cursor: "pointer",
  textAlign: "left",
  minWidth: 140,
};

const panelStyle: CSSProperties = {
  border: "1px solid #334155",
  borderRadius: 8,
  padding: 14,
  background: "#020617",
  marginBottom: 8,
};

const navBtn: CSSProperties = {
  fontSize: 10,
  padding: "5px 10px",
  background: "#1e293b",
  border: "1px solid #334155",
  color: "#94a3b8",
  borderRadius: 5,
  cursor: "pointer",
};

const removeBtn: CSSProperties = {
  fontSize: 9,
  background: "none",
  border: "none",
  color: "#64748b",
  cursor: "pointer",
  flexShrink: 0,
};

const addBtn: CSSProperties = {
  fontSize: 11,
  padding: "8px 16px",
  background: "#3730a3",
  border: "1px solid #6366f1",
  color: "#e0e7ff",
  borderRadius: 6,
  cursor: "pointer",
  fontWeight: 600,
  marginTop: 12,
};

const labelCol: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 4,
  fontSize: 9,
  color: "#64748b",
};

const selectStyle: CSSProperties = {
  fontSize: 11,
  padding: "6px 8px",
  background: "#020617",
  border: "1px solid #334155",
  borderRadius: 5,
  color: "#e2e8f0",
  outline: "none",
};

const textareaStyle: CSSProperties = {
  width: "100%",
  resize: "vertical",
  fontSize: 11,
  lineHeight: 1.45,
  padding: "8px 10px",
  background: "#0f172a",
  border: "1px solid #334155",
  borderRadius: 6,
  color: "#e2e8f0",
  outline: "none",
  fontFamily: "inherit",
};

const chkLabel: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: 8,
  fontSize: 10,
  color: "#94a3b8",
  cursor: "pointer",
};
