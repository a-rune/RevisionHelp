import { useEffect, useMemo, useState } from "react";
import { getQuestionsForCourse } from "./triposTopicMap";
import { newAttemptId, paperStorageKey } from "./ppqStorage";
import { formatDuration, normalizeSolutionUrl, pastPaperPdfUrl, stableQuestionKey } from "./ppqUtils";

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

function Stopwatch({ onLogAttempt }) {
  const [accum, setAccum] = useState(0);
  const [runStart, setRunStart] = useState(null);
  const [, setT] = useState(0);

  useEffect(() => {
    if (runStart == null) return;
    const id = setInterval(() => setT((x) => x + 1), 200);
    return () => clearInterval(id);
  }, [runStart]);

  const totalMs = runStart != null ? Date.now() - runStart + accum : accum;
  const totalSec = Math.floor(totalMs / 1000);

  const start = () => setRunStart(Date.now());
  const pause = () => {
    if (runStart != null) {
      setAccum((a) => a + (Date.now() - runStart));
      setRunStart(null);
    }
  };
  const reset = () => {
    setRunStart(null);
    setAccum(0);
  };

  const [notes, setNotes] = useState("");
  const [marks, setMarks] = useState("");

  const save = () => {
    if (totalSec <= 0 && !notes.trim() && !marks.trim()) return;
    onLogAttempt({ durationSec: totalSec > 0 ? totalSec : null, notes: notes.trim(), marks: marks.trim() });
    setNotes("");
    setMarks("");
    reset();
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 14, fontVariantNumeric: "tabular-nums", color: "#f472b6", fontWeight: 700, minWidth: 56 }}>{formatDuration(totalSec)}</span>
        {runStart == null ? (
          <button type="button" onClick={start} style={btnSm}>
            Start
          </button>
        ) : (
          <button type="button" onClick={pause} style={btnSm}>
            Pause
          </button>
        )}
        <button type="button" onClick={reset} style={{ ...btnSm, opacity: 0.8 }}>
          Reset
        </button>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "flex-start" }}>
        <input
          value={marks}
          onChange={(e) => setMarks(e.target.value)}
          placeholder="Marks e.g. 12/20"
          style={{ ...inpSm, width: 120 }}
        />
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Notes for this attempt…"
          rows={2}
          style={{ ...inpSm, flex: "1 1 200px", minWidth: 180, resize: "vertical" }}
        />
        <button type="button" onClick={save} style={{ ...btnSm, background: "#831843", borderColor: "#f472b6", color: "#fce7f3" }}>
          Log attempt
        </button>
      </div>
    </div>
  );
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

const inpSm = {
  fontSize: 10,
  padding: "6px 8px",
  background: "#020617",
  border: "1px solid #334155",
  borderRadius: 5,
  color: "#e2e8f0",
  outline: "none",
  fontFamily: "inherit",
};

function QuestionCard({ q, qKey, qState, onAddAttempt, onDeleteAttempt }) {
  const [open, setOpen] = useState(false);
  const pdfUrl = pastPaperPdfUrl(q.pdf);
  const solUrl = normalizeSolutionUrl(q.solutions);
  const label = `${q.year} · paper ${q.paper} · Q${q.question}`;
  const attempts = qState?.attempts || [];

  return (
    <div style={{ border: "1px solid #1e293b", borderRadius: 6, marginBottom: 6, overflow: "hidden", background: "#0a0f1a" }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          padding: "8px 10px",
          background: "none",
          border: "none",
          cursor: "pointer",
          textAlign: "left",
          color: "#e2e8f0",
        }}
      >
        <span style={{ fontSize: 11, fontWeight: 600 }}>{label}</span>
        <span style={{ fontSize: 10, color: "#64748b" }}>
          {attempts.length ? `${attempts.length} attempt${attempts.length === 1 ? "" : "s"}` : "no attempts yet"}
        </span>
        <span style={{ fontSize: 12, color: "#475569" }}>{open ? "▼" : "▶"}</span>
      </button>
      <div style={{ display: "flex", gap: 10, padding: "0 10px 8px", flexWrap: "wrap", fontSize: 10 }}>
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
      </div>
      {open && (
        <div style={{ padding: "0 10px 12px", borderTop: "1px solid #1e293b" }}>
          <Stopwatch
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
      )}
    </div>
  );
}

export default function PpqBankView({ visibleCourses, ppqData, setPpqData, triposQuestions, triposError, triposLoading, onRetryLoad }) {
  const [yearFilter, setYearFilter] = useState("all");

  const years = useMemo(() => {
    if (!triposQuestions?.length) return [];
    const y = new Set(triposQuestions.map((q) => q.year));
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
        const data = JSON.parse(reader.result);
        const incoming = data.ppqData && typeof data.ppqData === "object" ? data.ppqData : data;
        if (typeof incoming !== "object" || incoming === null) throw new Error("Invalid");
        setPpqData((prev) => ({
          paperNotes: { ...prev.paperNotes, ...(incoming.paperNotes || {}) },
          questions: { ...prev.questions, ...(incoming.questions || {}) },
        }));
      } catch {
        alert("Could not import: expected JSON with ppqData { paperNotes, questions }.");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  if (triposLoading) {
    return (
      <div style={{ textAlign: "center", padding: 48, color: "#64748b", fontSize: 13 }}>Loading question index from tripospro…</div>
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
        <span style={{ fontSize: 10, color: "#475569" }}>Expand each course below. Paper notes + attempts are stored locally.</span>
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
                  Add topic name(s) in <code style={{ color: "#94a3b8" }}>src/triposTopicMap.js</code> to match{" "}
                  <a href="https://github.com/olifog/tripospro/blob/main/questions.json" style={{ color: "#60a5fa" }} rel="noreferrer">
                    questions.json
                  </a>
                  .
                </p>
              )}
              {total > 0 &&
                paperGroups.map(([yp, paperQs]) => {
                  const [year, paper] = yp.split("|");
                  const pk = paperStorageKey(course.id, year, paper);
                  const note = ppqData.paperNotes[pk] || "";
                  return (
                    <div key={yp} style={{ marginBottom: 16 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: "#94a3b8", marginBottom: 6 }}>
                        {year} · Paper {paper}
                      </div>
                      <label style={{ display: "block", fontSize: 9, color: "#64748b", marginBottom: 4 }}>Notes for this paper (overall)</label>
                      <textarea
                        value={note}
                        onChange={(e) => setPaperNote(course.id, year, paper, e.target.value)}
                        placeholder="Timing strategy, which questions to skip, general remarks…"
                        rows={2}
                        style={{ width: "100%", maxWidth: "100%", fontSize: 10, padding: "8px 10px", background: "#020617", border: "1px solid #334155", borderRadius: 6, color: "#e2e8f0", marginBottom: 10, resize: "vertical", fontFamily: "inherit" }}
                      />
                      {paperQs.map((q) => {
                        const qk = stableQuestionKey(q);
                        return (
                          <QuestionCard
                            key={qk}
                            q={q}
                            qKey={qk}
                            qState={ppqData.questions[qk]}
                            onAddAttempt={addAttempt}
                            onDeleteAttempt={deleteAttempt}
                          />
                        );
                      })}
                    </div>
                  );
                })}
            </div>
          </details>
        );
      })}
    </div>
  );
}
