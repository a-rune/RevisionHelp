import { useState, useEffect, useCallback, useRef } from "react";

const STORAGE_KEY = "revision-tracker-data";

async function loadStoredData() {
  try {
    if (typeof window !== "undefined" && window.storage?.get) {
      const r = await window.storage.get(STORAGE_KEY);
      if (r?.value) return JSON.parse(r.value);
    }
  } catch {}
  try {
    if (typeof localStorage !== "undefined") {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    }
  } catch {}
  return null;
}

async function persistStoredData(data) {
  const str = JSON.stringify(data);
  try {
    if (typeof window !== "undefined" && window.storage?.set) {
      await window.storage.set(STORAGE_KEY, str);
      return;
    }
  } catch {}
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(STORAGE_KEY, str);
    }
  } catch {}
}

const COURSES_DATA = {
  michaelmas: {
    label: "Michaelmas Term",
    courses: [
      {
        id: "bioinfo",
        name: "Bioinformatics",
        code: "",
        lecturer: "Prof Pietro Lio'",
        hours: 12,
        isModule: false,
        topics: [
          "Introduction to Biological Data & Adleman's Experiment",
          "Dynamic Programming: LCS, Global & Local Alignment",
          "Linear Space Alignment (Hirschberg)",
          "Nussinov Algorithm for RNA",
          "Heuristics for Multiple Alignment",
          "Sequence Database Search & BLAST",
          "Genome Sequencing & De Bruijn Graphs",
          "Phylogeny: Distance-Based Methods",
          "Phylogeny: Character-Based Methods",
          "Hidden Markov Models",
          "Stochastic Simulation (Doob-Gillespie)",
          "Revision & Example Class",
        ],
      },
      {
        id: "business",
        name: "Business Studies",
        code: "",
        lecturer: "McTavish & Harris",
        hours: 8,
        isModule: false,
        topics: [
          "Introduction to Business & Entrepreneurship",
          "Business Plans & Financial Basics",
          "Marketing & Strategy",
          "Intellectual Property & Patents",
          "Company Law & Governance",
          "Venture Capital & Funding",
          "Management & Leadership",
          "Case Studies & Exam Prep",
        ],
      },
      {
        id: "denotsem",
        name: "Denotational Semantics",
        code: "",
        lecturer: "Dr Ioannis Markakis",
        hours: 10,
        isModule: false,
        topics: [
          "Complete Partial Orders (CPOs)",
          "Continuous Functions & Fixed Points",
          "Scott Induction & Chain-Closed Subsets",
          "PCF: Syntax & Evaluation",
          "Contextual Equivalence",
          "Denotational Semantics of PCF Types",
          "Denotational Semantics of PCF Terms",
          "Compositionality & Soundness",
          "Computational Adequacy",
          "Full Abstraction & Parallel Or",
        ],
      },
      {
        id: "infotheory",
        name: "Information Theory",
        code: "",
        lecturer: "Dr Robert Harle",
        hours: 12,
        isModule: false,
        topics: [
          "Information, Probability & Shannon Information",
          "Entropy of Discrete Variables",
          "Joint Entropy & Mutual Information",
          "Source Coding Theorem & Data Compression",
          "Huffman Codes & Prefix Property",
          "Asymptotic Equipartition Principle",
          "Binary Symmetric Channels & Noiseless Capacity",
          "Noisy Channel Coding & Error-Correcting Codes",
          "Noisy Channel Coding Theorem",
          "Continuous Entropy & Gaussian Channels",
          "KL Divergence & Cross-Entropy",
          "Applications & Kolmogorov Complexity",
        ],
      },
      {
        id: "texjulia",
        name: "LaTeX and Julia",
        code: "",
        lecturer: "Dr Markus Kuhn",
        hours: 3,
        isModule: false,
        topics: [
          "LaTeX: Document Structure & Typesetting",
          "LaTeX: Maths, Figures & BibTeX",
          "Julia: Scientific Computing Intro",
        ],
      },
      {
        id: "princcomm",
        name: "Principles of Communications",
        code: "",
        lecturer: "Prof Jon Crowcroft",
        hours: 16,
        isModule: false,
        topics: [
          "Introduction & Network Abstractions",
          "Layering & Modular Functionality",
          "Information, Noise & Channel Capacity",
          "Topology & Routing (Graph Theory)",
          "Flow & Congestion Control",
          "End-to-End Protocols & TCP",
          "Shared Media & MAC Protocols",
          "Ethernet & Radio Networks",
          "Switched Networks",
          "QoS, Scheduling & Queue Management",
          "Naming, Addressing & DNS",
          "Security Principles in Networks",
          "Multicast & Overlay Networks",
          "Network Economics & Game Theory",
          "Network Management & Measurement",
          "Review & Advanced Topics",
        ],
      },
      {
        id: "types",
        name: "Types",
        code: "",
        lecturer: "Dr Neel Krishnaswami",
        hours: 12,
        isModule: false,
        topics: [
          "Simply-Typed Lambda Calculus (STLC)",
          "Products, Sums & Pattern Matching",
          "ML Type Inference (Algorithm W)",
          "Polymorphic Lambda Calculus (PLC) — Syntax",
          "PLC — Reduction & Datatypes",
          "PLC — Type Inference",
          "Monads & Effects",
          "References, Recursion & Looping",
          "Continuations & Classical Logic",
          "Continuation-Passing Style",
          "Dependent Types & Indexed Datatypes",
          "Equality Types & Proofs as Programs",
        ],
      },
      {
        id: "agip",
        name: "Advanced Graphics & Image Processing",
        code: "AGIP",
        lecturer: "Dr Rafal Mantiuk",
        hours: 16,
        isModule: true,
        topics: [
          "Image Filtering & Convolution",
          "Edge Detection & Feature Extraction",
          "Colour Spaces & Perception",
          "Tone Mapping & HDR Imaging",
          "Image Segmentation",
          "Texture Synthesis & Analysis",
          "Ray Tracing & Global Illumination",
          "GPU Rendering Pipelines",
        ],
      },
      {
        id: "aai",
        name: "Affective Artificial Intelligence",
        code: "AAI",
        lecturer: "Prof Hatice Gunes",
        hours: 16,
        isModule: true,
        topics: [
          "Affect, Emotion & Sentiment Models",
          "Facial Expression Recognition",
          "Speech & Audio Emotion Analysis",
          "Physiological Signal Processing",
          "Multimodal Affect Recognition",
          "Affective Computing Applications",
          "Ethics in Emotion AI",
          "Generative Models for Affect",
        ],
      },
      {
        id: "cat",
        name: "Category Theory",
        code: "CAT",
        lecturer: "Prof Marcelo Fiore",
        hours: 16,
        isModule: true,
        topics: [
          "IPL in Natural Deduction",
          "Semantics of IPL in a CCC Preorder",
          "STLC & Cartesian Closed Categories",
          "Curry-Howard-Lawvere Correspondence",
          "Functors & Natural Transformations",
          "Adjunctions & Universal Properties",
          "Dependent Types as Adjoint Functors",
          "Presheaves & the Yoneda Lemma",
          "Monads & Computational Lambda Calculus",
        ],
      },
      {
        id: "dsp",
        name: "Digital Signal Processing",
        code: "DSP",
        lecturer: "Dr Markus Kuhn",
        hours: 16,
        isModule: true,
        topics: [
          "Signals, Systems & Convolution",
          "Fourier Series & DFT",
          "Fast Fourier Transform (FFT)",
          "Z-Transform & Transfer Functions",
          "FIR & IIR Filter Design",
          "Windowing & Spectral Leakage",
          "Sampling, Aliasing & Reconstruction",
          "Multirate Processing & Interpolation",
        ],
      },
      {
        id: "mvp",
        name: "Machine Visual Perception",
        code: "MVP",
        lecturer: "Dr Oztireli & Dr Town",
        hours: 12,
        isModule: true,
        topics: [
          "Image Formation & Camera Models",
          "Feature Detection & Matching",
          "Stereo Vision & Depth Estimation",
          "Optical Flow & Motion Estimation",
          "Object Recognition & Classification",
          "Neural Networks for Vision",
        ],
      },
      {
        id: "nlp",
        name: "Natural Language Processing",
        code: "NLP",
        lecturer: "Dr Sun & Dr Chen",
        hours: 15,
        isModule: true,
        topics: [
          "Tokenization & Text Preprocessing",
          "Language Models & N-grams",
          "Word Embeddings (Word2Vec, GloVe)",
          "Sequence Models (RNNs, LSTMs)",
          "Attention Mechanisms & Transformers",
          "Pre-trained Models (BERT, GPT)",
          "Named Entity Recognition & POS Tagging",
          "Machine Translation",
        ],
      },
      {
        id: "hcai",
        name: "Practical Research in Human-centred AI",
        code: "HCAI",
        lecturer: "Prof Blackwell & Dr Sarkar",
        hours: 16,
        isModule: true,
        topics: [
          "Human-Centred AI Principles",
          "User Study Design & Methods",
          "Qualitative & Quantitative Analysis",
          "Interactive ML Systems",
          "Explainability & Interpretability",
          "AI Ethics & Responsible Design",
          "Prototyping AI Interfaces",
          "Research Paper Writing",
        ],
      },
      {
        id: "qct",
        name: "Quantum Complexity Theory",
        code: "QCT",
        lecturer: "Prof Tom Gur",
        hours: 16,
        isModule: true,
        topics: [
          "Review of Classical Complexity",
          "Quantum Circuits & Universality",
          "BQP & Quantum Polynomial Time",
          "Quantum Query Complexity",
          "Grover's Lower Bound",
          "Quantum Communication Complexity",
          "Quantum Interactive Proofs",
          "QMA & Quantum Merlin-Arthur",
        ],
      },
      {
        id: "uqa",
        name: "Understanding Quantum Architecture",
        code: "UQA",
        lecturer: "Dr Prakash Murali",
        hours: 16,
        isModule: true,
        topics: [
          "Qubit Technologies Overview",
          "Quantum Gates & Gate Fidelity",
          "Quantum Error Correction Basics",
          "Surface Codes & Logical Qubits",
          "Quantum Compilation & Mapping",
          "Noise Models & Characterisation",
          "Quantum-Classical Interfaces",
          "Scaling Challenges & NISQ Era",
        ],
      },
    ],
  },
  lent: {
    label: "Lent Term",
    courses: [
      {
        id: "adcomarch",
        name: "Advanced Computer Architecture",
        code: "",
        lecturer: "Dr Robert Mullins",
        hours: 16,
        isModule: false,
        topics: [
          "Introduction, Trends & Fundamentals",
          "Advanced Pipelining",
          "Superscalar Processors",
          "Out-of-Order Execution",
          "Software Approaches to ILP (VLIW)",
          "Instruction Scheduling Techniques",
          "Multithreaded Processors (SMT)",
          "Memory Hierarchy & Caches",
          "Prefetching Techniques",
          "Vector Processors & SIMD",
          "Chip Multiprocessors & Coherence",
          "Cache Coherence Protocols",
          "Synchronization Primitives",
          "On-Chip Interconnection Networks",
          "Special-Purpose Architectures",
          "Converging Approaches to Design",
        ],
      },
      {
        id: "atfp",
        name: "Algebraic Techniques for Programming",
        code: "",
        lecturer: "Dr Neel Krishnaswami",
        hours: 16,
        isModule: false,
        topics: [
          "Algebraic Structures in Programming",
          "Monoids & Semirings",
          "Regular Expressions & Automata",
          "Algebraic Path Problems",
          "Shortest Path via Semirings",
          "Dataflow Analysis Algebraically",
          "Parsing as Algebraic Operations",
          "Advanced Applications",
        ],
      },
      {
        id: "crypto",
        name: "Cryptography",
        code: "",
        lecturer: "Dr Markus Kuhn",
        hours: 16,
        isModule: false,
        topics: [
          "Classic Ciphers & Perfect Secrecy",
          "Stream Ciphers & PRNGs",
          "Semantic Security & Computational Security",
          "Block Ciphers: DES, AES, Feistel",
          "Modes of Operation (ECB, CBC, CTR)",
          "Message Authentication Codes (MACs)",
          "Authenticated Encryption & GCM",
          "Hash Functions & Birthday Attacks",
          "Number Theory: Primes & Modular Arithmetic",
          "Diffie-Hellman Key Exchange",
          "Trapdoor Permutations & RSA",
          "RSA Attacks & OAEP",
          "Digital Signatures (ElGamal, DSA)",
          "Certificates & PKI",
          "Elliptic Curve Cryptography",
          "Quantum-Resistant Cryptography",
        ],
      },
      {
        id: "ecommerce",
        name: "E-Commerce",
        code: "",
        lecturer: "McTavish & Harris",
        hours: 8,
        isModule: false,
        topics: [
          "History of Electronic Commerce",
          "Network Economics & Metcalfe's Law",
          "Business Models & Web Design",
          "Payment Systems & Credit Cards",
          "Auctions & Mechanism Design",
          "Search Engines & Advertising",
          "Data Protection & Privacy Laws",
          "Internet Regulation & Legal Issues",
        ],
      },
      {
        id: "mlbayinfer",
        name: "Machine Learning & Bayesian Inference",
        code: "",
        lecturer: "Dr Sean Holden",
        hours: 16,
        isModule: false,
        topics: [
          "Bayesian Probability & Inference",
          "Naive Bayes & Generative Models",
          "Linear Regression & Regularisation",
          "Logistic Regression & Classification",
          "Kernel Methods & SVMs",
          "Gaussian Processes",
          "Neural Networks & Backpropagation",
          "Expectation-Maximisation (EM)",
          "Mixture Models & Clustering",
          "Dimensionality Reduction (PCA)",
          "Bayesian Model Comparison",
          "Monte Carlo Methods & Sampling",
          "Variational Inference",
          "Graphical Models & Belief Propagation",
          "Decision Theory & PAC Learning",
          "Ensemble Methods & Boosting",
        ],
      },
      {
        id: "optcomp",
        name: "Optimising Compilers",
        code: "",
        lecturer: "Dr Tobias Grosser",
        hours: 16,
        isModule: false,
        topics: [
          "Introduction & Compiler Structure",
          "Flow Graphs & Representations",
          "Peephole Optimisation",
          "Instruction Scheduling",
          "Dataflow Analysis: Live Variables",
          "Dataflow Analysis: Available Expressions",
          "Register Allocation by Colouring",
          "Common Sub-Expression Elimination",
          "Static Single Assignment (SSA) Form",
          "Abstract Interpretation",
          "Strictness Analysis",
          "Control Flow Analysis (Lambda Calculus)",
          "Points-to & Alias Analysis",
          "Instruction Selection (Target-Dependent)",
          "Phase-Order Problem",
          "Decompilation Techniques",
        ],
      },
      {
        id: "quantcomp",
        name: "Quantum Computing",
        code: "",
        lecturer: "Dr Herbert & Dr Murali",
        hours: 16,
        isModule: false,
        topics: [
          "Qubits & Quantum States",
          "Quantum Gates & Circuits",
          "Entanglement & Bell States",
          "Quantum Teleportation",
          "Deutsch-Jozsa Algorithm",
          "Simon's Algorithm",
          "Quantum Fourier Transform",
          "Shor's Algorithm (Period Finding)",
          "Shor's Algorithm (Factoring)",
          "Grover's Search Algorithm",
          "Amplitude Amplification",
          "Quantum Error Correction",
          "Quantum Key Distribution (BB84)",
          "Variational Quantum Algorithms",
          "Quantum Supremacy & NISQ",
          "Adiabatic Quantum Computing",
        ],
      },
      {
        id: "cc",
        name: "Cloud Computing",
        code: "CC",
        lecturer: "Dr Evangelia Kalyvianaki",
        hours: 14,
        isModule: true,
        topics: [
          "Cloud Models & Virtualisation",
          "Containers & Orchestration",
          "Distributed Storage Systems",
          "MapReduce & Spark",
          "Consistency & Replication",
          "Serverless Computing",
          "Auto-Scaling & Resource Management",
        ],
      },
      {
        id: "ce",
        name: "Computing Education",
        code: "CE",
        lecturer: "Dr Sue Sentance",
        hours: 16,
        isModule: true,
        topics: [
          "Theories of Learning in CS",
          "Computational Thinking",
          "Misconceptions & Concept Inventories",
          "Assessment Methods in CS Education",
          "Pedagogy for Programming",
          "Curriculum Design & Policy",
          "Diversity & Inclusion in CS",
          "Research Methods in CS Education",
        ],
      },
      {
        id: "cyc",
        name: "Cybercrime",
        code: "CYC",
        lecturer: "Prof Hutchings, Dr Clayton, Dr Hughes",
        hours: 16,
        isModule: true,
        topics: [
          "Defining Cybercrime & Typologies",
          "Malware & Botnets",
          "Phishing & Social Engineering",
          "Underground Markets & Ecosystems",
          "Denial of Service Attacks",
          "Fraud & Financial Cybercrime",
          "Policing & Regulation",
          "Prevention & Intervention",
        ],
      },
      {
        id: "dnn",
        name: "Deep Neural Networks",
        code: "DNN",
        lecturer: "Dr Huszar, Dr Antonova, Prof Lane",
        hours: 14,
        isModule: true,
        topics: [
          "Deep Learning Foundations & Optimisation",
          "Convolutional Neural Networks",
          "Recurrent Networks & Sequence Models",
          "Attention & Transformer Architectures",
          "Generative Models (VAEs, GANs)",
          "Diffusion Models",
          "Efficient Inference & Model Compression",
        ],
      },
      {
        id: "mh",
        name: "Mobile Health",
        code: "MH",
        lecturer: "Prof Mascolo & Dr Han",
        hours: 16,
        isModule: true,
        topics: [
          "mHealth Systems & Architecture",
          "Wearable Sensing & Physiological Data",
          "Activity Recognition & Context Awareness",
          "Audio & Speech Biomarkers",
          "Mental Health Monitoring",
          "Privacy & Ethics in Health Data",
          "Clinical Validation & Study Design",
          "ML for Health Applications",
        ],
      },
      {
        id: "mrs",
        name: "Mobile Robot Systems",
        code: "MRS",
        lecturer: "Prof Amanda Prorok",
        hours: 16,
        isModule: true,
        topics: [
          "Robot Kinematics & Dynamics",
          "Localisation & SLAM",
          "Path Planning & Motion Planning",
          "Multi-Robot Coordination",
          "Reinforcement Learning for Robotics",
          "Perception & Sensor Fusion",
          "Communication in Robot Teams",
          "Applications & Challenges",
        ],
      },
      {
        id: "msp",
        name: "Multicore Semantics & Programming",
        code: "MSP",
        lecturer: "Prof Sewell & Dr Harris",
        hours: 16,
        isModule: true,
        topics: [
          "Concurrency Models & Shared Memory",
          "Memory Consistency Models (SC, TSO)",
          "Relaxed Memory Models (ARM, POWER)",
          "C/C++ Concurrency & Atomics",
          "Lock-Free Data Structures",
          "Operational Semantics for Concurrency",
          "Verification of Concurrent Programs",
          "Real-World Multicore Challenges",
        ],
      },
    ],
  },
  easter: {
    label: "Easter Term",
    courses: [
      {
        id: "busseminrs",
        name: "Business Studies Seminars",
        code: "",
        lecturer: "McTavish & Harris",
        hours: 4,
        isModule: false,
        topics: [
          "Guest Lectures & Industry Talks",
          "Seminar Discussions & Case Studies",
        ],
      },
      {
        id: "hlogmodc",
        name: "Hoare Logic & Model Checking",
        code: "",
        lecturer: "Banerjee & Katsura",
        hours: 12,
        isModule: false,
        topics: [
          "Hoare Triples & Partial Correctness",
          "Proof Rules for Assignment, Sequence, If",
          "While Rule & Loop Invariants",
          "Total Correctness & Termination",
          "Weakest Preconditions",
          "Arrays & Pointer Reasoning",
          "Separation Logic Basics",
          "Introduction to Model Checking",
          "Temporal Logics (LTL, CTL)",
          "CTL Model Checking Algorithm",
          "Symbolic Model Checking & BDDs",
          "Abstraction & State Space Reduction",
        ],
      },
    ],
  },
};

