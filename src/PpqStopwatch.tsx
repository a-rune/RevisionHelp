import { forwardRef, useEffect, useImperativeHandle, useState, type CSSProperties } from "react";
import { formatDuration } from "./ppqUtils";

export interface PpqAttemptSnapshot {
  durationSec: number | null;
  notes: string;
  marks: string;
  openBook: boolean;
}

function parseManualMinutesToSeconds(s: string): number | null {
  const t = s.trim().replace(",", ".");
  if (!t) return null;
  const n = Number(t);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 60);
}

export interface PpqStopwatchHandle {
  getSnapshot: () => PpqAttemptSnapshot;
  /** Clear timer and fields (after logging). */
  reset: () => void;
}

const btnSm: CSSProperties = {
  fontSize: 10,
  padding: "4px 10px",
  background: "#1e293b",
  border: "1px solid #334155",
  color: "#94a3b8",
  borderRadius: 4,
  cursor: "pointer",
};

const inpSm: CSSProperties = {
  fontSize: 10,
  padding: "6px 8px",
  background: "#020617",
  border: "1px solid #334155",
  borderRadius: 5,
  color: "#e2e8f0",
  outline: "none",
  fontFamily: "inherit",
};

interface PpqStopwatchProps {
  /** When set, shows “Log attempt” and calls this with the same shape as the PPQ bank tab. */
  onLogAttempt?: (att: PpqAttemptSnapshot) => void;
  disabled?: boolean;
}

/**
 * Timer + marks + notes — same fields as logging an attempt in the PPQ bank tab.
 * Use `ref` from Today tab to read a snapshot without the bank’s submit button.
 */
export const PpqStopwatch = forwardRef<PpqStopwatchHandle, PpqStopwatchProps>(function PpqStopwatch(
  { onLogAttempt, disabled },
  ref
) {
  const [accum, setAccum] = useState(0);
  const [runStart, setRunStart] = useState<number | null>(null);
  const [, setT] = useState(0);
  const [notes, setNotes] = useState("");
  const [marks, setMarks] = useState("");
  const [manualMinutes, setManualMinutes] = useState("");
  const [openBook, setOpenBook] = useState(false);

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
  const resetTimer = () => {
    setRunStart(null);
    setAccum(0);
  };

  const resetAll = () => {
    setNotes("");
    setMarks("");
    setManualMinutes("");
    setOpenBook(false);
    resetTimer();
  };

  const resolvedDurationSec = (): number | null => {
    const manualSec = parseManualMinutesToSeconds(manualMinutes);
    if (manualSec != null && manualSec > 0) return manualSec;
    return totalSec > 0 ? totalSec : null;
  };

  useImperativeHandle(ref, () => ({
    getSnapshot: (): PpqAttemptSnapshot => ({
      durationSec: resolvedDurationSec(),
      notes: notes.trim(),
      marks: marks.trim(),
      openBook,
    }),
    reset: resetAll,
  }));

  const save = () => {
    const durationSec = resolvedDurationSec();
    if (durationSec == null && !notes.trim() && !marks.trim() && !openBook) return;
    onLogAttempt?.({
      durationSec,
      notes: notes.trim(),
      marks: marks.trim(),
      openBook,
    });
    resetAll();
  };

  const displaySec = resolvedDurationSec() ?? totalSec;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 14, fontVariantNumeric: "tabular-nums", color: "#f472b6", fontWeight: 700, minWidth: 56 }} title={parseManualMinutesToSeconds(manualMinutes) ? "Using manual time below" : undefined}>
          {formatDuration(displaySec)}
        </span>
        {runStart == null ? (
          <button type="button" onClick={start} style={btnSm} disabled={disabled}>
            Start
          </button>
        ) : (
          <button type="button" onClick={pause} style={btnSm} disabled={disabled}>
            Pause
          </button>
        )}
        <button type="button" onClick={resetTimer} style={{ ...btnSm, opacity: 0.8 }} disabled={disabled}>
          Reset timer
        </button>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10, color: "#94a3b8", cursor: disabled ? "default" : "pointer" }}>
          <span style={{ color: "#64748b" }}>Or time (min)</span>
          <input
            type="text"
            inputMode="decimal"
            value={manualMinutes}
            onChange={(e) => setManualMinutes(e.target.value)}
            placeholder="e.g. 45"
            style={{ ...inpSm, width: 72 }}
            disabled={disabled}
          />
        </label>
        <span style={{ fontSize: 8, color: "#475569" }}>Overrides timer if set</span>
      </div>
      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 10, color: "#94a3b8", cursor: disabled ? "default" : "pointer" }}>
        <input type="checkbox" checked={openBook} onChange={(e) => setOpenBook(e.target.checked)} disabled={disabled} style={{ accentColor: "#f472b6" }} />
        Open book (notes / not exam conditions)
      </label>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "flex-start" }}>
        <input
          value={marks}
          onChange={(e) => setMarks(e.target.value)}
          placeholder="Marks e.g. 12/20"
          style={{ ...inpSm, width: 120 }}
          disabled={disabled}
        />
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Notes for this attempt…"
          rows={2}
          style={{ ...inpSm, flex: "1 1 200px", minWidth: 180, resize: "vertical" }}
          disabled={disabled}
        />
        {onLogAttempt && (
          <button type="button" onClick={save} style={{ ...btnSm, background: "#831843", borderColor: "#f472b6", color: "#fce7f3" }} disabled={disabled}>
            Log attempt
          </button>
        )}
      </div>
    </div>
  );
});
