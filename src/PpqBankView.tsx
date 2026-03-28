import { useEffect, useMemo, useState } from "react";
import { getQuestionsForCourse } from "./triposTopicMap";
import { newAttemptId, paperStorageKey, ppqDataFromParsed, type PpqAttempt, type PpqData } from "./ppqStorage";
import { PpqStopwatch } from "./PpqStopwatch";
import { formatDuration, normalizeSolutionUrl, pastPaperPdfUrl, ppqCellVisualStyle, stableQuestionKey } from "./ppqUtils";
import type { CourseWithTerm, TriposQuestion } from "./types";
import type { Dispatch, SetStateAction } from "react";

function groupQuestionsByPaper(qs) {
  const map = new Map();
  for (const q of qs) {
    const pk = `${q.year}|${q.paper}`;
    if (!map.has(pk)) map.set(pk, []);
    map.get(pk).push(q);
  }
  return [...map.entries()].sort((a, b) => {
    const [ya, pa] = a[0].split("|");
    const [yb, pb] = b[0].split("|");
    return Number(yb) - Number(ya) || Number(pa) - Number(pb);
  });
}

function formatShortTaken(iso) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch {
    return "—";
  }
}

function getLatestAttempt(attempts: PpqAttempt[] | undefined): PpqAttempt | null {
  if (!attempts?.length) return null;
  return [...attempts].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())[0];
}

const btnSm = {
  fontSize: 10,
  padding: "4px 10px",
  background: "#1e293b",
  border: "1px solid #334155",
  color: "#94a3b8",
  borderRadius: 4,
  cursor: "pointer",
};

