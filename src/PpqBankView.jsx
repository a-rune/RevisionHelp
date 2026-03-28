import { useMemo, useState } from "react";
import { getQuestionsForCourse } from "./triposTopicMap";
import { normalizeSolutionUrl, pastPaperPdfUrl, stableQuestionKey, TRIPOS_QUESTIONS_URL } from "./ppqUtils";

function QuestionRow({ q, done, onToggle }) {
  const key = stableQuestionKey(q);
  const pdfUrl = pastPaperPdfUrl(q.pdf);
  const solUrl = normalizeSolutionUrl(q.solutions);
  const label = `${q.year} paper ${q.paper} q${q.question}`;
  return (
    <tr style={{ borderBottom: "1px solid #1e293b" }}>
      <td style={{ padding: "6px 8px", verticalAlign: "middle" }}>
        <input type="checkbox" checked={!!done} onChange={() => onToggle(key)} style={{ accentColor: "#f472b6", cursor: "pointer" }} />
      </td>
      <td style={{ padding: "6px 8px", fontSize: 11, color: "#cbd5e1", whiteSpace: "nowrap" }}>{label}</td>
      <td style={{ padding: "6px 8px", fontSize: 10, color: "#64748b", maxWidth: 160 }} title={q.topic}>
        {q.topic}
      </td>
      <td style={{ padding: "6px 8px" }}>
        {pdfUrl ? (
          <a href={pdfUrl} target="_blank" rel="noreferrer" style={{ fontSize: 10, color: "#60a5fa" }}>
            Paper
          </a>
        ) : (
          <span style={{ fontSize: 10, color: "#475569" }}>—</span>
        )}
      </td>
      <td style={{ padding: "6px 8px" }}>
        {solUrl ? (
          <a href={solUrl} target="_blank" rel="noreferrer" style={{ fontSize: 10, color: "#a78bfa" }}>
            Solutions
          </a>
        ) : (
          <span style={{ fontSize: 10, color: "#475569" }}>—</span>
        )}
      </td>
    </tr>
  );
}

export default function PpqBankView({ visibleCourses, ppqDone, setPpqDone, triposQuestions, triposError, triposLoading, onRetryLoad }) {
  const [yearFilter, setYearFilter] = useState("all");

  const years = useMemo(() => {
    if (!triposQuestions?.length) return [];
    const y = new Set(triposQuestions.map((q) => q.year));
    return [...y].sort((a, b) => Number(b) - Number(a));
  }, [triposQuestions]);

  const toggle = (key) => {
    setPpqDone((prev) => {
      const next = { ...prev };
      if (next[key]) delete next[key];
      else next[key] = true;
      return next;
    });
  };

  const exportPpq = () => {
    const blob = new Blob([JSON.stringify({ ppqDone, exportedAt: new Date().toISOString() }, null, 2)], {
      type: "application/json",
    });
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
        const incoming = data.ppqDone && typeof data.ppqDone === "object" ? data.ppqDone : data;
        if (typeof incoming !== "object" || incoming === null) throw new Error("Invalid file");
        setPpqDone((prev) => ({ ...prev, ...incoming }));
      } catch {
        alert("Could not import: expected JSON with a ppqDone object (or a flat key map).");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  if (triposLoading) {
    return (
      <div style={{ textAlign: "center", padding: 48, color: "#64748b", fontSize: 13 }}>
        Loading question index from tripospro…
      </div>
    );
  }

  if (triposError) {
    return (
      <div style={{ padding: 24, color: "#f87171", fontSize: 13 }}>
        Could not load questions.json: {triposError}
        <div style={{ marginTop: 12, fontSize: 11, color: "#64748b" }}>
          Check your network; data is fetched from GitHub (olifog/tripospro).
        </div>
        {onRetryLoad && (
          <button
            type="button"
            onClick={onRetryLoad}
            style={{ marginTop: 12, fontSize: 11, padding: "6px 12px", background: "#1e293b", border: "1px solid #334155", color: "#94a3b8", borderRadius: 5, cursor: "pointer" }}
          >
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
        <button
          type="button"
          onClick={exportPpq}
          style={{ fontSize: 10, padding: "6px 12px", background: "#1e293b", border: "1px solid #334155", color: "#94a3b8", borderRadius: 5, cursor: "pointer" }}
        >
          Export PPQ progress (JSON)
        </button>
        <label style={{ fontSize: 10, color: "#64748b", cursor: "pointer" }}>
          <span style={{ marginRight: 8 }}>Import merge</span>
          <input type="file" accept="application/json" onChange={importPpq} style={{ fontSize: 10 }} />
        </label>
        <span style={{ fontSize: 10, color: "#475569" }}>
          Paper links use the department pastpapers URL (you may need Raven). Solutions often open the same way.
        </span>
      </div>

      {visibleCourses.map((course) => {
        let qs = getQuestionsForCourse(course.id, triposQuestions || []);
        if (yearFilter !== "all") qs = qs.filter((q) => q.year === yearFilter);
        const doneCount = qs.filter((q) => ppqDone[stableQuestionKey(q)]).length;
        const total = qs.length;

        return (
          <div key={course.id} style={{ marginBottom: 24 }}>
            <div
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: "#e2e8f0",
                marginBottom: 8,
                display: "flex",
                alignItems: "baseline",
                gap: 10,
                flexWrap: "wrap",
              }}
            >
              {course.name}
              {course.isModule && (
                <span style={{ fontSize: 9, background: "#1e3a5f", color: "#60a5fa", padding: "2px 6px", borderRadius: 3 }}>MODULE</span>
              )}
              <span style={{ fontSize: 11, color: "#f472b6", fontWeight: 600 }}>
                {total ? `${doneCount}/${total} done` : "no Tripos topic map"}
              </span>
            </div>
            {!total && (
              <p style={{ fontSize: 11, color: "#64748b", margin: "0 0 8px" }}>
                Add topic name(s) for this course in <code style={{ color: "#94a3b8" }}>src/triposTopicMap.js</code> to match{" "}
                <a href="https://github.com/olifog/tripospro/blob/main/questions.json" style={{ color: "#60a5fa" }} rel="noreferrer">
                  questions.json
                </a>
                .
              </p>
            )}
            {total > 0 && (
              <div style={{ overflowX: "auto", border: "1px solid #1e293b", borderRadius: 8 }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                  <thead>
                    <tr style={{ background: "#0f172a", color: "#64748b", textAlign: "left", fontSize: 9, textTransform: "uppercase", letterSpacing: 0.6 }}>
                      <th style={{ padding: "8px", width: 36 }}>Done</th>
                      <th style={{ padding: "8px" }}>Paper / Q</th>
                      <th style={{ padding: "8px" }}>Tripos topic</th>
                      <th style={{ padding: "8px" }}>Paper PDF</th>
                      <th style={{ padding: "8px" }}>Solutions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {qs.map((q) => (
                      <QuestionRow key={stableQuestionKey(q)} q={q} done={ppqDone[stableQuestionKey(q)]} onToggle={toggle} />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
