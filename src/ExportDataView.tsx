import { useState } from "react";
import type { ChangeEvent, CSSProperties, Dispatch, SetStateAction } from "react";
import type { DailyLogByDay } from "./dailyLog";
import type { PpqData } from "./ppqStorage";
import type { CoursePpqMap } from "./coursePpq";
import type { TopicData } from "./types";
import {
  buildFullExportPayload,
  downloadJson,
  fileLooksLikeRevisionData,
  stateFromImportMerge,
  stateFromImportReplace,
} from "./revisionExport";

export interface ExportDataViewProps {
  validCourseIds: Set<string>;
  topicData: Record<string, TopicData>;
  coursePpq: CoursePpqMap;
  hiddenCourseIds: Set<string>;
  ppqData: PpqData;
  dailyLog: DailyLogByDay;
  setTopicData: Dispatch<SetStateAction<Record<string, TopicData>>>;
  setCoursePpq: Dispatch<SetStateAction<CoursePpqMap>>;
  setHiddenCourseIds: Dispatch<SetStateAction<Set<string>>>;
  setPpqData: Dispatch<SetStateAction<PpqData>>;
  setDailyLog: Dispatch<SetStateAction<DailyLogByDay>>;
}

function summarizeFile(parsed: unknown): {
  topics: number;
  hiddenIds: number;
  ppqQuestions: number;
  ppqDoneKeys: number;
  dailyDays: number;
  exportedAt?: string;
  schemaVersion?: unknown;
} {
  const p = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
  const topics = p.topics != null && typeof p.topics === "object" && !Array.isArray(p.topics) ? Object.keys(p.topics as object).length : 0;
  const hiddenIds = Array.isArray(p.hiddenIds) ? p.hiddenIds.length : 0;
  let ppqQuestions = 0;
  if (p.ppqData != null && typeof p.ppqData === "object") {
    const q = (p.ppqData as PpqData).questions;
    ppqQuestions = q != null && typeof q === "object" ? Object.keys(q).length : 0;
  }
  const ppqDoneKeys =
    p.ppqDone != null && typeof p.ppqDone === "object" && !Array.isArray(p.ppqDone) ? Object.keys(p.ppqDone as object).length : 0;
  let dailyDays = 0;
  if (p.dailyLog != null && typeof p.dailyLog === "object" && !Array.isArray(p.dailyLog)) {
    dailyDays = Object.keys(p.dailyLog as object).length;
  }
  return {
    topics,
    hiddenIds,
    ppqQuestions,
    ppqDoneKeys,
    dailyDays,
    exportedAt: typeof p.exportedAt === "string" ? p.exportedAt : undefined,
    schemaVersion: p.schemaVersion,
  };
}

