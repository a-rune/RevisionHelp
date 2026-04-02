import { useState } from "react";
import type { CourseWithTerm, TopicData } from "../types";

export type StatusStyle = { rowBg: string; border: string; text: string; label: string };

/** Pastel fills + muted accents (aligned with light crimson shell). */
export function getStatusColor(theory: number): StatusStyle {
  if (theory >= 80) return { rowBg: "#ecfdf5", border: "#6ee7b7", text: "#047857", label: "Strong" };
  if (theory >= 50) return { rowBg: "#fefce8", border: "#facc15", text: "#a16207", label: "OK" };
  if (theory >= 20) return { rowBg: "#fffbeb", border: "#fb923c", text: "#c2410c", label: "Needs Work" };
  return { rowBg: "#fff1f2", border: "#fb7185", text: "#9f1239", label: "Critical" };
}

function notesFromTopicData(td: TopicData | undefined): string {
  if (!td) return "";
  if (typeof td.notes === "string") return td.notes;
  if (Array.isArray(td.links) && td.links.length) return td.links.join("\n");
  return "";
}

/** Four quarters: (0,25], (25,50], (50,75], (75,100]; 0% via separate zero button. */
const PROGRESS_STEPS = [25, 50, 75, 100] as const;

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
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4, minWidth: 0 }}>
      <span style={{ fontSize: 10, color: "var(--cg-muted)", width: 40, flexShrink: 0, textAlign: "right" }}>{label}</span>
      <button
        type="button"
        onClick={() => onChange(0)}
        title="Set to 0%"
        style={{
          flexShrink: 0,
          fontSize: 9,
          fontWeight: 700,
          fontFamily: "inherit",
          padding: "0 6px",
          minWidth: 22,
          height: 22,
          lineHeight: "20px",
          borderRadius: 4,
          border: "1px solid var(--cg-border)",
          background: "var(--cg-surface)",
          color: "var(--cg-muted-dim)",
          cursor: "pointer",
        }}
      >
        0
      </button>
      <div style={{ display: "flex", gap: 2, flex: 1, minWidth: 0 }}>
        {PROGRESS_STEPS.map((s) => {
          const filled = value >= s;
          return (
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
                background: filled ? color : "var(--cg-progress-empty)",
                opacity: filled ? 1 : 0.4,
                transition: "all 0.2s",
              }}
              title={`${s}%`}
            />
          );
        })}
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
  const status = getStatusColor(td.theory);
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
        background: status.rowBg,
        borderRadius: "0 4px 4px 0",
        transition: "all 0.3s",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1.6fr) minmax(168px, 1fr) 50px minmax(0, 1fr)",
          gap: 8,
          padding: "6px 10px",
          alignItems: "center",
        }}
      >
        <span style={{ fontSize: 12, color: "var(--cg-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={topic}>
          {topic}
        </span>
        <ProgressBar value={td.theory} onChange={(v) => updateTopic(courseId, topicIdx, { ...td, theory: v })} color="var(--cg-theory)" label="Theory" />
        <span style={{ fontSize: 9, color: status.text, fontWeight: 700, textAlign: "center", textTransform: "uppercase", letterSpacing: 0.5 }}>{status.label}</span>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "stretch", gap: 4, minWidth: 0 }}>
          <button
            type="button"
            onClick={() => setNotesOpen((o) => !o)}
            style={{
              fontSize: 10,
              textAlign: "left",
              background: notesOpen ? "var(--cg-surface-2)" : "none",
              border: "1px solid var(--cg-border)",
              color: "var(--cg-muted)",
              borderRadius: 4,
              cursor: "pointer",
              padding: "4px 8px",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <span style={{ color: "var(--cg-muted-dim)", flexShrink: 0 }}>{notesOpen ? "▼" : "▶"}</span>
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
              background: "var(--cg-bg-deep)",
              border: "1px solid var(--cg-border)",
              borderRadius: 6,
              color: "var(--cg-text)",
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
  const status = getStatusColor(avg);
  const theoryAvg = topics.length
    ? topics.reduce((a, _, i) => a + (topicData?.[`${course.id}_${i}`]?.theory || 0), 0) / topics.length
    : 0;
  const ppqAvg = coursePpqVal;

  return (
    <div
      style={{
        background: "var(--cg-surface)",
        border: `1px solid ${isExpanded ? status.border : "var(--cg-surface-2)"}`,
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
            <span style={{ fontSize: 14, fontWeight: 700, color: "var(--cg-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{course.name}</span>
            {course.isModule && <span style={{ fontSize: 9, background: "var(--cg-module-bg)", color: "var(--cg-module-fg)", padding: "1px 5px", borderRadius: 3, fontWeight: 600, flexShrink: 0 }}>MODULE</span>}
            {course.code ? <span style={{ fontSize: 9, color: "var(--cg-muted-dim)", flexShrink: 0 }}>{course.code}</span> : null}
          </div>
          <div style={{ fontSize: 10, color: "var(--cg-muted-dim)", marginTop: 2 }}>
            {course.lecturer} · {course.hours}h · {topics.length} topics
          </div>
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 10, color: "var(--cg-theory)", fontWeight: 600 }}>{Math.round(theoryAvg)}%</div>
          <div style={{ fontSize: 8, color: "var(--cg-muted-dim)" }}>Theory</div>
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 10, color: "var(--cg-ppq)", fontWeight: 600 }}>{Math.round(ppqAvg)}%</div>
          <div style={{ fontSize: 8, color: "var(--cg-muted-dim)" }}>PPQ (course)</div>
        </div>
        <div
          style={{
            width: 48,
            height: 6,
            borderRadius: 3,
            background: "var(--cg-surface-2)",
            overflow: "hidden",
          }}
        >
          <div style={{ height: "100%", width: `${avg}%`, background: `linear-gradient(90deg, ${status.border}, ${status.text})`, borderRadius: 3, transition: "width 0.5s" }} />
        </div>
        <span style={{ fontSize: 16, color: "var(--cg-text-dim)", transition: "transform 0.2s", transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)" }}>▾</span>
      </button>
      {isExpanded && (
        <div style={{ padding: "0 8px 10px", display: "flex", flexDirection: "column", gap: 3 }}>
          <div
            style={{
              padding: "8px 10px",
              marginBottom: 4,
              background: "var(--cg-ppq-panel-bg)",
              borderRadius: 6,
              border: "1px solid var(--cg-ppq-panel-border)",
            }}
          >
            <div style={{ fontSize: 9, color: "var(--cg-muted-dim)", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>PPQ confidence</div>
            <ProgressBar value={coursePpqVal} onChange={(v) => onCoursePpqChange(course.id, v)} color="var(--cg-ppq-soft)" label="PPQ" />
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 1.6fr) minmax(168px, 1fr) 50px minmax(0, 1fr)",
              gap: 8,
              padding: "4px 10px",
              fontSize: 9,
              color: "var(--cg-text-dim)",
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
