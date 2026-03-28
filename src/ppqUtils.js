/** Question PDFs on the department site (same pattern as tripospro ingest). */
export function pastPaperPdfUrl(pdfFilename) {
  const f = (pdfFilename || "").trim();
  if (!f) return "";
  return `https://www.cl.cam.ac.uk/teaching/exams/pastpapers/${encodeURIComponent(f)}`;
}

export function normalizeSolutionUrl(url) {
  return (url || "").trim().replace(/\r$/, "");
}

/** Stable id across sessions (matches tripos row identity). */
export function stableQuestionKey(q) {
  return `${q.year}|${q.paper}|${q.question}|${q.topic}`;
}

export const TRIPOS_QUESTIONS_URL =
  "https://raw.githubusercontent.com/olifog/tripospro/main/questions.json";
