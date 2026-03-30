import { useState } from "react";
import type { CourseWithTerm, TopicData } from "../types";

type StatusStyle = { bg: string; border: string; text: string; label: string };

export function getStatusColor(theory: number, ppq: number): StatusStyle {
  const avg = (theory + ppq) / 2;
  if (avg >= 80) return { bg: "#0a2e1a", border: "#16a34a", text: "#4ade80", label: "Strong" };
  if (avg >= 50) return { bg: "#1a2400", border: "#a3a316", text: "#d4de4a", label: "OK" };
  if (avg >= 20) return { bg: "#2e1f0a", border: "#d97706", text: "#fbbf24", label: "Needs Work" };
  return { bg: "#2e0a0a", border: "#dc2626", text: "#f87171", label: "Critical" };
}

function notesFromTopicData(td: TopicData | undefined): string {
  if (!td) return "";
  if (typeof td.notes === "string") return td.notes;
  if (Array.isArray(td.links) && td.links.length) return td.links.join("\n");
  return "";
}

function ProgressBar({
  value,
  onChange,
  color,
  label,
}: {
  value: number;
  onChange: (v: number) => void;
  color: string;
  label: string;
}) {
  const steps = [0, 25, 50, 75, 100];
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
      <span style={{ fontSize: 10, color: "#94a3b8", width: 40, flexShrink: 0, textAlign: "right" }}>{label}</span>
      <div style={{ display: "flex", gap: 2, flex: 1 }}>
        {steps.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onChange(s)}
            style={{
              flex: 1,
              height: 8,
              borderRadius: 2,
              border: "none",
              cursor: "pointer",
              background: value >= s ? color : "#1e293b",
              opacity: value >= s ? 1 : 0.4,
              transition: "all 0.2s",
            }}
            title={`${s}%`}
          />
        ))}
      </div>
      <span style={{ fontSize: 10, color, width: 28, flexShrink: 0, textAlign: "right", fontWeight: 600 }}>{value}%</span>
    </div>
  );
}