export default function ExportDataView({
  validCourseIds,
  topicData,
  coursePpq,
  hiddenCourseIds,
  ppqData,
  dailyLog,
  setTopicData,
  setCoursePpq,
  setHiddenCourseIds,
  setPpqData,
  setDailyLog,
}: ExportDataViewProps) {
  const [pending, setPending] = useState<unknown | null>(null);
  const [copyMsg, setCopyMsg] = useState<string | null>(null);

  const fullPayload = buildFullExportPayload({ topicData, coursePpq, hiddenCourseIds, ppqData, dailyLog });
  const jsonText = JSON.stringify(fullPayload, null, 2);

  const exportDownload = () => {
    downloadJson("retr0spect-full-backup", fullPayload);
  };

  const copyJson = async () => {
    try {
      await navigator.clipboard.writeText(jsonText);
      setCopyMsg("Copied to clipboard.");
      setTimeout(() => setCopyMsg(null), 2500);
    } catch {
      setCopyMsg("Could not copy (clipboard permission).");
      setTimeout(() => setCopyMsg(null), 3000);
    }
  };

  const onPickFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const raw = reader.result;
        const data = JSON.parse(typeof raw === "string" ? raw : "") as unknown;
        if (!fileLooksLikeRevisionData(data)) {
          alert("This file does not look like a full backup, PPQ export, or other known revision data.");
          setPending(null);
          return;
        }
        setPending(data);
      } catch {
        alert("Could not parse JSON.");
        setPending(null);
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const applyMerge = () => {
    if (pending == null) return;
    const next = stateFromImportMerge(
      { topicData, coursePpq, hiddenCourseIds, ppqData, dailyLog },
      pending,
      validCourseIds
    );
    setTopicData(next.topicData);
    setCoursePpq(next.coursePpq);
    setHiddenCourseIds(next.hiddenCourseIds);
    setPpqData(next.ppqData);
    setDailyLog(next.dailyLog);
    setPending(null);
  };

  const applyReplace = () => {
    if (pending == null) return;
    if (!confirm("Replace all stored data with this file? Topics, course visibility, PPQ progress, and daily log will match the file (missing sections become empty).")) {
      return;
    }
    const next = stateFromImportReplace(pending, validCourseIds);
    setTopicData(next.topicData);
    setCoursePpq(next.coursePpq);
    setHiddenCourseIds(next.hiddenCourseIds);
    setPpqData(next.ppqData);
    setDailyLog(next.dailyLog);
    setPending(null);
  };

  const preview = pending != null ? summarizeFile(pending) : null;

  return (
    <div style={{ maxWidth: 720, margin: "0 auto" }}>
      <p style={{ fontSize: 11, color: "var(--cg-muted-dim)", margin: "0 0 16px", lineHeight: 1.55 }}>
        Single JSON backup for this app: topic sliders & notes, which courses are hidden, PPQ attempts & paper notes, and the Today log / heatmap. Use{" "}
        <strong style={{ color: "var(--cg-muted)" }}>Export</strong> before reinstalling the browser or moving machines; use <strong style={{ color: "var(--cg-muted)" }}>Merge</strong> to pull in
        an older file or a PPQ-only export without wiping the rest.
      </p>

      <div
        style={{
          background: "var(--cg-surface)",
          border: "1px solid var(--cg-surface-2)",
          borderRadius: 8,
          padding: "16px 18px",
          marginBottom: 16,
        }}
      >
        <div style={{ fontSize: 10, color: "var(--cg-muted-dim)", textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 10 }}>Export everything</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
          <button type="button" onClick={exportDownload} style={btnPrimarySoft}>
            Download full backup (.json)
          </button>
          <button type="button" onClick={copyJson} style={btnSecondary}>
            Copy JSON to clipboard
          </button>
          {copyMsg && <span style={{ fontSize: 10, color: "var(--cg-success)" }}>{copyMsg}</span>}
        </div>
        <pre
          style={{
            marginTop: 14,
            padding: 12,
            background: "var(--cg-bg-deep)",
            border: "1px solid var(--cg-border)",
            borderRadius: 6,
            fontSize: 9,
            color: "var(--cg-muted)",
            maxHeight: 180,
            overflow: "auto",
            whiteSpace: "pre-wrap",
            wordBreak: "break-all",
          }}
        >
          {jsonText.slice(0, 4000)}
          {jsonText.length > 4000 ? "\n…" : ""}
        </pre>
      </div>

      <div
        style={{
          background: "var(--cg-surface)",
          border: "1px solid var(--cg-surface-2)",
          borderRadius: 8,
          padding: "16px 18px",
        }}
      >
        <div style={{ fontSize: 10, color: "var(--cg-muted-dim)", textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 10 }}>Import</div>
        <label style={{ fontSize: 11, color: "var(--cg-muted)", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <span>Choose JSON file</span>
          <input type="file" accept="application/json,.json" onChange={onPickFile} style={{ fontSize: 11 }} />
        </label>

        {preview && (
          <div style={{ marginBottom: 12, fontSize: 11, color: "var(--cg-text)", lineHeight: 1.6 }}>
            <div style={{ marginBottom: 6, color: "var(--cg-accent)", fontWeight: 600 }}>Loaded file preview</div>
            <div>Topic keys: {preview.topics}</div>
            <div>Hidden course ids: {preview.hiddenIds}</div>
            <div>PPQ question keys: {preview.ppqQuestions}</div>
            {preview.ppqDoneKeys > 0 && <div>Legacy ppqDone keys: {preview.ppqDoneKeys} (merge only)</div>}
            <div>Today / daily log days: {preview.dailyDays}</div>
            {preview.exportedAt && <div style={{ color: "var(--cg-muted-dim)", fontSize: 10 }}>exportedAt: {preview.exportedAt}</div>}
            {preview.schemaVersion != null && <div style={{ color: "var(--cg-muted-dim)", fontSize: 10 }}>schemaVersion: {String(preview.schemaVersion)}</div>}
          </div>
        )}

        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
          <button type="button" disabled={pending == null} onClick={applyMerge} style={pending == null ? mergeDisabled : btnPrimary}>
            Merge into current data
          </button>
          <button type="button" disabled={pending == null} onClick={applyReplace} style={pending == null ? replaceDisabled : btnDanger}>
            Replace all from file
          </button>
          {pending != null && (
            <button type="button" onClick={() => setPending(null)} style={btnSecondary}>
              Clear preview
            </button>
          )}
        </div>
        <p style={{ fontSize: 9, color: "#475569", margin: "12px 0 0", lineHeight: 1.45 }}>
          Merge: combines topic maps, unions hidden courses, merges PPQ maps and daily lines. Replace: overwrites each section from the file (empty if omitted). Legacy{" "}
          <code style={{ color: "#64748b" }}>ppqDone</code> is merged only (not on replace unless you use a file that still uses that field without <code style={{ color: "#64748b" }}>ppqData</code>).
        </p>
      </div>
    </div>
  );
}

const btnPrimary: CSSProperties = {
  fontSize: 11,
  padding: "8px 14px",
  background: "var(--cg-btn-primary-bg)",
  border: "1px solid var(--cg-btn-primary-border)",
  color: "var(--cg-btn-primary-fg)",
  borderRadius: 6,
  cursor: "pointer",
  fontWeight: 600,
};

const btnPrimarySoft: CSSProperties = {
  ...btnPrimary,
  background: "var(--cg-btn-soft-bg)",
  border: "1px solid var(--cg-btn-soft-border)",
  color: "var(--cg-btn-soft-fg)",
};

const btnSecondary: CSSProperties = {
  fontSize: 11,
  padding: "8px 14px",
  background: "var(--cg-surface-2)",
  border: "1px solid var(--cg-border)",
  color: "var(--cg-muted)",
  borderRadius: 6,
  cursor: "pointer",
};

const btnDanger: CSSProperties = {
  fontSize: 11,
  padding: "8px 14px",
  background: "var(--cg-btn-danger-bg)",
  border: "1px solid var(--cg-btn-danger-border)",
  color: "var(--cg-btn-danger-fg)",
  borderRadius: 6,
  cursor: "pointer",
  fontWeight: 600,
};

const mergeDisabled: CSSProperties = { ...btnPrimary, opacity: 0.45, cursor: "not-allowed" };
const replaceDisabled: CSSProperties = { ...btnDanger, opacity: 0.45, cursor: "not-allowed" };
