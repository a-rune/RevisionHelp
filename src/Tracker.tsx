import { useCallback, useEffect, useRef, useState } from "react";
import type { TopicData, TriposQuestion } from "./types";
import type { PpqData } from "./ppqStorage";
import PpqBankView from "./PpqBankView";
import TodayView from "./TodayView";
import { emptyPpqData, ppqDataFromParsed } from "./ppqStorage";
import { TRIPOS_QUESTIONS_URL } from "./ppqUtils";
import {
  currentStreak,
  dailyLogFromParsed,
  daysWithLogsCount,
  defaultHeatmapYearBoundsIso,
  emptyDailyLog,
  parseHeatmapRangeIso,
} from "./dailyLog";
import type { DailyLogByDay, HeatmapRangeIso } from "./dailyLog";
import ExportDataView from "./ExportDataView";
import { emptyCoursePpq, migratePerTopicPpqToCourse, normalizeTopicData, parseCoursePpqFromBlob } from "./coursePpq";
import type { CoursePpqMap } from "./coursePpq";
import { ALL_COURSES_ORDERED, VALID_COURSE_IDS } from "./courses/catalog";
import { loadStoredRevisionData, persistRevisionData } from "./revisionStorage";
import { CourseCard } from "./tracker/CourseCard";

export default function RevisionTracker() {
  const [topicData, setTopicData] = useState<Record<string, TopicData>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [search, setSearch] = useState("");
  const [hiddenCourseIds, setHiddenCourseIds] = useState<Set<string>>(() => new Set());
  const [filterType, setFilterType] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [loaded, setLoaded] = useState(false);
  const [coursePickerOpen, setCoursePickerOpen] = useState(false);
  const [pickerSearch, setPickerSearch] = useState("");
  const pickerWrapRef = useRef<HTMLDivElement | null>(null);
  const [mainView, setMainView] = useState<"topics" | "ppq" | "today" | "data">("topics");
  const [dailyLog, setDailyLog] = useState<DailyLogByDay>(() => emptyDailyLog());
  const [heatmapRange, setHeatmapRange] = useState<HeatmapRangeIso>(() => defaultHeatmapYearBoundsIso());
  const [coursePpq, setCoursePpq] = useState<CoursePpqMap>(() => emptyCoursePpq());
  const [ppqData, setPpqData] = useState<PpqData>(() => emptyPpqData());
  const [triposQuestions, setTriposQuestions] = useState<TriposQuestion[] | null>(null);
  const [triposError, setTriposError] = useState<string | null>(null);
  const [triposLoading, setTriposLoading] = useState(false);
  const [triposRetry, setTriposRetry] = useState(0);

  useEffect(() => {
    (async () => {
      const parsed = await loadStoredRevisionData();
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        const p = parsed as Record<string, unknown>;
        let rawTopics: Record<string, TopicData & { ppq?: number }> = {};
        if (p.topics != null && typeof p.topics === "object" && !Array.isArray(p.topics)) {
          rawTopics = p.topics as Record<string, TopicData & { ppq?: number }>;
        } else {
          for (const [k, v] of Object.entries(parsed)) {
            if (k === "hiddenIds" || k === "ppqData" || k === "dailyLog" || k === "topics" || k === "coursePpq") continue;
            if (v && typeof v === "object" && !Array.isArray(v) && "theory" in v) {
              rawTopics[k] = v as TopicData & { ppq?: number };
            }
          }
        }
        setTopicData(normalizeTopicData(rawTopics));
        if (Array.isArray(p.hiddenIds)) {
          setHiddenCourseIds(
            new Set(p.hiddenIds.filter((id): id is string => typeof id === "string" && ALL_COURSES_ORDERED.some((c) => c.id === id)))
          );
        }
        const fromBlob = parseCoursePpqFromBlob(parsed, VALID_COURSE_IDS);
        setCoursePpq(fromBlob ?? migratePerTopicPpqToCourse(rawTopics, VALID_COURSE_IDS));
        setPpqData(ppqDataFromParsed(parsed));
        setDailyLog(dailyLogFromParsed(parsed));
        setHeatmapRange(parseHeatmapRangeIso(p.heatmapRange) ?? defaultHeatmapYearBoundsIso());
      } else {
        setHeatmapRange(defaultHeatmapYearBoundsIso());
      }
      setLoaded(true);
    })();
  }, []);

  useEffect(() => {
    if (!loaded) return;
    void persistRevisionData({
      topics: topicData,
      hiddenIds: Array.from(hiddenCourseIds),
      coursePpq,
      ppqData,
      dailyLog,
      heatmapRange,
    });
  }, [topicData, hiddenCourseIds, coursePpq, ppqData, dailyLog, heatmapRange, loaded]);

  // Single GET of static questions.json from GitHub (tripospro repo). No tripos.pro API; no repeated polling.
  useEffect(() => {
    if (mainView !== "ppq" && mainView !== "today") return;
    if (triposQuestions !== null) return;
    let cancelled = false;
    setTriposLoading(true);
    setTriposError(null);
    fetch(TRIPOS_QUESTIONS_URL)
      .then((r) => {
        if (!r.ok) throw new Error(r.statusText || String(r.status));
        return r.json();
      })
      .then((data: unknown) => {
        if (!cancelled) setTriposQuestions(Array.isArray(data) ? (data as TriposQuestion[]) : []);
      })
      .catch((e: Error) => {
        if (!cancelled) setTriposError(e.message || "Failed to load");
      })
      .finally(() => {
        if (!cancelled) setTriposLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [mainView, triposQuestions, triposRetry]);

  useEffect(() => {
    if (!coursePickerOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (pickerWrapRef.current && !pickerWrapRef.current.contains(e.target as Node)) setCoursePickerOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [coursePickerOpen]);

  const updateTopic = useCallback((courseId: string, topicIdx: number, val: TopicData) => {
    setTopicData((prev) => ({ ...prev, [`${courseId}_${topicIdx}`]: val }));
  }, []);

  const toggleExpand = (id: string) => setExpanded((p) => ({ ...p, [id]: !p[id] }));

  const allCourses = ALL_COURSES_ORDERED;
  const visibleCourses = allCourses.filter((c) => !hiddenCourseIds.has(c.id));
  const visibleCount = visibleCourses.length;

  const setCourseHidden = (id: string, hidden: boolean) => {
    setHiddenCourseIds((prev) => {
      const next = new Set(prev);
      if (hidden) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const filtered = allCourses.filter((c) => {
    if (hiddenCourseIds.has(c.id)) return false;
    if (filterType === "module" && !c.isModule) return false;
    if (filterType === "paper" && c.isModule) return false;
    if (search && !c.name.toLowerCase().includes(search.toLowerCase()) && !c.topics.some((t) => t.toLowerCase().includes(search.toLowerCase()))) return false;
    if (filterStatus !== "all") {
      const cp = coursePpq[c.id] ?? 0;
      const avg = c.topics.length
        ? c.topics.reduce((a, _, i) => {
            const td = topicData[`${c.id}_${i}`] || { theory: 0 };
            return a + (td.theory + cp) / 2;
          }, 0) / c.topics.length
        : 0;
      if (filterStatus === "critical" && avg >= 20) return false;
      if (filterStatus === "needs" && (avg < 20 || avg >= 50)) return false;
      if (filterStatus === "ok" && (avg < 50 || avg >= 80)) return false;
      if (filterStatus === "strong" && avg < 80) return false;
    }
    return true;
  });

  const totalTopics = visibleCourses.reduce((a, c) => a + c.topics.length, 0);
  const totalTheory = visibleCourses.reduce((a, c) => a + c.topics.reduce((b, _, i) => b + (topicData[`${c.id}_${i}`]?.theory || 0), 0), 0);
  const totalCoursePpq = visibleCourses.reduce((a, c) => a + (coursePpq[c.id] ?? 0), 0);
  const overallTheory = totalTopics ? Math.round(totalTheory / totalTopics) : 0;
  const overallPPQ = visibleCourses.length ? Math.round(totalCoursePpq / visibleCourses.length) : 0;
  const overall = Math.round((overallTheory + overallPPQ) / 2);

  const resetAll = () => {
    if (confirm("Reset all progress? This cannot be undone.")) {
      setTopicData({});
      setCoursePpq(emptyCoursePpq());
      setPpqData(emptyPpqData());
      setDailyLog(emptyDailyLog());
    }
  };

  const onCoursePpqChange = useCallback((courseId: string, v: number) => {
    setCoursePpq((prev) => ({ ...prev, [courseId]: v }));
  }, []);

  const streakDays = currentStreak(dailyLog);
  const daysLogged = daysWithLogsCount(dailyLog);

  const pickerCourses = ALL_COURSES_ORDERED.filter((c) => {
    if (!pickerSearch.trim()) return true;
    const q = pickerSearch.toLowerCase();
    return c.name.toLowerCase().includes(q) || c.id.toLowerCase().includes(q);
  });

  if (!loaded) return <div style={{ color: "var(--cg-muted-dim)", padding: 40, textAlign: "center", fontFamily: "'JetBrains Mono', monospace" }}>Loading...</div>;

  return (
    <div style={{ fontFamily: "'JetBrains Mono', 'SF Mono', 'Fira Code', monospace", background: "var(--cg-bg-deep)", color: "var(--cg-text)", minHeight: "100vh", padding: "20px 16px" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto 20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
          <div>
            <h1
              style={{
                fontSize: 22,
                fontWeight: 800,
                margin: 0,
                background: "var(--cg-title-gradient)",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                WebkitTextFillColor: "transparent",
                color: "transparent",
              }}
            >
              Retr0spect - Part II CST Revision timetable
            </h1>
            <p style={{ fontSize: 10, color: "var(--cg-text-dim)", margin: "4px 0 0", letterSpacing: 1, textTransform: "uppercase" }}>
              Cambridge 2025–26 · {streakDays} day streak · {daysLogged} days logged ·{" "}
              {visibleCount === allCourses.length ? `${allCourses.length} courses` : `${visibleCount} of ${allCourses.length} courses`} · {totalTopics} topics in selection
            </p>
          </div>
          <button type="button" onClick={resetAll} style={{ fontSize: 9, background: "none", border: "1px solid var(--cg-surface-2)", color: "var(--cg-text-dim)", borderRadius: 4, padding: "4px 10px", cursor: "pointer" }}>
            Reset All
          </button>
        </div>

        <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
          {(
            [
              { id: "topics" as const, label: "Topics & theory" },
              { id: "today" as const, label: "Today" },
              { id: "ppq" as const, label: "PPQ bank (tripospro data)" },
              { id: "data" as const, label: "Export & backup" },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setMainView(t.id)}
              style={{
                fontSize: 11,
                padding: "8px 14px",
                borderRadius: 6,
                border: mainView === t.id ? "1px solid var(--cg-tab-active-border)" : "1px solid var(--cg-surface-2)",
                background: mainView === t.id ? "var(--cg-tab-active-bg)" : "var(--cg-surface)",
                color: mainView === t.id ? "var(--cg-text)" : "var(--cg-muted-dim)",
                cursor: "pointer",
                fontWeight: mainView === t.id ? 600 : 400,
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {mainView === "topics" && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginTop: 16 }}>
              {[
                { label: "Overall", value: overall, color: "var(--cg-overall)" },
                { label: "Theory", value: overallTheory, color: "var(--cg-theory)" },
                { label: "PPQs", value: overallPPQ, color: "var(--cg-ppq)" },
              ].map((s) => (
                <div key={s.label} style={{ background: "var(--cg-surface)", borderRadius: 6, padding: "10px 14px", border: "1px solid var(--cg-surface-2)" }}>
                  <div style={{ fontSize: 9, color: "var(--cg-muted-dim)", textTransform: "uppercase", letterSpacing: 1 }}>{s.label}</div>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginTop: 4 }}>
                    <span style={{ fontSize: 24, fontWeight: 800, color: s.color }}>{s.value}</span>
                    <span style={{ fontSize: 10, color: "var(--cg-text-dim)" }}>%</span>
                  </div>
                  <div style={{ height: 4, borderRadius: 2, background: "var(--cg-surface-2)", marginTop: 6, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${s.value}%`, background: s.color, borderRadius: 2, transition: "width 0.5s" }} />
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: "flex", gap: 12, marginTop: 12, flexWrap: "wrap" }}>
              {[
                { label: "Critical (<20%)", color: "#fb7185" },
                { label: "Needs Work (20-50%)", color: "#fb923c" },
                { label: "OK (50-80%)", color: "#facc15" },
                { label: "Strong (80%+)", color: "#6ee7b7" },
              ].map((l) => (
                <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <div style={{ width: 8, height: 8, borderRadius: 2, background: l.color }} />
                  <span style={{ fontSize: 9, color: "var(--cg-muted-dim)" }}>{l.label}</span>
                </div>
              ))}
            </div>

            <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap", alignItems: "center" }}>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search courses or topics..."
                style={{ flex: "1 1 200px", maxWidth: 300, fontSize: 11, padding: "6px 10px", background: "var(--cg-surface)", border: "1px solid var(--cg-surface-2)", borderRadius: 5, color: "var(--cg-text)", outline: "none" }}
              />
              <div ref={pickerWrapRef} style={{ position: "relative" }}>
                <button
                  type="button"
                  onClick={() => setCoursePickerOpen((o) => !o)}
                  style={{
                    fontSize: 10,
                    padding: "6px 12px",
                    background: coursePickerOpen ? "var(--cg-picker-open)" : "var(--cg-surface)",
                    border: "1px solid var(--cg-surface-2)",
                    borderRadius: 5,
                    color: "var(--cg-muted)",
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                  }}
                >
                  Courses ({visibleCount}/{allCourses.length})
                </button>
                {coursePickerOpen && (
                  <div
                    style={{
                      position: "absolute",
                      zIndex: 100,
                      top: "100%",
                      left: 0,
                      marginTop: 6,
                      width: 340,
                      maxHeight: 420,
                      display: "flex",
                      flexDirection: "column",
                      background: "var(--cg-surface)",
                      border: "1px solid var(--cg-border)",
                      borderRadius: 8,
                      boxShadow: "0 12px 40px rgba(0,0,0,0.45)",
                      overflow: "hidden",
                    }}
                    onMouseDown={(e) => e.stopPropagation()}
                  >
                    <div style={{ padding: "10px 12px", borderBottom: "1px solid var(--cg-surface-2)", fontSize: 10, color: "var(--cg-muted)" }}>
                      Show or hide courses (like Discord channel list). Checked = visible in the tracker.
                    </div>
                    <input
                      value={pickerSearch}
                      onChange={(e) => setPickerSearch(e.target.value)}
                      placeholder="Search courses…"
                      style={{
                        margin: "8px 12px 0",
                        fontSize: 11,
                        padding: "6px 10px",
                        background: "var(--cg-bg-deep)",
                        border: "1px solid var(--cg-surface-2)",
                        borderRadius: 5,
                        color: "var(--cg-text)",
                        outline: "none",
                      }}
                    />
                    <div style={{ display: "flex", gap: 6, padding: "8px 12px", flexWrap: "wrap" }}>
                      <button
                        type="button"
                        onClick={() => setHiddenCourseIds(new Set())}
                        style={{ fontSize: 9, padding: "4px 8px", background: "var(--cg-surface-2)", border: "none", color: "var(--cg-muted)", borderRadius: 4, cursor: "pointer" }}
                      >
                        Show all
                      </button>
                      <button
                        type="button"
                        onClick={() => setHiddenCourseIds(new Set(allCourses.map((c) => c.id)))}
                        style={{ fontSize: 9, padding: "4px 8px", background: "var(--cg-surface-2)", border: "none", color: "var(--cg-muted)", borderRadius: 4, cursor: "pointer" }}
                      >
                        Hide all
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setHiddenCourseIds((prev) => {
                            const next = new Set(prev);
                            pickerCourses.forEach((c) => next.add(c.id));
                            return next;
                          });
                        }}
                        style={{ fontSize: 9, padding: "4px 8px", background: "var(--cg-surface-2)", border: "none", color: "var(--cg-muted)", borderRadius: 4, cursor: "pointer" }}
                      >
                        Hide filtered
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const keep = new Set(pickerCourses.map((c) => c.id));
                          setHiddenCourseIds(new Set(allCourses.filter((c) => !keep.has(c.id)).map((c) => c.id)));
                        }}
                        style={{ fontSize: 9, padding: "4px 8px", background: "var(--cg-surface-2)", border: "none", color: "var(--cg-muted)", borderRadius: 4, cursor: "pointer" }}
                      >
                        Show only filtered
                      </button>
                    </div>
                    <div style={{ overflowY: "auto", maxHeight: 260, padding: "4px 8px 12px" }}>
                      {pickerCourses.map((c) => {
                        const visible = !hiddenCourseIds.has(c.id);
                        return (
                          <label
                            key={c.id}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 10,
                              padding: "6px 8px",
                              borderRadius: 4,
                              cursor: "pointer",
                              fontSize: 11,
                              color: visible ? "var(--cg-text)" : "var(--cg-muted-dim)",
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={visible}
                              onChange={(e) => setCourseHidden(c.id, !e.target.checked)}
                              style={{ cursor: "pointer", accentColor: "var(--cg-accent)" }}
                            />
                            <span style={{ flex: 1, minWidth: 0 }}>
                              {c.name}
                              {c.isModule && (
                                <span style={{ marginLeft: 6, fontSize: 8, color: "var(--cg-link)", fontWeight: 600 }}>MODULE</span>
                              )}
                            </span>
                          </label>
                        );
                      })}
                      {!pickerCourses.length && (
                        <div style={{ padding: 16, textAlign: "center", color: "var(--cg-muted-dim)", fontSize: 11 }}>No courses match search.</div>
                      )}
                    </div>
                  </div>
                )}
              </div>
              {[
                { val: filterType, set: setFilterType, opts: [["all", "All Types"], ["paper", "Papers"], ["module", "Modules"]] as [string, string][] },
                {
                  val: filterStatus,
                  set: setFilterStatus,
                  opts: [["all", "All Status"], ["critical", "Critical"], ["needs", "Needs Work"], ["ok", "OK"], ["strong", "Strong"]] as [string, string][],
                },
              ].map((f, fi) => (
                <select
                  key={fi}
                  value={f.val}
                  onChange={(e) => f.set(e.target.value)}
                  style={{ fontSize: 10, padding: "5px 8px", background: "var(--cg-surface)", border: "1px solid var(--cg-surface-2)", borderRadius: 5, color: "var(--cg-muted)", outline: "none", cursor: "pointer" }}
                >
                  {f.opts.map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              ))}
              <button
                type="button"
                onClick={() => {
                  const allOpen = filtered.every((c) => expanded[c.id]);
                  setExpanded((p) => {
                    const next = { ...p };
                    filtered.forEach((c) => {
                      next[c.id] = !allOpen;
                    });
                    return next;
                  });
                }}
                style={{ fontSize: 10, background: "var(--cg-surface-2)", border: "none", color: "var(--cg-muted)", borderRadius: 4, padding: "5px 10px", cursor: "pointer" }}
              >
                {filtered.every((c) => expanded[c.id]) ? "Collapse All" : "Expand All"}
              </button>
            </div>

            <div style={{ maxWidth: 1100, margin: "8px auto 0" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {filtered.map((c) => (
                  <CourseCard
                    key={c.id}
                    course={c}
                    topicData={topicData}
                    coursePpqVal={coursePpq[c.id] ?? 0}
                    onCoursePpqChange={onCoursePpqChange}
                    updateTopic={updateTopic}
                    isExpanded={!!expanded[c.id]}
                    toggleExpand={() => toggleExpand(c.id)}
                  />
                ))}
              </div>
              {!filtered.length && (
                <div style={{ textAlign: "center", padding: 40, color: "var(--cg-text-dim)", fontSize: 12 }}>No courses match your filters.</div>
              )}
            </div>
          </>
        )}
      </div>

      {mainView === "today" && (
        <div style={{ marginTop: 20 }}>
          <TodayView
            allCourses={allCourses}
            visibleCourses={visibleCourses}
            dailyLog={dailyLog}
            setDailyLog={setDailyLog}
            setTopicData={setTopicData}
            setCoursePpq={setCoursePpq}
            setPpqData={setPpqData}
            triposQuestions={triposQuestions}
            triposLoading={triposLoading}
            triposError={triposError}
            onRetryTripos={() => {
              setTriposError(null);
              setTriposRetry((n) => n + 1);
            }}
            heatmapRange={heatmapRange}
            setHeatmapRange={setHeatmapRange}
          />
        </div>
      )}

      {mainView === "ppq" && (
        <div style={{ marginTop: 20 }}>
          <PpqBankView
            visibleCourses={visibleCourses}
            ppqData={ppqData}
            setPpqData={setPpqData}
            triposQuestions={triposQuestions}
            triposError={triposError}
            triposLoading={triposLoading}
            onRetryLoad={() => {
              setTriposError(null);
              setTriposRetry((n) => n + 1);
            }}
          />
        </div>
      )}

      {mainView === "data" && (
        <div style={{ marginTop: 20 }}>
          <ExportDataView
            validCourseIds={VALID_COURSE_IDS}
            topicData={topicData}
            coursePpq={coursePpq}
            hiddenCourseIds={hiddenCourseIds}
            ppqData={ppqData}
            dailyLog={dailyLog}
            setTopicData={setTopicData}
            setCoursePpq={setCoursePpq}
            setHiddenCourseIds={setHiddenCourseIds}
            setPpqData={setPpqData}
            setDailyLog={setDailyLog}
          />
        </div>
      )}
    </div>
  );
}