/** All courses in display order (term only used internally). */
const ALL_COURSES_ORDERED = Object.entries(COURSES_DATA).flatMap(([term, { courses }]) =>
  courses.map((c) => ({ ...c, term }))
);

const getStatusColor = (theory, ppq) => {
  const avg = (theory + ppq) / 2;
  if (avg >= 80) return { bg: "#0a2e1a", border: "#16a34a", text: "#4ade80", label: "Strong" };
  if (avg >= 50) return { bg: "#1a2400", border: "#a3a316", text: "#d4de4a", label: "OK" };
  if (avg >= 20) return { bg: "#2e1f0a", border: "#d97706", text: "#fbbf24", label: "Needs Work" };
  return { bg: "#2e0a0a", border: "#dc2626", text: "#f87171", label: "Critical" };
};

const ProgressBar = ({ value, onChange, color, label }) => {
  const steps = [0, 25, 50, 75, 100];
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
      <span style={{ fontSize: 10, color: "#94a3b8", width: 40, flexShrink: 0, textAlign: "right" }}>{label}</span>
      <div style={{ display: "flex", gap: 2, flex: 1 }}>
        {steps.map((s) => (
          <button
            key={s}
            onClick={() => onChange(s)}
            style={{
              flex: 1,
              height: 8,
              borderRadius: 2,
              border: "none",
              cursor: "pointer",
              background: value >= s ? color : "#1e293b",
              opacity: value >= s ? 1 : 0.4,
              transition: "all 0.2s",
            }}
            title={`${s}%`}
          />
        ))}
      </div>
      <span style={{ fontSize: 10, color, width: 28, flexShrink: 0, textAlign: "right", fontWeight: 600 }}>{value}%</span>
    </div>
  );
};

