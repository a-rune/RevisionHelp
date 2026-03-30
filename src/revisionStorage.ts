import type { CoursePpqMap } from "./coursePpq";
import type { DailyLogByDay, HeatmapRangeIso } from "./dailyLog";
import type { PpqData } from "./ppqStorage";
import type { TopicData } from "./types";

export const REVISION_STORAGE_KEY = "revision-tracker-data";

export type RevisionPersistPayload = {
  topics: Record<string, TopicData>;
  hiddenIds: string[];
  coursePpq: CoursePpqMap;
  ppqData: PpqData;
  dailyLog: DailyLogByDay;
  heatmapRange: HeatmapRangeIso;
};

export async function loadStoredRevisionData(): Promise<unknown> {
  try {
    if (typeof window !== "undefined" && window.storage?.get) {
      const r = await window.storage.get(REVISION_STORAGE_KEY);
      if (r?.value) return JSON.parse(r.value);
    }
  } catch {
    /* ignore */
  }
  try {
    if (typeof localStorage !== "undefined") {
      const raw = localStorage.getItem(REVISION_STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    }
  } catch {
    /* ignore */
  }
  return null;
}

export async function persistRevisionData(data: RevisionPersistPayload): Promise<void> {
  const str = JSON.stringify(data);
  try {
    if (typeof window !== "undefined" && window.storage?.set) {
      await window.storage.set(REVISION_STORAGE_KEY, str);
      return;
    }
  } catch {
    /* ignore */
  }
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(REVISION_STORAGE_KEY, str);
    }
  } catch {
    /* ignore */
  }
}
