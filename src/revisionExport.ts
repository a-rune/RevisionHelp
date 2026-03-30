import {
  emptyCoursePpq,
  migratePerTopicPpqToCourse,
  normalizeTopicData,
  parseCoursePpqFromBlob,
  type CoursePpqMap,
} from "./coursePpq";
import { dailyLogFromParsed, emptyDailyLog, type DailyLogByDay } from "./dailyLog";
import { emptyPpqData, ppqDataFromParsed, type PpqData } from "./ppqStorage";
import type { TopicData } from "./types";

/** Bump when the on-disk shape changes incompatibly. */
export const REVISION_SCHEMA_VERSION = 1;

export interface FullRevisionExport {
  schemaVersion: number;
  exportedAt: string;
  app: "retr0spect";
  topics: Record<string, TopicData>;
  /** Per-course PPQ confidence (0–100) for the Topics tab. */
  coursePpq: CoursePpqMap;
  hiddenIds: string[];
  ppqData: PpqData;
  dailyLog: DailyLogByDay;
}

export function buildFullExportPayload(input: {
  topicData: Record<string, TopicData>;
  coursePpq: CoursePpqMap;
  hiddenCourseIds: Set<string>;
  ppqData: PpqData;
  dailyLog: DailyLogByDay;
}): FullRevisionExport {
  return {
    schemaVersion: REVISION_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    app: "retr0spect",
    topics: input.topicData,
    coursePpq: { ...input.coursePpq },
    hiddenIds: Array.from(input.hiddenCourseIds),
    ppqData: input.ppqData,
    dailyLog: input.dailyLog,
  };
}

export function downloadJson(filenameBase: string, obj: unknown): void {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${filenameBase}-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

function mergePpqData(a: PpqData, b: PpqData): PpqData {
  return {
    paperNotes: { ...a.paperNotes, ...b.paperNotes },
    questions: { ...a.questions, ...b.questions },
  };
}

function mergeDailyLog(a: DailyLogByDay, b: DailyLogByDay): DailyLogByDay {
  const out: DailyLogByDay = { ...a };
  for (const [k, v] of Object.entries(b)) {
    if (!v?.entries?.length) continue;
    out[k] = { entries: [...(out[k]?.entries ?? []), ...v.entries] };
  }
  return out;
}

/** True if JSON looks like it contains any revision data we understand. */
export function fileLooksLikeRevisionData(parsed: unknown): boolean {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return false;
  const p = parsed as Record<string, unknown>;
  return (
    (p.topics != null && typeof p.topics === "object") ||
    Array.isArray(p.hiddenIds) ||
    (p.ppqData != null && typeof p.ppqData === "object") ||
    (p.ppqDone != null && typeof p.ppqDone === "object") ||
    (p.dailyLog != null && typeof p.dailyLog === "object") ||
    (p.coursePpq != null && typeof p.coursePpq === "object")
  );
}

/**
 * Replace current app state from file. Missing sections become empty (PPQ still accepts legacy ppqDone via ppqDataFromParsed).
 */
export function stateFromImportReplace(parsed: unknown, validCourseIds: Set<string>): {
  topicData: Record<string, TopicData>;
  coursePpq: CoursePpqMap;
  hiddenCourseIds: Set<string>;
  ppqData: PpqData;
  dailyLog: DailyLogByDay;
} {
  const p = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};

  const topicDataRaw =
    p.topics != null && typeof p.topics === "object" && !Array.isArray(p.topics)
      ? (p.topics as Record<string, TopicData & { ppq?: number }>)
      : {};
  const topicData = normalizeTopicData(topicDataRaw);
  const hasCoursePpqKey = p.coursePpq != null && typeof p.coursePpq === "object" && !Array.isArray(p.coursePpq);
  const coursePpq = hasCoursePpqKey
    ? (parseCoursePpqFromBlob(parsed, validCourseIds) ?? emptyCoursePpq())
    : migratePerTopicPpqToCourse(topicDataRaw, validCourseIds);

  const rawHidden = Array.isArray(p.hiddenIds) ? p.hiddenIds.filter((x): x is string => typeof x === "string") : [];
  const hiddenCourseIds = new Set(rawHidden.filter((id) => validCourseIds.has(id)));

  let ppqData: PpqData = emptyPpqData();
  if (p.ppqData != null && typeof p.ppqData === "object") {
    const q = p.ppqData as PpqData;
    ppqData = {
      paperNotes: typeof q.paperNotes === "object" && q.paperNotes ? { ...q.paperNotes } : {},
      questions: typeof q.questions === "object" && q.questions ? { ...q.questions } : {},
    };
  } else {
    ppqData = ppqDataFromParsed(parsed);
  }

  const dailyLog = p.dailyLog != null && typeof p.dailyLog === "object" ? dailyLogFromParsed(parsed) : emptyDailyLog();

  return { topicData, coursePpq, hiddenCourseIds, ppqData, dailyLog };
}

/** Merge file into existing state (file wins on overlapping keys). */
export function stateFromImportMerge(
  current: {
    topicData: Record<string, TopicData>;
    coursePpq: CoursePpqMap;
    hiddenCourseIds: Set<string>;
    ppqData: PpqData;
    dailyLog: DailyLogByDay;
  },
  parsed: unknown,
  validCourseIds: Set<string>
): {
  topicData: Record<string, TopicData>;
  coursePpq: CoursePpqMap;
  hiddenCourseIds: Set<string>;
  ppqData: PpqData;
  dailyLog: DailyLogByDay;
} {
  const p = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};

  let topicData = { ...current.topicData };
  if (p.topics != null && typeof p.topics === "object" && !Array.isArray(p.topics)) {
    topicData = { ...topicData, ...normalizeTopicData(p.topics as Record<string, TopicData & { ppq?: number }>) };
  }

  let coursePpq = { ...current.coursePpq };
  if (p.coursePpq != null && typeof p.coursePpq === "object" && !Array.isArray(p.coursePpq)) {
    const incPpq = parseCoursePpqFromBlob(parsed, validCourseIds);
    if (incPpq) coursePpq = { ...coursePpq, ...incPpq };
  }

  const hiddenCourseIds = new Set(current.hiddenCourseIds);
  if (Array.isArray(p.hiddenIds)) {
    for (const id of p.hiddenIds) {
      if (typeof id === "string" && validCourseIds.has(id)) hiddenCourseIds.add(id);
    }
  }

  let ppqData = current.ppqData;
  if (p.ppqData != null && typeof p.ppqData === "object") {
    const q = p.ppqData as PpqData;
    const inc: PpqData = {
      paperNotes: typeof q.paperNotes === "object" && q.paperNotes ? { ...q.paperNotes } : {},
      questions: typeof q.questions === "object" && q.questions ? { ...q.questions } : {},
    };
    ppqData = mergePpqData(current.ppqData, inc);
  }
  if (p.ppqDone != null && typeof p.ppqDone === "object") {
    const mig = ppqDataFromParsed({ ppqDone: p.ppqDone as Record<string, boolean> });
    ppqData = mergePpqData(ppqData, mig);
  }

  let dailyLog = current.dailyLog;
  if (p.dailyLog != null && typeof p.dailyLog === "object") {
    dailyLog = mergeDailyLog(current.dailyLog, dailyLogFromParsed(parsed));
  }

  return { topicData, coursePpq, hiddenCourseIds, ppqData, dailyLog };
}