const LinkChip = ({ url, onRemove }) => {
  let display;
  try {
    display = new URL(url).hostname.replace("www.", "");
  } catch {
    display = url.slice(0, 20);
  }
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        background: "#1e293b",
        borderRadius: 4,
        padding: "2px 6px",
        fontSize: 10,
        color: "#60a5fa",
        maxWidth: 150,
      }}
    >
      <a href={url} target="_blank" rel="noreferrer" style={{ color: "#60a5fa", textDecoration: "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {display}
      </a>
      <button onClick={onRemove} style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", padding: 0, fontSize: 12, lineHeight: 1 }}>×</button>
    </span>
  );
};

const TopicRow = ({ topic, topicIdx, courseId, data, updateTopic }) => {
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [linkVal, setLinkVal] = useState("");
  const td = data || { theory: 0, ppq: 0, links: [] };
  const status = getStatusColor(td.theory, td.ppq);

  const addLink = () => {
    if (linkVal.trim()) {
      updateTopic(courseId, topicIdx, { ...td, links: [...(td.links || []), linkVal.trim()] });
      setLinkVal("");
      setShowLinkInput(false);
    }
  };

  const removeLink = (i) => {
    const nl = [...(td.links || [])];
    nl.splice(i, 1);
    updateTopic(courseId, topicIdx, { ...td, links: nl });
  };

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(0, 1.6fr) 160px 160px 50px minmax(0, 1fr)",
        gap: 8,
        padding: "6px 10px",
        alignItems: "center",
        borderLeft: `3px solid ${status.border}`,
        background: status.bg + "40",
        borderRadius: "0 4px 4px 0",
        transition: "all 0.3s",
      }}
    >
      <span style={{ fontSize: 12, color: "#e2e8f0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={topic}>
        {topic}
      </span>
      <ProgressBar value={td.theory} onChange={(v) => updateTopic(courseId, topicIdx, { ...td, theory: v })} color="#818cf8" label="Theory" />
      <ProgressBar value={td.ppq} onChange={(v) => updateTopic(courseId, topicIdx, { ...td, ppq: v })} color="#f472b6" label="PPQ" />
      <span style={{ fontSize: 9, color: status.text, fontWeight: 700, textAlign: "center", textTransform: "uppercase", letterSpacing: 0.5 }}>{status.label}</span>
      <div style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap", minWidth: 0 }}>
        {(td.links || []).map((l, i) => (
          <LinkChip key={i} url={l} onRemove={() => removeLink(i)} />
        ))}
        {showLinkInput ? (
          <span style={{ display: "inline-flex", gap: 2 }}>
            <input
              value={linkVal}
              onChange={(e) => setLinkVal(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addLink()}
              placeholder="https://..."
              autoFocus
              style={{ width: 120, fontSize: 10, padding: "2px 4px", background: "#0f172a", border: "1px solid #334155", borderRadius: 3, color: "#e2e8f0", outline: "none" }}
            />
            <button onClick={addLink} style={{ fontSize: 10, background: "#1e3a5f", border: "none", color: "#60a5fa", borderRadius: 3, cursor: "pointer", padding: "2px 5px" }}>+</button>
            <button onClick={() => setShowLinkInput(false)} style={{ fontSize: 10, background: "none", border: "none", color: "#64748b", cursor: "pointer", padding: "2px 3px" }}>×</button>
          </span>
        ) : (
          <button
            onClick={() => setShowLinkInput(true)}
            style={{ fontSize: 10, background: "none", border: "1px dashed #334155", color: "#475569", borderRadius: 3, cursor: "pointer", padding: "1px 6px", whiteSpace: "nowrap" }}
          >
            + link
          </button>
        )}
      </div>
    </div>
  );
};

const CourseCard = ({ course, topicData, updateTopic, isExpanded, toggleExpand }) => {
  const topics = course.topics;
  const progress = topics.map((_, i) => {
    const td = topicData?.[`${course.id}_${i}`] || { theory: 0, ppq: 0 };
    return (td.theory + td.ppq) / 2;
  });
  const avg = topics.length ? progress.reduce((a, b) => a + b, 0) / topics.length : 0;
  const status = getStatusColor(avg, avg);
  const theoryAvg = topics.length
    ? topics.reduce((a, _, i) => a + (topicData?.[`${course.id}_${i}`]?.theory || 0), 0) / topics.length
    : 0;
  const ppqAvg = topics.length
    ? topics.reduce((a, _, i) => a + (topicData?.[`${course.id}_${i}`]?.ppq || 0), 0) / topics.length
    : 0;

  return (
    <div
      style={{
        background: "#0f172a",
        border: `1px solid ${isExpanded ? status.border : "#1e293b"}`,
        borderRadius: 8,
        overflow: "hidden",
        transition: "all 0.3s",
      }}
    >
      <button
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
            <span style={{ fontSize: 14, fontWeight: 700, color: "#f1f5f9", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{course.name}</span>
            {course.isModule && <span style={{ fontSize: 9, background: "#1e3a5f", color: "#60a5fa", padding: "1px 5px", borderRadius: 3, fontWeight: 600, flexShrink: 0 }}>MODULE</span>}
            {course.code && <span style={{ fontSize: 9, color: "#64748b", flexShrink: 0 }}>{course.code}</span>}
          </div>
          <div style={{ fontSize: 10, color: "#64748b", marginTop: 2 }}>{course.lecturer} · {course.hours}h · {topics.length} topics</div>
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 10, color: "#818cf8", fontWeight: 600 }}>{Math.round(theoryAvg)}%</div>
          <div style={{ fontSize: 8, color: "#64748b" }}>Theory</div>
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 10, color: "#f472b6", fontWeight: 600 }}>{Math.round(ppqAvg)}%</div>
          <div style={{ fontSize: 8, color: "#64748b" }}>PPQ</div>
        </div>
        <div
          style={{
            width: 48,
            height: 6,
            borderRadius: 3,
            background: "#1e293b",
            overflow: "hidden",
          }}
        >
          <div style={{ height: "100%", width: `${avg}%`, background: `linear-gradient(90deg, ${status.border}, ${status.text})`, borderRadius: 3, transition: "width 0.5s" }} />
        </div>
        <span style={{ fontSize: 16, color: "#475569", transition: "transform 0.2s", transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)" }}>▾</span>
      </button>
      {isExpanded && (
        <div style={{ padding: "0 8px 10px", display: "flex", flexDirection: "column", gap: 3 }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 1.6fr) 160px 160px 50px minmax(0, 1fr)",
              gap: 8,
              padding: "4px 10px",
              fontSize: 9,
              color: "#475569",
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: 0.8,
            }}
          >
            <span>Topic</span>
            <span>Theory Progress</span>
            <span>PPQ Progress</span>
            <span style={{ textAlign: "center" }}>Status</span>
            <span>Resources</span>
          </div>
          {topics.map((t, i) => (
            <TopicRow key={i} topic={t} topicIdx={i} courseId={course.id} data={topicData?.[`${course.id}_${i}`]} updateTopic={updateTopic} />
          ))}
        </div>
      )}
    </div>
  );
};