function QuestionDetailPanel({ q, qKey, qState, onAddAttempt, onDeleteAttempt }) {
  const pdfUrl = pastPaperPdfUrl(q.pdf);
  const solUrl = normalizeSolutionUrl(q.solutions);
  const label = `${q.year} · paper ${q.paper} · Q${q.question}`;
  const attempts = qState?.attempts || [];

  return (
    <div>
      <div style={{ fontSize: 14, fontWeight: 700, color: "#f1f5f9", marginBottom: 8 }}>{label}</div>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", fontSize: 11, marginBottom: 12 }}>
        {pdfUrl && (
          <a href={pdfUrl} target="_blank" rel="noreferrer" style={{ color: "#60a5fa" }}>
            Paper PDF
          </a>
        )}
        {solUrl && (
          <a href={solUrl} target="_blank" rel="noreferrer" style={{ color: "#a78bfa" }}>
            Solutions
          </a>
        )}
        <span style={{ fontSize: 10, color: "#64748b" }}>{q.topic}</span>
      </div>
      <PpqStopwatch
        onLogAttempt={(att) =>
          onAddAttempt(qKey, {
            id: newAttemptId(),
            at: new Date().toISOString(),
            durationSec: att.durationSec,
            notes: att.notes,
            marks: att.marks,
          })
        }
      />
      {attempts.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 9, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>Past attempts</div>
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
            {[...attempts].reverse().map((a) => (
              <li
                key={a.id}
                style={{
                  fontSize: 10,
                  padding: "8px 10px",
                  background: "#0f172a",
                  borderRadius: 6,
                  border: "1px solid #1e293b",
                  color: "#cbd5e1",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", alignItems: "flex-start" }}>
                  <span style={{ color: "#94a3b8" }}>
                    {new Date(a.at).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" })}
                  </span>
                  <span style={{ color: "#f472b6" }}>{a.durationSec != null ? formatDuration(a.durationSec) : "—"}</span>
                  <button
                    type="button"
                    onClick={() => onDeleteAttempt(qKey, a.id)}
                    style={{ fontSize: 9, background: "none", border: "none", color: "#64748b", cursor: "pointer", marginLeft: "auto" }}
                  >
                    Remove
                  </button>
                </div>
                {a.marks ? <div style={{ marginTop: 4, color: "#a78bfa" }}>Marks: {a.marks}</div> : null}
                {a.notes ? <div style={{ marginTop: 4, whiteSpace: "pre-wrap" }}>{a.notes}</div> : null}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export interface PpqBankViewProps {
  visibleCourses: CourseWithTerm[];
  ppqData: PpqData;
  setPpqData: Dispatch<SetStateAction<PpqData>>;
  triposQuestions: TriposQuestion[] | null;
  triposError: string | null;
  triposLoading: boolean;
  onRetryLoad?: () => void;
}

export default function PpqBankView({
  visibleCourses,
  ppqData,
  setPpqData,
  triposQuestions,
  triposError,
  triposLoading,
  onRetryLoad,
}: PpqBankViewProps) {
  const [yearFilter, setYearFilter] = useState("all");
  const [selected, setSelected] = useState<{ q: TriposQuestion; qKey: string } | null>(null);

  useEffect(() => {
    if (!selected) return;
    const onKey = (e) => {
      if (e.key === "Escape") setSelected(null);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [selected]);

  const years = useMemo((): string[] => {
    if (!triposQuestions?.length) return [];
    const y = new Set(triposQuestions.map((q) => String(q.year)));
    return [...y].sort((a, b) => Number(b) - Number(a));
  }, [triposQuestions]);

  const addAttempt = (questionKey, attempt) => {
    setPpqData((prev) => ({
      ...prev,
      questions: {
        ...prev.questions,
        [questionKey]: {
          attempts: [...(prev.questions[questionKey]?.attempts || []), attempt],
        },
      },
    }));
  };

  const deleteAttempt = (questionKey, id) => {
    setPpqData((prev) => {
      const cur = prev.questions[questionKey]?.attempts || [];
      const nextAtt = cur.filter((a) => a.id !== id);
      const nextQuestions = { ...prev.questions };
      if (nextAtt.length === 0) delete nextQuestions[questionKey];
      else nextQuestions[questionKey] = { attempts: nextAtt };
      return { ...prev, questions: nextQuestions };
    });
  };

  const setPaperNote = (courseId, year, paper, text) => {
    const pk = paperStorageKey(courseId, year, paper);
    setPpqData((prev) => ({
      ...prev,
      paperNotes: { ...prev.paperNotes, [pk]: text },
    }));
  };

  const exportPpq = () => {
    const blob = new Blob([JSON.stringify({ ppqData, exportedAt: new Date().toISOString() }, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `ppq-progress-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const importPpq = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const raw = reader.result;
        const text = typeof raw === "string" ? raw : "";
        if (!text) return;
        const data = JSON.parse(text) as { ppqData?: PpqData; ppqDone?: Record<string, boolean> };
        if (data.ppqData && typeof data.ppqData === "object") {
          const pd = data.ppqData;
          setPpqData((prev) => ({
            paperNotes: { ...prev.paperNotes, ...(pd.paperNotes || {}) },
            questions: { ...prev.questions, ...(pd.questions || {}) },
          }));
        } else if (data.ppqDone && typeof data.ppqDone === "object") {
          const migrated = ppqDataFromParsed({ ppqDone: data.ppqDone });
          setPpqData((prev) => ({
            paperNotes: { ...prev.paperNotes, ...migrated.paperNotes },
            questions: { ...prev.questions, ...migrated.questions },
          }));
        } else {
          throw new Error("Invalid");
        }
      } catch {
        alert("Could not import: use export format, or legacy { ppqDone }.");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  if (triposLoading) {
    return (
      <div style={{ textAlign: "center", padding: 48, color: "#64748b", fontSize: 13 }}>
        Loading question list (one request to GitHub for <code style={{ color: "#94a3b8" }}>questions.json</code>)…
      </div>
    );
  }

  if (triposError) {
    return (
      <div style={{ padding: 24, color: "#f87171", fontSize: 13 }}>
        Could not load questions.json: {triposError}
        <div style={{ marginTop: 12, fontSize: 11, color: "#64748b" }}>Check your network; data is fetched from GitHub (olifog/tripospro).</div>
        {onRetryLoad && (
          <button type="button" onClick={onRetryLoad} style={{ marginTop: 12, fontSize: 11, padding: "6px 12px", background: "#1e293b", border: "1px solid #334155", color: "#94a3b8", borderRadius: 5, cursor: "pointer" }}>
            Retry
          </button>
        )}
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", marginBottom: 16 }}>
        <label style={{ fontSize: 11, color: "#94a3b8", display: "flex", alignItems: "center", gap: 8 }}>
          Year
          <select
            value={yearFilter}
            onChange={(e) => setYearFilter(e.target.value)}
            style={{ fontSize: 11, padding: "4px 8px", background: "#0f172a", border: "1px solid #1e293b", borderRadius: 5, color: "#e2e8f0" }}
          >
            <option value="all">All years</option>
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </label>
        <button type="button" onClick={exportPpq} style={{ fontSize: 10, padding: "6px 12px", background: "#1e293b", border: "1px solid #334155", color: "#94a3b8", borderRadius: 5, cursor: "pointer" }}>
          Export PPQ data (JSON)
        </button>
        <label style={{ fontSize: 10, color: "#64748b", cursor: "pointer" }}>
          <span style={{ marginRight: 8 }}>Import merge</span>
          <input type="file" accept="application/json" onChange={importPpq} style={{ fontSize: 10 }} />
        </label>
        <span style={{ fontSize: 9, color: "#475569" }} title="Topics, Today log, and course visibility live in the Export & backup tab">
          · Full JSON (everything) → Export & backup tab
        </span>
        <span style={{ fontSize: 9, color: "#475569" }}>One GitHub fetch ·</span>
        <span style={{ fontSize: 9, color: "#64748b", marginLeft: 4 }}>Key</span>
        {(
          [
            { t: "Not done", attempts: [] as PpqAttempt[] },
            {
              t: "No mark",
              attempts: [{ id: "_", at: "2000-01-01T00:00:00.000Z", durationSec: null, notes: "", marks: "" }],
            },
            {
              t: "25%",
              attempts: [{ id: "_", at: "2000-01-01T00:00:00.000Z", durationSec: null, notes: "", marks: "5/20" }],
            },
            {
              t: "75%",
              attempts: [{ id: "_", at: "2000-01-01T00:00:00.000Z", durationSec: null, notes: "", marks: "15/20" }],
            },
          ] as { t: string; attempts: PpqAttempt[] }[]
        ).map(({ t, attempts }) => (
          <span key={t} style={{ display: "inline-flex", alignItems: "center", gap: 3, marginLeft: 6 }} title={t}>
            <span
              style={{
                display: "inline-block",
                width: 11,
                height: 11,
                borderRadius: 2,
                verticalAlign: "middle",
                ...ppqCellVisualStyle(attempts),
              }}
            />
            <span style={{ fontSize: 8, color: "#64748b" }}>{t}</span>
          </span>
        ))}
      </div>

      {visibleCourses.map((course) => {
        let qs = getQuestionsForCourse(course.id, triposQuestions || []);
        if (yearFilter !== "all") qs = qs.filter((q) => q.year === yearFilter);
        const total = qs.length;
        const attempted = qs.filter((q) => (ppqData.questions[stableQuestionKey(q)]?.attempts || []).length > 0).length;
        const paperGroups = groupQuestionsByPaper(qs);

        return (
          <details
            key={course.id}
            style={{ marginBottom: 10, border: "1px solid #1e293b", borderRadius: 8, background: "#0f172a", overflow: "hidden" }}
          >
            <summary
              style={{
                padding: "12px 14px",
                cursor: "pointer",
                fontSize: 13,
                fontWeight: 700,
                color: "#e2e8f0",
                listStyle: "none",
                display: "flex",
                alignItems: "center",
                gap: 10,
                flexWrap: "wrap",
              }}
            >
              <span style={{ userSelect: "none" }}>{course.name}</span>
              {course.isModule && <span style={{ fontSize: 9, background: "#1e3a5f", color: "#60a5fa", padding: "2px 6px", borderRadius: 3 }}>MODULE</span>}
              <span style={{ fontSize: 11, color: "#f472b6", fontWeight: 600 }}>
                {total ? `${attempted}/${total} with attempts` : "no Tripos topic map"}
              </span>
            </summary>
            <div style={{ padding: "0 14px 14px" }}>
              {!total && (
                <p style={{ fontSize: 11, color: "#64748b", margin: "0 0 8px" }}>
                  Add topic name(s) in <code style={{ color: "#94a3b8" }}>src/triposTopicMap.ts</code> to match{" "}
                  <a href="https://github.com/olifog/tripospro/blob/main/questions.json" style={{ color: "#60a5fa" }} rel="noreferrer">
                    questions.json
                  </a>
                  .
                </p>
              )}
              {total > 0 &&
                paperGroups.map(([yp, paperQs], pi) => {
                  const [year, paper] = yp.split("|");
                  const pk = paperStorageKey(course.id, year, paper);
                  const note = ppqData.paperNotes[pk] || "";
                  const yy = year.length >= 2 ? year.slice(-2) : year;
                  const sortedQs = [...paperQs].sort((a, b) => Number(a.question) - Number(b.question));
                  const lastPaper = pi === paperGroups.length - 1;
                  return (
                    <div
                      key={yp}
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        alignItems: "stretch",
                        gap: 8,
                        marginBottom: lastPaper ? 0 : 8,
                        paddingBottom: lastPaper ? 0 : 8,
                        borderBottom: lastPaper ? "none" : "1px solid #1e293b",
                      }}
                    >
                      <div style={{ flex: "0 0 auto", width: 112, minWidth: 88 }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", letterSpacing: 0.3, marginBottom: 4 }}>
                          ’{yy} · P{paper}
                        </div>
                        <textarea
                          value={note}
                          onChange={(e) => setPaperNote(course.id, year, paper, e.target.value)}
                          placeholder="Paper notes…"
                          rows={1}
                          style={{
                            width: "100%",
                            fontSize: 9,
                            lineHeight: 1.35,
                            padding: "5px 6px",
                            background: "#020617",
                            border: "1px solid #1e293b",
                            borderRadius: 4,
                            color: "#94a3b8",
                            resize: "none",
                            fontFamily: "inherit",
                            minHeight: 28,
                            maxHeight: 56,
                            overflow: "auto",
                          }}
                        />
                      </div>
                      <div
                        style={{
                          display: "flex",
                          flexWrap: "wrap",
                          gap: 4,
                          flex: "1 1 200px",
                          alignContent: "flex-start",
                        }}
                      >
                        {sortedQs.map((q) => {
                          const qk = stableQuestionKey(q);
                          const attempts = ppqData.questions[qk]?.attempts || [];
                          const n = attempts.length;
                          const latest = getLatestAttempt(attempts);
                          const vis = ppqCellVisualStyle(attempts);
                          const marksShow = latest?.marks?.trim() ? latest.marks.trim() : "—";
                          return (
                            <button
                              key={qk}
                              type="button"
                              onClick={() => setSelected({ q, qKey: qk })}
                              title={`${course.name} · ${q.year} paper ${q.paper} Q${q.question} · ${n} attempt(s)`}
                              style={{
                                ...vis,
                                width: 68,
                                minHeight: 54,
                                padding: "3px 4px",
                                borderRadius: 5,
                                cursor: "pointer",
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "center",
                                justifyContent: "center",
                                gap: 1,
                                textAlign: "center",
                                lineHeight: 1.15,
                                boxSizing: "border-box",
                              }}
                            >
                              <span style={{ fontSize: 9, fontWeight: 800, fontVariantNumeric: "tabular-nums", color: vis.color }}>
                                ’{yy} Q{q.question}
                              </span>
                              <span style={{ fontSize: 8, color: vis.color, opacity: 0.88 }}>{formatShortTaken(latest?.at)}</span>
                              <span
                                style={{
                                  fontSize: 8,
                                  fontWeight: 600,
                                  color: vis.color,
                                  opacity: latest?.marks?.trim() ? 0.95 : 0.55,
                                  maxWidth: "100%",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {marksShow}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
            </div>
          </details>
        );
      })}

      {selected && (
        <div
          role="presentation"
          onClick={() => setSelected(null)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 300,
            background: "rgba(2, 6, 23, 0.88)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Question details"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: 520,
              maxHeight: "min(90vh, 720px)",
              overflow: "auto",
              background: "#0f172a",
              border: "1px solid #334155",
              borderRadius: 12,
              padding: 20,
              boxShadow: "0 25px 80px rgba(0,0,0,0.55)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 12 }}>
              <span style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", letterSpacing: 1 }}>PPQ question</span>
              <button type="button" onClick={() => setSelected(null)} style={{ ...btnSm, flexShrink: 0 }}>
                Close
              </button>
            </div>
            <QuestionDetailPanel
              q={selected.q}
              qKey={selected.qKey}
              qState={ppqData.questions[selected.qKey]}
              onAddAttempt={addAttempt}
              onDeleteAttempt={deleteAttempt}
            />
          </div>
        </div>
      )}
    </div>
  );
}
