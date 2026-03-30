export function newDailyEntryId(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `d-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export type DailyEntryKind = "note" | "topic" | "question";

export interface DailyEntry {
  id: string;
  at: string;
  /** `note` = free text; `topic` = course topic session; `question` = PPQ question. */
  kind: DailyEntryKind;
  /** Notes / reflection (optional for topic & question blocks). */
  text: string;
  courseId?: string;
  /** Legacy single-topic theory bump. */
  topicIdx?: number;
  /** Theory revision: which topic rows were bumped (same delta each). */
  topicIndices?: number[];
  /** From `stableQuestionKey` (tripos question row). */
  ppqQuestionKey?: string;
  /** Same as PPQ bank attempt (Today tab). */
  ppqMarks?: string;
  ppqDurationSec?: number | null;
  /** True if the PPQ attempt was open-book / not exam conditions. */
  ppqOpenBook?: boolean;
  theoryDelta?: number;
  ppqDelta?: number;
}

/** Keys are local calendar `YYYY-MM-DD`. */
export type DailyLogByDay = Record<string, { entries: DailyEntry[] }>;

export function emptyDailyLog(): DailyLogByDay {
  return {};
}

export function dailyLogFromParsed(parsed: unknown): DailyLogByDay {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
  const p = parsed as { dailyLog?: unknown };
  if (!p.dailyLog || typeof p.dailyLog !== "object" || Array.isArray(p.dailyLog)) return {};
  const raw = p.dailyLog as Record<string, unknown>;
  const out: DailyLogByDay = {};
  for (const [day, v] of Object.entries(raw)) {
    if (!v || typeof v !== "object" || Array.isArray(v)) continue;
    const entries = (v as { entries?: unknown }).entries;
    if (!Array.isArray(entries)) continue;
    const cleaned: DailyEntry[] = [];
    for (const e of entries) {
      if (!e || typeof e !== "object") continue;
      const o = e as Record<string, unknown>;
      const id = typeof o.id === "string" ? o.id : newDailyEntryId();
      const at = typeof o.at === "string" ? o.at : new Date().toISOString();
      const text = typeof o.text === "string" ? o.text : "";
      const courseId = typeof o.courseId === "string" ? o.courseId : undefined;
      const topicIdx = typeof o.topicIdx === "number" && Number.isFinite(o.topicIdx) ? o.topicIdx : undefined;
      const theoryDelta = typeof o.theoryDelta === "number" && Number.isFinite(o.theoryDelta) ? o.theoryDelta : undefined;
      const ppqDelta = typeof o.ppqDelta === "number" && Number.isFinite(o.ppqDelta) ? o.ppqDelta : undefined;
      const ppqQuestionKey = typeof o.ppqQuestionKey === "string" && o.ppqQuestionKey.trim() ? o.ppqQuestionKey.trim() : undefined;
      const ppqMarks = typeof o.ppqMarks === "string" ? o.ppqMarks : undefined;
      const ppqDurationSec =
        typeof o.ppqDurationSec === "number" && Number.isFinite(o.ppqDurationSec)
          ? o.ppqDurationSec
          : o.ppqDurationSec === null
            ? null
            : undefined;
      const ppqOpenBook = o.ppqOpenBook === true;
      let topicIndices: number[] | undefined;
      if (Array.isArray(o.topicIndices)) {
        topicIndices = (o.topicIndices as unknown[]).filter((x): x is number => typeof x === "number" && Number.isFinite(x) && x >= 0).map((x) => Math.floor(x));
      }
      let kind: DailyEntryKind = "note";
      if (o.kind === "topic" || o.kind === "question" || o.kind === "note") {
        kind = o.kind;
      } else if (ppqQuestionKey) {
        kind = "question";
      } else if (topicIndices?.length) {
        kind = "topic";
      }
      cleaned.push({
        id,
        at,
        kind,
        text,
        courseId,
        topicIdx,
        topicIndices,
        ppqQuestionKey,
        ppqMarks,
        ppqDurationSec,
        ppqOpenBook: ppqOpenBook || undefined,
        theoryDelta,
        ppqDelta,
      });
    }
    out[day] = { entries: cleaned };
  }
  return out;
}

export function isoDayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/** Monday = 0 … Sunday = 6 */
export function mondayOfWeek(d: Date): Date {
  const x = startOfDay(d);
  const dow = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - dow);
  return x;
}

const MS_DAY = 86400000;

export function parseDayKey(key: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const da = Number(m[3]);
  const d = new Date(y, mo, da);
  if (d.getFullYear() !== y || d.getMonth() !== mo || d.getDate() !== da) return null;
  return startOfDay(d);
}

/** Activity level 0–4 for heatmap. */
export function dayIntensity(dayKey: string, log: DailyLogByDay): number {
  const entries = log[dayKey]?.entries;
  if (!entries?.length) return 0;
  let score = 0;
  for (const e of entries) {
    score += 1;
    score += Math.min(2, Math.floor((e.text?.length || 0) / 400));
    if (e.theoryDelta || e.ppqDelta) score += 1;
  }
  return Math.min(4, 1 + Math.floor(score / 2));
}

/** Consecutive days (from today backwards) with at least one log line. */
export function currentStreak(log: DailyLogByDay): number {
  let streak = 0;
  const today = startOfDay(new Date());
  for (let i = 0; i < 800; i++) {
    const d = new Date(today.getTime() - i * MS_DAY);
    const k = isoDayKey(d);
    const n = log[k]?.entries?.length ?? 0;
    if (n > 0) streak += 1;
    else break;
  }
  return streak;
}

export function daysWithLogsCount(log: DailyLogByDay): number {
  return Object.values(log).filter((d) => (d?.entries?.length ?? 0) > 0).length;
}
