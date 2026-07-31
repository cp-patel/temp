/* ============================================================
   Curriculum metadata: phases, capstone projects, glossary
   ============================================================ */
(function (global) {
  "use strict";

  var C = (global.Curriculum = global.Curriculum || {
    phases: [],
    chapters: [],
    projects: [],
    glossary: [],
  });

  /* ---------------------------------------------------------
     PHASES
     --------------------------------------------------------- */

  C.phases = [
    {
      id: "foundations",
      n: "01",
      icon: "brain",
      hue: 262,
      title: "Foundations — How These Systems Actually Work",
      blurb:
        "The mental model that makes everything else obvious: what a language model is computing, what a token costs you, and why the same prompt gives different answers twice.",
      weeks: "1–2 weeks",
      outcomes: [
        "Explain next-token prediction without hand-waving",
        "Reason about tokens, context windows and cost per request",
        "Choose a model deliberately instead of by vibe",
      ],
    },
    {
      id: "prompting",
      n: "02",
      icon: "chat",
      hue: 224,
      title: "Prompting & Context Engineering",
      blurb:
        "Prompting is the compiler for probabilistic software. Learn the structures that hold up under load — and why 2026's real skill is managing the context window, not writing clever sentences.",
      weeks: "2 weeks",
      outcomes: [
        "Write prompts with a deliberate instruction hierarchy",
        "Force reliable structured output with schemas",
        "Budget a context window like an engineer budgets memory",
      ],
    },
    {
      id: "building",
      n: "03",
      icon: "terminal",
      hue: 194,
      title: "Building Real Applications",
      blurb:
        "From `curl` to a service you'd let a customer touch: streaming, retries, idempotency, conversation state, and the latency/cost tradeoffs that decide whether anyone uses it.",
      weeks: "2–3 weeks",
      outcomes: [
        "Ship a streaming chat backend with proper error handling",
        "Cut cost 5–10× with caching and model routing",
        "Manage multi-turn state without blowing the context window",
      ],
    },
    {
      id: "retrieval",
      n: "04",
      icon: "db",
      hue: 158,
      title: "Retrieval & Knowledge Systems",
      blurb:
        "RAG is the single most-hired-for skill in applied AI, and most implementations are quietly broken. Build one that works, then learn to diagnose one that doesn't.",
      weeks: "3 weeks",
      outcomes: [
        "Build hybrid search with reranking from first principles",
        "Pick a chunking strategy for a real document set",
        "Localise a RAG failure to retrieval, ranking, or generation",
      ],
    },
    {
      id: "agents",
      n: "05",
      icon: "robot",
      hue: 32,
      title: "Tools, Agents & Orchestration",
      blurb:
        "Give a model hands. Tool calling, the agent loop, memory, multi-agent orchestration, MCP — plus the failure modes that make agents feel like magic in a demo and a liability in production.",
      weeks: "3 weeks",
      outcomes: [
        "Design tool schemas a model uses correctly the first time",
        "Implement a bounded agent loop with budgets and guardrails",
        "Know when a workflow beats an agent (usually)",
      ],
    },
    {
      id: "evals",
      n: "06",
      icon: "target",
      hue: 348,
      title: "Evaluation — The Real Moat",
      blurb:
        "The skill that separates people who ship AI from people who demo it. If you learn one phase properly, make it this one: evals are how you turn vibes into engineering.",
      weeks: "2–3 weeks",
      outcomes: [
        "Build an eval set from production traffic in an afternoon",
        "Use LLM-as-judge without fooling yourself",
        "Gate deploys on eval regressions in CI",
      ],
    },
    {
      id: "production",
      n: "07",
      icon: "gauge",
      hue: 300,
      title: "Production Engineering",
      blurb:
        "Observability, deployment, cost control, and the security model for systems where untrusted text is executable. This is where AI engineering becomes plain engineering again.",
      weeks: "2–3 weeks",
      outcomes: [
        "Trace a multi-step request end to end",
        "Defend against prompt injection with architecture, not pleading",
        "Run a p95 latency and unit-cost budget you actually hit",
      ],
    },
    {
      id: "frontier",
      n: "08",
      icon: "rocket",
      hue: 84,
      title: "Frontier, Specialisation & Career",
      blurb:
        "Multimodal systems, fine-tuning decisions, local inference, and a durable system for staying current in a field that reorganises itself every six months.",
      weeks: "2 weeks",
      outcomes: [
        "Decide between prompting, RAG, and fine-tuning with numbers",
        "Build multimodal features that degrade gracefully",
        "Have a portfolio and an interview story that hold up",
      ],
    },
  ];

  /* ---------------------------------------------------------
     CAPSTONE PROJECTS
     --------------------------------------------------------- */

  C.projects = [
    {
      id: "p-classifier",
      phase: "prompting",
      tier: "Warm-up",
      hours: "4–6 hours",
      title: "Structured Extraction Service",
      brief:
        "Turn messy free text — support emails, meeting notes, invoices — into validated JSON. The unglamorous workhorse of applied AI, and the fastest way to internalise structured output and schema design.",
      stack: "Python · Pydantic · any LLM API · pytest",
      proves: "Prompt design, structured output, schema validation, retries",
      tasks: [
        {
          t: "Define a Pydantic model for the target schema with real constraints (enums, ranges, optional fields)",
          ch: "structured-output",
        },
        {
          t: "Pass the schema to the model as a tool definition, not as prose in the prompt",
          ch: "prompt-anatomy",
        },
        {
          t: "Handle refusals and malformed output with a bounded repair loop (max 2 retries)",
          ch: "prompt-failures",
        },
        {
          t: "Write 25 hand-labelled test cases including 5 deliberately adversarial inputs",
          ch: "eval-datasets",
        },
        {
          t: "Measure field-level accuracy, not whole-record accuracy — report per-field precision",
          ch: "eval-metrics",
        },
        {
          t: "Add a confidence field the model must populate, then check whether it correlates with correctness",
          ch: "llm-judge",
        },
      ],
    },
    {
      id: "p-chat",
      phase: "building",
      tier: "Core",
      hours: "10–15 hours",
      title: "Production-Shaped Chat Service",
      brief:
        "A streaming chat backend you would not be embarrassed to put behind a load balancer. This is the project that teaches you that most of AI engineering is ordinary backend engineering done carefully.",
      stack: "FastAPI · SSE · Redis · Docker",
      proves: "Streaming, state management, caching, cost control, resilience",
      tasks: [
        {
          t: "Stream tokens over SSE with correct backpressure and client-disconnect handling",
          ch: "streaming",
        },
        {
          t: "Persist conversation history server-side; never trust the client's copy",
          ch: "conversation-state",
        },
        {
          t: "Implement sliding-window history with a summarise-and-compact step at 70% of context",
          ch: "context-engineering",
        },
        {
          t: "Add prompt caching for the system block and measure the cost delta",
          ch: "resilience",
        },
        {
          t: "Route trivial turns to a small model and hard turns to a large one; log which fired",
          ch: "model-choice",
        },
        {
          t: "Add timeouts, exponential backoff with jitter, and a circuit breaker for provider outages",
          ch: "resilience",
        },
        {
          t: "Expose /metrics with p50/p95 time-to-first-token, tokens per request, and cost per conversation",
          ch: "cost-latency",
        },
      ],
    },
    {
      id: "p-rag",
      phase: "retrieval",
      tier: "Core",
      hours: "15–25 hours",
      title: "RAG System Over Documents You Care About",
      brief:
        "Pick a corpus that matters to you — your company's docs, a codebase, a book collection — and build retrieval that actually answers questions about it. Then prove it works.",
      stack: "Postgres + pgvector (or Qdrant) · BM25 · a reranker · FastAPI",
      proves: "Chunking, hybrid search, reranking, citation, RAG evaluation",
      tasks: [
        {
          t: "Build an ingestion pipeline that preserves document structure and metadata",
          ch: "chunking",
        },
        {
          t: "Compare three chunking strategies on the same 30-question eval set and publish the numbers",
          ch: "chunking",
        },
        {
          t: "Implement hybrid retrieval: BM25 + dense vectors fused with Reciprocal Rank Fusion",
          ch: "hybrid-rerank",
        },
        {
          t: "Add a cross-encoder reranker over the top 50 and measure the recall@5 improvement",
          ch: "hybrid-rerank",
        },
        {
          t: "Force inline citations and add a check that every claim maps to a retrieved chunk",
          ch: "rag-architecture",
        },
        {
          t: "Build a 40-question eval set with graded relevance labels and track faithfulness + answer relevance",
          ch: "eval-datasets",
        },
        {
          t: "Add a 'no answer in corpus' path and test it with 10 unanswerable questions",
          ch: "rag-debug",
        },
      ],
    },
    {
      id: "p-agent",
      phase: "agents",
      tier: "Advanced",
      hours: "20–30 hours",
      title: "Bounded Agent With Real Tools",
      brief:
        "An agent that does something genuinely useful with 4–6 tools, hard budgets, and a trace you can debug. The goal is not autonomy — it is reliability under a spending cap.",
      stack: "Any agent framework or hand-rolled loop · OpenTelemetry · MCP",
      proves: "Tool design, agent loop control, memory, guardrails, tracing",
      tasks: [
        {
          t: "Write 4–6 tools with descriptions written for a model, not a human reader",
          ch: "tool-use",
        },
        {
          t: "Implement the loop yourself once before reaching for a framework",
          ch: "agent-loop",
        },
        {
          t: "Enforce hard budgets: max steps, max tokens, max wall-clock, max spend per run",
          ch: "agent-guardrails",
        },
        {
          t: "Add a tool-result validator so a bad tool response cannot corrupt the trajectory",
          ch: "agent-guardrails",
        },
        {
          t: "Emit an OpenTelemetry trace per run with a span per LLM call and per tool call",
          ch: "observability",
        },
        {
          t: "Expose one tool over MCP and connect it from a second client",
          ch: "mcp",
        },
        {
          t: "Build a 20-case trajectory eval: does it call the right tools in a defensible order?",
          ch: "agent-evals",
        },
        {
          t: "Add a human-approval gate for any irreversible action",
          ch: "agent-guardrails",
        },
      ],
    },
    {
      id: "p-evals",
      phase: "evals",
      tier: "Advanced",
      hours: "12–18 hours",
      title: "Evaluation Harness With CI Gates",
      brief:
        "The portfolio project that gets you hired. Take one of your earlier projects and build the evaluation infrastructure around it that a serious team would expect.",
      stack: "pytest · a judge model · GitHub Actions · a tracing backend",
      proves:
        "Eval design, LLM-as-judge calibration, regression gating, statistics",
      tasks: [
        {
          t: "Assemble 60+ cases: 40 from real or realistic traffic, 20 adversarial edge cases",
          ch: "eval-datasets",
        },
        {
          t: "Write deterministic assertions wherever possible — never grade with a model what code can check",
          ch: "eval-metrics",
        },
        {
          t: "Build an LLM-as-judge with a rubric, few-shot anchors, and a forced structured verdict",
          ch: "llm-judge",
        },
        {
          t: "Calibrate the judge against 40 human labels; report agreement and fix disagreements",
          ch: "llm-judge",
        },
        {
          t: "Run the suite in CI on every PR and fail the build on a statistically meaningful regression",
          ch: "evals-ci",
        },
        {
          t: "Report confidence intervals — a 3-point move on 50 cases is noise, and your harness should say so",
          ch: "eval-metrics",
        },
        {
          t: "Add an online eval that samples 2% of production traffic and alerts on drift",
          ch: "evals-ci",
        },
      ],
    },
    {
      id: "p-ship",
      phase: "production",
      tier: "Capstone",
      hours: "30–50 hours",
      title: "Ship It To Real Users",
      brief:
        "One AI product, deployed, with real users who are not you. Nothing on this roadmap teaches as much as ten strangers using your thing in ways you didn't anticipate.",
      stack: "Your choice — but it must be publicly reachable and observable",
      proves: "Everything. Judgement, prioritisation, and operational nerve.",
      tasks: [
        {
          t: "Pick one narrow problem for one specific person; resist scope creep aggressively",
          ch: "role",
        },
        {
          t: "Deploy behind a real domain with auth, rate limits, and abuse controls",
          ch: "deployment",
        },
        {
          t: "Instrument tracing and cost tracking before launch, not after the first bill",
          ch: "observability",
        },
        {
          t: "Write a threat model for prompt injection and implement the mitigations you chose",
          ch: "prompt-injection",
        },
        {
          t: "Publish a unit-economics table: cost per active user per month, with the arithmetic shown",
          ch: "cost-latency",
        },
        {
          t: "Get 10 people who aren't you to use it, then read every single trace",
          ch: "why-evals",
        },
        {
          t: "Fix the top three failure modes your traces reveal, and add an eval case for each",
          ch: "rag-debug",
        },
        {
          t: "Write a public post-mortem of what broke and what you changed — this is your best interview artefact",
          ch: "interview-prep",
        },
      ],
    },
  ];

  /* ---------------------------------------------------------
     GLOSSARY
     --------------------------------------------------------- */

  C.glossary = [
    {
      t: "Agent",
      d: "An LLM in a loop with tools, where the model decides what to do next rather than following a fixed script. The defining property is model-controlled control flow.",
      n: "If you drew the flowchart in advance, you built a workflow, not an agent — and that's usually the right call.",
      ch: "agent-loop",
    },
    {
      t: "Agentic RAG",
      d: "Retrieval where the model decides whether to search, what to search for, and whether the results were good enough — instead of a single hard-coded retrieval step.",
      n: "Better recall on hard questions, 3–10× the latency and cost. Reach for it when one-shot retrieval measurably fails.",
      ch: "advanced-rag",
    },
    {
      t: "Attention",
      d: "The mechanism that lets a transformer weigh every token against every other token when computing each output. The reason context works at all.",
      n: "Cost scales roughly quadratically with sequence length, which is why long context is expensive.",
      ch: "llm-mental-model",
    },
    {
      t: "BM25",
      d: "A classical lexical ranking function based on term frequency and document length. Still the strongest single baseline for keyword-heavy retrieval.",
      n: "Beats dense embeddings on exact identifiers, error codes, and rare proper nouns. Always in a serious hybrid stack.",
      ch: "hybrid-rerank",
    },
    {
      t: "Chain-of-thought (CoT)",
      d: "Prompting a model to produce intermediate reasoning before its answer, which improves accuracy on multi-step problems.",
      n: "Largely superseded by reasoning models that do this internally — asking them to 'think step by step' can now hurt.",
      ch: "fewshot-reasoning",
    },
    {
      t: "Chunking",
      d: "Splitting documents into retrievable units. The single highest-leverage and most-neglected decision in a RAG pipeline.",
      n: "Chunk on document structure (headings, functions, sections) before falling back to fixed sizes.",
      ch: "chunking",
    },
    {
      t: "Context engineering",
      d: "Deliberately deciding what occupies the context window on each call — instructions, tools, retrieved text, history — and what gets compacted or dropped.",
      n: "The 2026 rebrand of prompt engineering, and a more honest description of the actual work.",
      ch: "context-engineering",
    },
    {
      t: "Context window",
      d: "The maximum number of tokens a model can attend to in one call, covering input and output together.",
      n: "A budget, not a target. Filling it degrades accuracy and inflates cost.",
      ch: "tokens",
    },
    {
      t: "Context rot",
      d: "The measured degradation in retrieval and reasoning accuracy as a context window fills, even well under the advertised limit.",
      n: "Why 'just paste everything in' loses to careful retrieval on long corpora.",
      ch: "tokens",
    },
    {
      t: "Cosine similarity",
      d: "The cosine of the angle between two vectors — the standard similarity measure for embeddings. Ranges from -1 to 1.",
      n: "On normalised vectors, cosine ranking and dot-product ranking are identical.",
      ch: "embeddings",
    },
    {
      t: "Cross-encoder",
      d: "A model that scores a (query, document) pair jointly rather than embedding each separately. Far more accurate, far too slow to run over a whole corpus.",
      n: "The standard reranker: retrieve 50–100 cheaply, then cross-encode those.",
      ch: "hybrid-rerank",
    },
    {
      t: "Distillation",
      d: "Training a small model to imitate a large one's outputs, retaining much of the quality at a fraction of the cost.",
      n: "The usual path to a cheap specialist once a big model has proven the task is solvable.",
      ch: "finetuning-decision",
    },
    {
      t: "Embedding",
      d: "A dense vector representation of text where geometric closeness approximates semantic relatedness.",
      n: "Embeddings encode topical similarity, not truth, recency, or authority — never rank on them alone.",
      ch: "embeddings",
    },
    {
      t: "Eval (evaluation)",
      d: "A repeatable measurement of system quality on a fixed dataset. The unit test of probabilistic software.",
      n: "The clearest signal of AI engineering maturity. Teams with evals ship; teams without them guess.",
      ch: "why-evals",
    },
    {
      t: "Faithfulness",
      d: "Whether a generated answer is actually supported by the retrieved context. The core RAG-specific metric.",
      n: "Distinct from correctness: an answer can be true and still unfaithful, which means your citations are lying.",
      ch: "eval-metrics",
    },
    {
      t: "Few-shot prompting",
      d: "Including worked examples in the prompt to demonstrate the desired format and behaviour.",
      n: "The highest-return prompt technique per token spent. Three good examples beat three paragraphs of instructions.",
      ch: "fewshot-reasoning",
    },
    {
      t: "Fine-tuning",
      d: "Continuing training on your own examples to adjust a model's behaviour, format, or style.",
      n: "Teaches form, not facts. Reach for it after prompting and retrieval plateau — not before.",
      ch: "finetuning-decision",
    },
    {
      t: "Function calling",
      d: "The API mechanism where you declare typed tools and the model returns a structured request to invoke one.",
      n: "Also the most reliable way to get structured output, even when you have no tool to run.",
      ch: "tool-use",
    },
    {
      t: "Grounding",
      d: "Constraining generation to supplied source material so claims can be traced to evidence.",
      n: "The actual product requirement behind most RAG projects.",
      ch: "rag-architecture",
    },
    {
      t: "Guardrail",
      d: "A deterministic check around a model call — input filters, output validators, allow-lists, approval gates.",
      n: "Guardrails are code. If your only guardrail is a sentence in the system prompt, you have none.",
      ch: "agent-guardrails",
    },
    {
      t: "Hallucination",
      d: "Fluent, confident output that is not supported by evidence or fact. A direct consequence of training a model to always produce plausible next tokens.",
      n: "Reducible with retrieval, citation requirements and abstention paths; not eliminable.",
      ch: "llm-mental-model",
    },
    {
      t: "HNSW",
      d: "Hierarchical Navigable Small World — the dominant approximate-nearest-neighbour index. Fast, high recall, memory-hungry.",
      n: "The default choice under roughly 10M vectors.",
      ch: "vector-db",
    },
    {
      t: "Hybrid search",
      d: "Combining lexical (BM25) and dense (embedding) retrieval, usually fused with Reciprocal Rank Fusion.",
      n: "Reliably beats either alone. This should be your starting point, not an optimisation.",
      ch: "hybrid-rerank",
    },
    {
      t: "HyDE",
      d: "Hypothetical Document Embeddings — generate a fake answer to the query, then retrieve using that answer's embedding.",
      n: "Helps when queries are short and documents are verbose. Costs one extra model call.",
      ch: "advanced-rag",
    },
    {
      t: "Idempotency key",
      d: "A client-supplied identifier that lets a server safely deduplicate retried requests.",
      n: "Essential once LLM calls have side effects, because timeouts and retries are routine.",
      ch: "resilience",
    },
    {
      t: "Inference",
      d: "Running a trained model to produce output, as opposed to training it. What you pay for per token.",
      n: "",
      ch: "llm-mental-model",
    },
    {
      t: "KV cache",
      d: "Cached key/value attention tensors for tokens already processed, so a growing conversation doesn't reprocess its whole prefix.",
      n: "The mechanism behind prompt caching and the reason stable prompt prefixes save real money.",
      ch: "local-models",
    },
    {
      t: "Latency (TTFT / TPOT)",
      d: "Time To First Token and Time Per Output Token — the two numbers that determine whether a streaming UI feels fast.",
      n: "Users forgive slow total generation. They don't forgive a slow first token.",
      ch: "streaming",
    },
    {
      t: "LLM-as-judge",
      d: "Using a model to grade another model's output against a rubric.",
      n: "Powerful and dangerous. Calibrate against human labels or you're measuring your judge's biases.",
      ch: "llm-judge",
    },
    {
      t: "MCP",
      d: "Model Context Protocol — an open standard for exposing tools, resources and prompts to AI clients over a uniform interface.",
      n: "Turns the N×M integration problem into N+M. Widely adopted since 2025.",
      ch: "mcp",
    },
    {
      t: "Multi-agent system",
      d: "Several specialised agents coordinating on a task, typically via an orchestrator or a shared task queue.",
      n: "Adds coordination failure modes. Justify it with an eval, not an architecture diagram.",
      ch: "multi-agent",
    },
    {
      t: "Observability",
      d: "The ability to reconstruct what happened inside a request from telemetry — prompts, tool calls, retrievals, retries, tokens, cost.",
      n: "Without traces you cannot debug an AI system. You can only re-roll the dice and hope.",
      ch: "observability",
    },
    {
      t: "Overlap (chunk)",
      d: "Repeating tokens between adjacent chunks so a sentence split across a boundary is still retrievable.",
      n: "10–20% is the usual sweet spot. More is mostly wasted storage.",
      ch: "chunking",
    },
    {
      t: "Prompt caching",
      d: "Providers caching a stable prompt prefix so repeat calls skip recomputation, typically cutting input cost by 75–90% and improving latency.",
      n: "Requires byte-stable prefixes. Put anything volatile — timestamps, user IDs — at the end.",
      ch: "resilience",
    },
    {
      t: "Prompt injection",
      d: "An attack where untrusted content that lands in the context window carries instructions the model follows.",
      n: "Not solvable at the prompt layer. Treat model output as untrusted input and constrain what it can reach.",
      ch: "prompt-injection",
    },
    {
      t: "Quantisation",
      d: "Storing model weights at lower precision (8-bit, 4-bit) to cut memory and increase speed at some quality cost.",
      n: "4-bit quantisation of a large model usually beats full precision of a much smaller one.",
      ch: "local-models",
    },
    {
      t: "RAG",
      d: "Retrieval-Augmented Generation — fetching relevant text at query time and putting it in the context window so the model answers from evidence.",
      n: "The most in-demand applied AI skill, and the most commonly botched.",
      ch: "rag-architecture",
    },
    {
      t: "Recall@k",
      d: "The fraction of relevant documents that appear in the top k retrieved results. The metric that tells you whether retrieval is the bottleneck.",
      n: "Measure it before touching your generation prompt. Most 'bad answers' are retrieval failures.",
      ch: "eval-metrics",
    },
    {
      t: "Reasoning model",
      d: "A model post-trained to spend extra inference compute on internal deliberation before answering.",
      n: "Better on maths, code and multi-step logic; slower and pricier. Wrong tool for extraction and formatting.",
      ch: "fewshot-reasoning",
    },
    {
      t: "Reranker",
      d: "A second-stage model that reorders a retrieved candidate set for precision.",
      n: "Often the single highest-ROI addition to a mediocre RAG system.",
      ch: "hybrid-rerank",
    },
    {
      t: "RRF",
      d: "Reciprocal Rank Fusion — combines multiple ranked lists using 1/(k + rank), requiring no score normalisation.",
      n: "Boringly effective. The standard way to fuse BM25 and dense results.",
      ch: "hybrid-rerank",
    },
    {
      t: "Semantic chunking",
      d: "Splitting text at points where embedding similarity between consecutive sentences drops, rather than at fixed lengths.",
      n: "Sounds better than it usually performs. Beat structural chunking on your own eval set before adopting it.",
      ch: "chunking",
    },
    {
      t: "Streaming",
      d: "Returning tokens as they're generated rather than waiting for the full response.",
      n: "Cuts perceived latency dramatically without making anything actually faster.",
      ch: "streaming",
    },
    {
      t: "Structured output",
      d: "Constraining generation to a schema — usually JSON — so downstream code can parse it safely.",
      n: "Use provider-enforced schema modes. Regex-repairing model JSON is a losing battle.",
      ch: "structured-output",
    },
    {
      t: "System prompt",
      d: "The highest-priority instruction block, set by the developer, that frames every turn of a conversation.",
      n: "Keep it stable and cacheable. Rewriting it per request throws away your prompt cache.",
      ch: "prompt-anatomy",
    },
    {
      t: "Temperature",
      d: "A sampling parameter that flattens or sharpens the token probability distribution. 0 is near-deterministic; higher is more varied.",
      n: "Use 0–0.3 for extraction and classification, 0.7–1.0 for creative work. Never above 1.2 in production.",
      ch: "sampling",
    },
    {
      t: "Token",
      d: "The unit a model reads and writes — roughly 0.75 words in English, and far fewer characters in code or other scripts.",
      n: "Your bill, your context limit, and your latency are all denominated in tokens.",
      ch: "tokens",
    },
    {
      t: "Tool",
      d: "A function you expose to a model with a name, a description, and a typed parameter schema.",
      n: "The description is a prompt. Write it for the model, and include when *not* to use the tool.",
      ch: "tool-use",
    },
    {
      t: "Top-p (nucleus sampling)",
      d: "Sampling only from the smallest set of tokens whose cumulative probability exceeds p.",
      n: "Adjust temperature or top-p, not both. Changing both makes behaviour hard to reason about.",
      ch: "sampling",
    },
    {
      t: "Trajectory eval",
      d: "Evaluating the sequence of steps an agent took, not just its final answer.",
      n: "The right answer reached by a lucky path will break next week. Grade the path.",
      ch: "agent-evals",
    },
    {
      t: "Vector database",
      d: "A store optimised for approximate nearest-neighbour search over embeddings, usually with metadata filtering.",
      n: "Postgres + pgvector is enough for most applications. Reach for a specialist store past ~5–10M vectors.",
      ch: "vector-db",
    },
    {
      t: "Lethal trifecta",
      d: "The dangerous combination of untrusted content, access to private data, and the ability to communicate externally. Any two are usually fine; all three enable exfiltration.",
      n: "The clearest architectural test for agent security. Break one leg of the triangle.",
      ch: "prompt-injection",
    },
  ];
})(window);