export default function RevisionTracker() {
  const [topicData, setTopicData] = useState({});
  const [expanded, setExpanded] = useState({});
  const [search, setSearch] = useState("");
  /** Hidden course ids — not shown in the list. New courses default to visible (not in set). */
  const [hiddenCourseIds, setHiddenCourseIds] = useState(() => new Set());
  const [filterType, setFilterType] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [loaded, setLoaded] = useState(false);
  const [coursePickerOpen, setCoursePickerOpen] = useState(false);
  const [pickerSearch, setPickerSearch] = useState("");
  const pickerWrapRef = useRef(null);

  useEffect(() => {
    (async () => {
      const parsed = await loadStoredData();
      if (parsed && typeof parsed === "object") {
        if (parsed.topics != null && typeof parsed.topics === "object") {
          setTopicData(parsed.topics);
          if (Array.isArray(parsed.hiddenIds)) {
            setHiddenCourseIds(new Set(parsed.hiddenIds.filter((id) => ALL_COURSES_ORDERED.some((c) => c.id === id))));
          }
        } else {
          setTopicData(parsed);
        }
      }
      setLoaded(true);
    })();
  }, []);

  useEffect(() => {
    if (!loaded) return;
    persistStoredData({ topics: topicData, hiddenIds: Array.from(hiddenCourseIds) });
  }, [topicData, hiddenCourseIds, loaded]);

  useEffect(() => {
    if (!coursePickerOpen) return;
    const onDoc = (e) => {
      if (pickerWrapRef.current && !pickerWrapRef.current.contains(e.target)) setCoursePickerOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [coursePickerOpen]);

  const updateTopic = useCallback((courseId, topicIdx, val) => {
    setTopicData((prev) => ({ ...prev, [`${courseId}_${topicIdx}`]: val }));
  }, []);

  const toggleExpand = (id) => setExpanded((p) => ({ ...p, [id]: !p[id] }));

  const allCourses = ALL_COURSES_ORDERED;
  const visibleCount = allCourses.length - hiddenCourseIds.size;

  const setCourseHidden = (id, hidden) => {
    setHiddenCourseIds((prev) => {
      const next = new Set(prev);
      if (hidden) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const filtered = allCourses.filter((c) => {
    if (hiddenCourseIds.has(c.id)) return false;
    if (filterType === "module" && !c.isModule) return false;
    if (filterType === "paper" && c.isModule) return false;
    if (search && !c.name.toLowerCase().includes(search.toLowerCase()) && !c.topics.some((t) => t.toLowerCase().includes(search.toLowerCase()))) return false;
    if (filterStatus !== "all") {
      const avg = c.topics.length
        ? c.topics.reduce((a, _, i) => {
            const td = topicData[`${c.id}_${i}`] || { theory: 0, ppq: 0 };
            return a + (td.theory + td.ppq) / 2;
          }, 0) / c.topics.length
        : 0;
      if (filterStatus === "critical" && avg >= 20) return false;
      if (filterStatus === "needs" && (avg < 20 || avg >= 50)) return false;
      if (filterStatus === "ok" && (avg < 50 || avg >= 80)) return false;
      if (filterStatus === "strong" && avg < 80) return false;
    }
    return true;
  });

  const totalTopics = allCourses.reduce((a, c) => a + c.topics.length, 0);
  const totalTheory = allCourses.reduce((a, c) => a + c.topics.reduce((b, _, i) => b + (topicData[`${c.id}_${i}`]?.theory || 0), 0), 0);
  const totalPPQ = allCourses.reduce((a, c) => a + c.topics.reduce((b, _, i) => b + (topicData[`${c.id}_${i}`]?.ppq || 0), 0), 0);
  const overallTheory = totalTopics ? Math.round(totalTheory / totalTopics) : 0;
  const overallPPQ = totalTopics ? Math.round(totalPPQ / totalTopics) : 0;
  const overall = Math.round((overallTheory + overallPPQ) / 2);

  const resetAll = () => {
    if (confirm("Reset all progress? This cannot be undone.")) {
      setTopicData({});
    }
  };

  const pickerCourses = ALL_COURSES_ORDERED.filter((c) => {
    if (!pickerSearch.trim()) return true;
    const q = pickerSearch.toLowerCase();
    return c.name.toLowerCase().includes(q) || c.id.toLowerCase().includes(q);
  });

  if (!loaded) return <div style={{ color: "#64748b", padding: 40, textAlign: "center", fontFamily: "'JetBrains Mono', monospace" }}>Loading...</div>;

  return (
    <div style={{ fontFamily: "'JetBrains Mono', 'SF Mono', 'Fira Code', monospace", background: "#020617", color: "#e2e8f0", minHeight: "100vh", padding: "20px 16px" }}>
      {/* Header */}
      <div style={{ maxWidth: 1100, margin: "0 auto 20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, background: "linear-gradient(135deg, #818cf8, #f472b6)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              Part II CST — Revision Tracker
            </h1>
            <p style={{ fontSize: 10, color: "#475569", margin: "4px 0 0", letterSpacing: 1, textTransform: "uppercase" }}>Cambridge 2025–26 · {allCourses.length} Courses · {totalTopics} Topics</p>
          </div>
          <button onClick={resetAll} style={{ fontSize: 9, background: "none", border: "1px solid #1e293b", color: "#475569", borderRadius: 4, padding: "4px 10px", cursor: "pointer" }}>
            Reset All
          </button>
        </div>

        {/* Stats bar */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginTop: 16 }}>
          {[
            { label: "Overall", value: overall, color: "#a78bfa" },
            { label: "Theory", value: overallTheory, color: "#818cf8" },
            { label: "PPQs", value: overallPPQ, color: "#f472b6" },
          ].map((s) => (
            <div key={s.label} style={{ background: "#0f172a", borderRadius: 6, padding: "10px 14px", border: "1px solid #1e293b" }}>
              <div style={{ fontSize: 9, color: "#64748b", textTransform: "uppercase", letterSpacing: 1 }}>{s.label}</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginTop: 4 }}>
                <span style={{ fontSize: 24, fontWeight: 800, color: s.color }}>{s.value}</span>
                <span style={{ fontSize: 10, color: "#475569" }}>%</span>
              </div>
              <div style={{ height: 4, borderRadius: 2, background: "#1e293b", marginTop: 6, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${s.value}%`, background: s.color, borderRadius: 2, transition: "width 0.5s" }} />
              </div>
            </div>
          ))}
        </div>

        {/* Legend */}
        <div style={{ display: "flex", gap: 12, marginTop: 12, flexWrap: "wrap" }}>
          {[
            { label: "Critical (<20%)", color: "#dc2626" },
            { label: "Needs Work (20-50%)", color: "#d97706" },
            { label: "OK (50-80%)", color: "#a3a316" },
            { label: "Strong (80%+)", color: "#16a34a" },
          ].map((l) => (
            <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <div style={{ width: 8, height: 8, borderRadius: 2, background: l.color }} />
              <span style={{ fontSize: 9, color: "#64748b" }}>{l.label}</span>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap", alignItems: "center" }}>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search courses or topics..."
            style={{ flex: "1 1 200px", maxWidth: 300, fontSize: 11, padding: "6px 10px", background: "#0f172a", border: "1px solid #1e293b", borderRadius: 5, color: "#e2e8f0", outline: "none" }}
          />
          <div ref={pickerWrapRef} style={{ position: "relative" }}>
            <button
              type="button"
              onClick={() => setCoursePickerOpen((o) => !o)}
              style={{
                fontSize: 10,
                padding: "6px 12px",
                background: coursePickerOpen ? "#1e3a5f" : "#0f172a",
                border: "1px solid #1e293b",
                borderRadius: 5,
                color: "#94a3b8",
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              Courses ({visibleCount}/{allCourses.length})
            </button>
            {coursePickerOpen && (
              <div
                style={{
                  position: "absolute",
                  zIndex: 100,
                  top: "100%",
                  left: 0,
                  marginTop: 6,
                  width: 340,
                  maxHeight: 420,
                  display: "flex",
                  flexDirection: "column",
                  background: "#0f172a",
                  border: "1px solid #334155",
                  borderRadius: 8,
                  boxShadow: "0 12px 40px rgba(0,0,0,0.45)",
                  overflow: "hidden",
                }}
                onMouseDown={(e) => e.stopPropagation()}
              >
                <div style={{ padding: "10px 12px", borderBottom: "1px solid #1e293b", fontSize: 10, color: "#94a3b8" }}>
                  Show or hide courses (like Discord channel list). Checked = visible in the tracker.
                </div>
                <input
                  value={pickerSearch}
                  onChange={(e) => setPickerSearch(e.target.value)}
                  placeholder="Search courses…"
                  style={{
                    margin: "8px 12px 0",
                    fontSize: 11,
                    padding: "6px 10px",
                    background: "#020617",
                    border: "1px solid #1e293b",
                    borderRadius: 5,
                    color: "#e2e8f0",
                    outline: "none",
                  }}
                />
                <div style={{ display: "flex", gap: 6, padding: "8px 12px", flexWrap: "wrap" }}>
                  <button
                    type="button"
                    onClick={() => setHiddenCourseIds(new Set())}
                    style={{ fontSize: 9, padding: "4px 8px", background: "#1e293b", border: "none", color: "#94a3b8", borderRadius: 4, cursor: "pointer" }}
                  >
                    Show all
                  </button>
                  <button
                    type="button"
                    onClick={() => setHiddenCourseIds(new Set(allCourses.map((c) => c.id)))}
                    style={{ fontSize: 9, padding: "4px 8px", background: "#1e293b", border: "none", color: "#94a3b8", borderRadius: 4, cursor: "pointer" }}
                  >
                    Hide all
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setHiddenCourseIds((prev) => {
                        const next = new Set(prev);
                        pickerCourses.forEach((c) => next.add(c.id));
                        return next;
                      });
                    }}
                    style={{ fontSize: 9, padding: "4px 8px", background: "#1e293b", border: "none", color: "#94a3b8", borderRadius: 4, cursor: "pointer" }}
                  >
                    Hide filtered
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const keep = new Set(pickerCourses.map((c) => c.id));
                      setHiddenCourseIds(new Set(allCourses.filter((c) => !keep.has(c.id)).map((c) => c.id)));
                    }}
                    style={{ fontSize: 9, padding: "4px 8px", background: "#1e293b", border: "none", color: "#94a3b8", borderRadius: 4, cursor: "pointer" }}
                  >
                    Show only filtered
                  </button>
                </div>
                <div style={{ overflowY: "auto", maxHeight: 260, padding: "4px 8px 12px" }}>
                  {pickerCourses.map((c) => {
                    const visible = !hiddenCourseIds.has(c.id);
                    return (
                      <label
                        key={c.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          padding: "6px 8px",
                          borderRadius: 4,
                          cursor: "pointer",
                          fontSize: 11,
                          color: visible ? "#e2e8f0" : "#64748b",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={visible}
                          onChange={(e) => setCourseHidden(c.id, !e.target.checked)}
                          style={{ cursor: "pointer", accentColor: "#818cf8" }}
                        />
                        <span style={{ flex: 1, minWidth: 0 }}>
                          {c.name}
                          {c.isModule && (
                            <span style={{ marginLeft: 6, fontSize: 8, color: "#60a5fa", fontWeight: 600 }}>MODULE</span>
                          )}
                        </span>
                      </label>
                    );
                  })}
                  {!pickerCourses.length && (
                    <div style={{ padding: 16, textAlign: "center", color: "#64748b", fontSize: 11 }}>No courses match search.</div>
                  )}
                </div>
              </div>
            )}
          </div>
          {[
            { val: filterType, set: setFilterType, opts: [["all", "All Types"], ["paper", "Papers"], ["module", "Modules"]] },
            { val: filterStatus, set: setFilterStatus, opts: [["all", "All Status"], ["critical", "Critical"], ["needs", "Needs Work"], ["ok", "OK"], ["strong", "Strong"]] },
          ].map((f, fi) => (
            <select
              key={fi}
              value={f.val}
              onChange={(e) => f.set(e.target.value)}
              style={{ fontSize: 10, padding: "5px 8px", background: "#0f172a", border: "1px solid #1e293b", borderRadius: 5, color: "#94a3b8", outline: "none", cursor: "pointer" }}
            >
              {f.opts.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          ))}
          <button
            onClick={() => {
              const allOpen = filtered.every((c) => expanded[c.id]);
              setExpanded((p) => {
                const next = { ...p };
                filtered.forEach((c) => (next[c.id] = !allOpen));
                return next;
              });
            }}
            style={{ fontSize: 10, background: "#1e293b", border: "none", color: "#94a3b8", borderRadius: 4, padding: "5px 10px", cursor: "pointer" }}
          >
            {filtered.every((c) => expanded[c.id]) ? "Collapse All" : "Expand All"}
          </button>
        </div>
      </div>

      {/* Course list */}
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {filtered.map((c) => (
            <CourseCard key={c.id} course={c} topicData={topicData} updateTopic={updateTopic} isExpanded={!!expanded[c.id]} toggleExpand={() => toggleExpand(c.id)} />
          ))}
        </div>
        {!filtered.length && (
          <div style={{ textAlign: "center", padding: 40, color: "#475569", fontSize: 12 }}>No courses match your filters.</div>
        )}
      </div>
    </div>
  );
}