function TopicRow({
  topic,
  topicIdx,
  courseId,
  data,
  coursePpq,
  updateTopic,
}: {
  topic: string;
  topicIdx: number;
  courseId: string;
  data: TopicData | undefined;
  coursePpq: number;
  updateTopic: (courseId: string, topicIdx: number, val: TopicData) => void;
}) {
  const [notesOpen, setNotesOpen] = useState(false);
  const td = data || { theory: 0 };
  const status = getStatusColor(td.theory, coursePpq);
  const notesText = notesFromTopicData(td);
  const firstLine = notesText.trim().split(/\r?\n/).find((l) => l.trim()) || "";
  const preview = firstLine.length > 52 ? `${firstLine.slice(0, 52)}…` : firstLine;

  const setNotes = (text: string) => {
    const next: TopicData = { ...td, notes: text };
    delete next.links;
    updateTopic(courseId, topicIdx, next);
  };

  return (
    <div
      style={{
        borderLeft: `3px solid ${status.border}`,
        background: status.bg + "40",
        borderRadius: "0 4px 4px 0",
        transition: "all 0.3s",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1.6fr) 160px 50px minmax(0, 1fr)",
          gap: 8,
          padding: "6px 10px",
          alignItems: "center",
        }}
      >
        <span style={{ fontSize: 12, color: "#e2e8f0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={topic}>
          {topic}
        </span>
        <ProgressBar value={td.theory} onChange={(v) => updateTopic(courseId, topicIdx, { ...td, theory: v })} color="#818cf8" label="Theory" />
        <span style={{ fontSize: 9, color: status.text, fontWeight: 700, textAlign: "center", textTransform: "uppercase", letterSpacing: 0.5 }}>{status.label}</span>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "stretch", gap: 4, minWidth: 0 }}>
          <button
            type="button"
            onClick={() => setNotesOpen((o) => !o)}
            style={{
              fontSize: 10,
              textAlign: "left",
              background: notesOpen ? "#1e293b" : "none",
              border: "1px solid #334155",
              color: "#94a3b8",
              borderRadius: 4,
              cursor: "pointer",
              padding: "4px 8px",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <span style={{ color: "#64748b", flexShrink: 0 }}>{notesOpen ? "▼" : "▶"}</span>
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{notesOpen ? "Hide notes" : preview || "Notes & links"}</span>
          </button>
        </div>
      </div>
      {notesOpen && (
        <div style={{ padding: "0 10px 10px 10px" }}>
          <textarea
            value={notesText}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={"URLs (one per line), reminders, extra practice…\nExample: https://…\nDo more past paper Qs on X"}
            rows={5}
            style={{
              width: "100%",
              resize: "vertical",
              minHeight: 88,
              fontSize: 11,
              lineHeight: 1.45,
              padding: "8px 10px",
              background: "#020617",
              border: "1px solid #334155",
              borderRadius: 6,
              color: "#e2e8f0",
              outline: "none",
              fontFamily: "inherit",
            }}
          />
        </div>
      )}
    </div>
  );
}

export function CourseCard({
  course,
  topicData,
  coursePpqVal,
  onCoursePpqChange,
  updateTopic,
  isExpanded,
  toggleExpand,
}: {
  course: CourseWithTerm;
  topicData: Record<string, TopicData>;
  coursePpqVal: number;
  onCoursePpqChange: (courseId: string, v: number) => void;
  updateTopic: (courseId: string, topicIdx: number, val: TopicData) => void;
  isExpanded: boolean;
  toggleExpand: () => void;
}) {
  const topics = course.topics;
  const progress = topics.map((_, i) => {
    const td = topicData?.[`${course.id}_${i}`] || { theory: 0 };
    return (td.theory + coursePpqVal) / 2;
  });
  const avg = topics.length ? progress.reduce((a, b) => a + b, 0) / topics.length : 0;
  const status = getStatusColor(avg, avg);
  const theoryAvg = topics.length
    ? topics.reduce((a, _, i) => a + (topicData?.[`${course.id}_${i}`]?.theory || 0), 0) / topics.length
    : 0;
  const ppqAvg = coursePpqVal;

  return (
    <div
      style={{
        background: "#0f172a",
        border: `1px solid ${isExpanded ? status.border : "#1e293b"}`,
        borderRadius: 8,
        overflow: "hidden",
        transition: "all 0.3s",
      }}
    >
      <button
        type="button"
        onClick={toggleExpand}
        style={{
          width: "100%",
          display: "grid",
          gridTemplateColumns: "1fr auto auto auto auto",
          gap: 12,
          alignItems: "center",
          padding: "12px 14px",
          background: "none",
          border: "none",
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: "#f1f5f9", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{course.name}</span>
            {course.isModule && <span style={{ fontSize: 9, background: "#1e3a5f", color: "#60a5fa", padding: "1px 5px", borderRadius: 3, fontWeight: 600, flexShrink: 0 }}>MODULE</span>}
            {course.code ? <span style={{ fontSize: 9, color: "#64748b", flexShrink: 0 }}>{course.code}</span> : null}
          </div>
          <div style={{ fontSize: 10, color: "#64748b", marginTop: 2 }}>
            {course.lecturer} · {course.hours}h · {topics.length} topics
          </div>
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 10, color: "#818cf8", fontWeight: 600 }}>{Math.round(theoryAvg)}%</div>
          <div style={{ fontSize: 8, color: "#64748b" }}>Theory</div>
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 10, color: "#f472b6", fontWeight: 600 }}>{Math.round(ppqAvg)}%</div>
          <div style={{ fontSize: 8, color: "#64748b" }}>PPQ (course)</div>
        </div>
        <div
          style={{
            width: 48,
            height: 6,
            borderRadius: 3,
            background: "#1e293b",
            overflow: "hidden",
          }}
        >
          <div style={{ height: "100%", width: `${avg}%`, background: `linear-gradient(90deg, ${status.border}, ${status.text})`, borderRadius: 3, transition: "width 0.5s" }} />
        </div>
        <span style={{ fontSize: 16, color: "#475569", transition: "transform 0.2s", transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)" }}>▾</span>
      </button>
      {isExpanded && (
        <div style={{ padding: "0 8px 10px", display: "flex", flexDirection: "column", gap: 3 }}>
          <div
            style={{
              padding: "8px 10px",
              marginBottom: 4,
              background: "#020617",
              borderRadius: 6,
              border: "1px solid #1e293b",
            }}
          >
            <div style={{ fontSize: 9, color: "#64748b", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>PPQ confidence</div>
            <ProgressBar value={coursePpqVal} onChange={(v) => onCoursePpqChange(course.id, v)} color="#f472b6" label="PPQ" />
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 1.6fr) 160px 50px minmax(0, 1fr)",
              gap: 8,
              padding: "4px 10px",
              fontSize: 9,
              color: "#475569",
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: 0.8,
            }}
          >
            <span>Topic</span>
            <span>Theory</span>
            <span style={{ textAlign: "center" }}>Status</span>
            <span>Notes & links</span>
          </div>
          {topics.map((t, i) => (
            <TopicRow
              key={i}
              topic={t}
              topicIdx={i}
              courseId={course.id}
              data={topicData?.[`${course.id}_${i}`]}
              coursePpq={coursePpqVal}
              updateTopic={updateTopic}
            />
          ))}
        </div>
      )}
    </div>
  );
}
