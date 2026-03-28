/**
 * Maps tracker `course.id` → exact `topic` string(s) in olifog/tripospro `questions.json`.
 * @see https://github.com/olifog/tripospro/blob/main/questions.json
 * Courses with no matching Tripos topic show an empty list until you add strings here.
 */
export const TRIPOS_TOPICS_BY_COURSE_ID = {
  bioinfo: ["Bioinformatics"],
  business: ["Business Studies"],
  denotsem: ["Denotational Semantics"],
  infotheory: ["Information Theory"],
  texjulia: [],
  princcomm: ["Principles of Communications"],
  types: ["Types"],
  agip: ["Further Graphics", "Introduction to Graphics"],
  aai: ["Artificial Intelligence"],
  cat: [],
  dsp: ["Digital Signal Processing"],
  mvp: [],
  nlp: ["Natural Language Processing"],
  hcai: [],
  qct: [],
  uqa: [],
  adcomarch: ["Advanced Computer Architecture"],
  atfp: [],
  crypto: ["Cryptography"],
  ecommerce: ["E-Commerce"],
  mlbayinfer: ["Machine Learning and Bayesian Inference"],
  optcomp: ["Optimising Compilers"],
  quantcomp: ["Quantum Computing"],
  cc: [],
  ce: [],
  cyc: [],
  dnn: [],
  mh: [],
  mrs: [],
  msp: [],
  busseminrs: [],
  hlogmodc: ["Hoare Logic and Model Checking"],
};

export function getQuestionsForCourse(courseId, allQuestions) {
  const topics = TRIPOS_TOPICS_BY_COURSE_ID[courseId];
  if (!topics?.length) return [];
  const set = new Set(topics);
  return allQuestions.filter((q) => set.has(q.topic));
}
