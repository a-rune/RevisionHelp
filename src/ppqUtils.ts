import type { PpqAttempt } from "./ppqStorage";

/** Question PDFs on the department site (same pattern as tripospro ingest). */
export function pastPaperPdfUrl(pdfFilename: string | undefined): string {
  const f = (pdfFilename || "").trim();
  if (!f) return "";
  return `https://www.cl.cam.ac.uk/teaching/exams/pastpapers/${encodeURIComponent(f)}`;
}

export function normalizeSolutionUrl(url: string | undefined): string {
  return (url || "").trim().replace(/\r$/, "");
}

/** Stable id across sessions (matches tripos row identity). */
export function stableQuestionKey(q: { year: string | number; paper: string | number; question: string | number; topic: string }): string {
  return `${q.year}|${q.paper}|${q.question}|${q.topic}`;
}

/** Human label from a `stableQuestionKey` string (no JSON lookup). */
export function formatQuestionKeyForDisplay(key: string): string {
  const p = key.split("|");
  if (p.length < 4) return key;
  const [year, paper, qn, topic] = p;
  return `${year} · paper ${paper} · Q${qn} · ${topic}`;
}

/** Static JSON from the tripospro GitHub repo (CDN). Loaded at most once per browser session — not tripos.pro and not a polling loop. */
export const TRIPOS_QUESTIONS_URL =
  "https://raw.githubusercontent.com/olifog/tripospro/main/questions.json";

export function formatDuration(sec: number | null | undefined): string {
  if (sec == null || Number.isNaN(sec) || sec < 0) return "—";
  const s = Math.floor(sec);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}

/**
 * Parse a marks string to 0–1. Supports `12/20`, `75%`, `0.75`, or `75` (percent if >1).
 * Returns null if nothing parseable.
 */
export function parseMarksRatio(marksStr: string | null | undefined): number | null {
  if (marksStr == null || typeof marksStr !== "string") return null;
  const t = marksStr.trim();
  if (!t) return null;

  const frac = t.match(/^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)/);
  if (frac) {
    const a = parseFloat(frac[1]);
    const b = parseFloat(frac[2]);
    if (b > 0 && !Number.isNaN(a) && !Number.isNaN(b)) return Math.max(0, Math.min(1, a / b));
  }

  const pct = t.match(/^(\d+(?:\.\d+)?)\s*%/);
  if (pct) {
    const p = parseFloat(pct[1]);
    if (!Number.isNaN(p)) return Math.max(0, Math.min(1, p / 100));
  }

  const lone = t.match(/^(\d+(?:\.\d+)?)\s*$/);
  if (lone) {
    const v = parseFloat(lone[1]);
    if (Number.isNaN(v)) return null;
    if (v >= 0 && v <= 1) return v;
    if (v >= 0 && v <= 100) return v / 100;
  }

  return null;
}

/** Not attempted: neutral. Attempted: red→green by marks; amber if no parseable mark. */
export function ppqCellVisualStyle(attempts: PpqAttempt[] | undefined): {
  background: string;
  border: string;
  color: string;
} {
  if (!attempts?.length) {
    return {
      background: "#f4f4f5",
      border: "1px solid #d4d4d8",
      color: "#71717a",
    };
  }

  const latest = [...attempts].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())[0];
  const ratio = parseMarksRatio(latest?.marks);
  if (ratio == null) {
    return {
      background: "#fffbeb",
      border: "1px solid #fbbf24",
      color: "#92400e",
    };
  }

  const hue = ratio * 120;
  return {
    background: `hsl(${hue}, 45%, 92%)`,
    border: `1px solid hsl(${hue}, 50%, 65%)`,
    color: `hsl(${hue}, 55%, 22%)`,
  };
}
