export interface PpqAttempt {
  id: string;
  at: string;
  durationSec: number | null;
  notes: string;
  marks: string;
  /** Past paper done with notes / resources (not exam conditions). */
  openBook?: boolean;
}

export interface PpqData {
  paperNotes: Record<string, string>;
  questions: Record<string, { attempts: PpqAttempt[] }>;
}

export function paperStorageKey(courseId: string, year: string, paper: string): string {
  return `${courseId}|${year}|${paper}`;
}

export function newAttemptId(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `a-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function emptyPpqData(): PpqData {
  return { paperNotes: {}, questions: {} };
}

interface ParsedRoot {
  ppqData?: {
    paperNotes?: Record<string, string>;
    questions?: Record<string, { attempts: PpqAttempt[] }>;
  };
  ppqDone?: Record<string, boolean>;
}

/** Load from persisted blob (supports legacy ppqDone booleans). */
export function ppqDataFromParsed(parsed: unknown): PpqData {
  const p = parsed as ParsedRoot | null | undefined;
  if (p?.ppqData?.questions && typeof p.ppqData.questions === "object") {
    return {
      paperNotes:
        typeof p.ppqData.paperNotes === "object" && p.ppqData.paperNotes ? { ...p.ppqData.paperNotes } : {},
      questions: { ...p.ppqData.questions },
    };
  }
  if (p?.ppqDone && typeof p.ppqDone === "object") {
    const questions: PpqData["questions"] = {};
    for (const [k, v] of Object.entries(p.ppqDone)) {
      if (v) {
        questions[k] = {
          attempts: [
            {
              id: newAttemptId(),
              at: new Date().toISOString(),
              durationSec: null,
              notes: "",
              marks: "",
            },
          ],
        };
      }
    }
    return { paperNotes: {}, questions };
  }
  return emptyPpqData();
}
