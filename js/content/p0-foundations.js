/* ============================================================
   Phase 01 — Foundations
   ============================================================ */
(function (global) {
  "use strict";
  var C = global.Curriculum;

  C.chapters.push(
    /* ------------------------------------------------------ */
    {
      id: "role",
      phase: "foundations",
      title: "What an AI Engineer Actually Does",
      subtitle:
        "The role is four years old, widely misunderstood, and mostly not about machine learning. Here's the honest job description before you spend six months studying the wrong thing.",
      minutes: 14,
      difficulty: "beginner",
      tags: ["career", "orientation"],
      objectives: [
        "Distinguish AI engineering from ML engineering and data science",
        "Name the five capabilities that actually get people hired",
        "Avoid the two most common wasted-months mistakes",
      ],
      body: [
        {
          t: "p",
          text: "An AI engineer builds **products on top of models someone else trained**. You are not designing architectures or running training jobs. You are doing systems engineering in a new regime where one of your dependencies is non-deterministic, occasionally confident and wrong, and charges you per word.",
        },
        {
          t: "p",
          text: "That sounds like a downgrade from 'real' ML. It isn't — it's a different discipline with its own hard problems, and right now it is where nearly all the demand is. The models are commoditising. The engineering around them is not.",
        },

        { t: "h", text: "The distinction that saves you six months" },
        {
          t: "table",
          head: ["", "ML Engineer", "AI Engineer"],
          rows: [
            ["Core artefact", "A trained model", "A system that calls models"],
            [
              "Typical day",
              "Data pipelines, training runs, feature stores",
              "Prompts, retrieval, tools, evals, latency",
            ],
            [
              "Maths needed",
              "Linear algebra, statistics, optimisation",
              "Enough statistics to read an eval result honestly",
            ],
            [
              "Failure looks like",
              "Model underfits or drifts",
              "Right answer, wrong format, at 9s latency, for $0.40",
            ],
            [
              "Hard part",
              "Getting the model to learn",
              "Getting a good model to behave reliably",
            ],
          ],
        },
        {
          t: "note",
          kind: "pitfall",
          title: "The classic wasted quarter",
          text: "Starting with a deep-learning course. Backpropagation, CNNs, and gradient descent are genuinely interesting and almost entirely irrelevant to shipping an AI product. If you want to build applications, start at the API and work down only when a real problem demands it.",
        },

        { t: "h", text: "What you're actually paid to do" },
        {
          t: "steps",
          items: [
            {
              title: "Decide what the model should see",
              text: "Context engineering: which instructions, which retrieved documents, which conversation history, which tool definitions. This is the majority of the work and the majority of the quality.",
            },
            {
              title: "Make the output usable by code",
              text: "Structured output, schema validation, and a repair path. A correct answer in the wrong shape is a bug.",
            },
            {
              title: "Connect the model to the world",
              text: "Tools, APIs, databases. Then bound what it can do, because a model that can act can act wrongly.",
            },
            {
              title: "Measure whether it works",
              text: "Evals. This is the differentiator. Almost everyone can get a demo working; very few can tell you whether last week's change made things better.",
            },
            {
              title: "Run it at a price that makes sense",
              text: "Latency budgets, caching, model routing, unit economics. A feature that costs more per use than it earns is a science project.",
            },
          ],
        },

        { t: "h", text: "The five capabilities hiring managers screen for" },
        {
          t: "list",
          ordered: true,
          items: [
            "**Retrieval (RAG)** — can you make a model answer from *your* data, with citations, and prove the retrieval is good?",
            "**Tool use and agents** — can you give a model capabilities safely, with budgets and guardrails?",
            "**Evaluation** — can you turn 'it feels better' into a number, and defend the number?",
            "**Production engineering** — tracing, cost, latency, reliability, security. Ordinary skills, unusually rare in this niche.",
            "**Judgement** — knowing when *not* to use an LLM. A regex, a lookup table, or a `WHERE` clause is often the correct answer.",
          ],
        },
        {
          t: "note",
          kind: "insight",
          title: "Why evals are the moat",
          text: "Every team can prototype. The teams that ship reliably are the ones that can answer 'did that change help?' in ten minutes with evidence. It is the least glamorous phase of this roadmap and by far the highest return on your time — which is why it sits at Phase 06 with a dedicated capstone.",
        },

        { t: "h", text: "What you need before starting" },
        {
          t: "list",
          items: [
            "**Python at working proficiency** — functions, classes, `async`, virtualenvs, `pip`. You do not need to be an expert.",
            "**HTTP and JSON** — requests, headers, status codes, streaming responses.",
            "**Git and the command line** — non-negotiable, and unrelated to AI.",
            "**One backend framework** — FastAPI is the de facto standard in this space.",
            "**No maths beyond high school** to start. You'll pick up the statistics you need in the evals phase, where it's motivated.",
          ],
        },
        {
          t: "note",
          kind: "pro",
          title: "How to use this roadmap",
          text: "Read a chapter, do the lab, take the quiz, then build something small before moving on. Reading eight phases without writing code produces the illusion of competence. The projects attached to each phase exist precisely to break that illusion — do at least three of the six.",
        },

        {
          t: "check",
          key: "role-1",
          q: "A product manager asks you to make a support bot answer questions about the company's internal wiki. What is the first thing you should build?",
          options: [
            "A fine-tuned model trained on the wiki",
            "A set of 30 real questions with known-good answers",
            "A vector database ingestion pipeline",
            "A multi-agent system that can browse the wiki",
          ],
          answer: 1,
          why: "Before you build anything, you need to know what 'working' means. Thirty real questions with correct answers takes an afternoon and turns every subsequent decision — chunking, model choice, reranking — into a measurable experiment instead of a guess. Fine-tuning is the wrong tool for injecting facts, and the pipeline and the agent are both premature.",
        },
      ],
      takeaways: [
        "AI engineering is systems engineering around models you didn't train — not machine learning research.",
        "The five hireable capabilities are retrieval, tools/agents, evaluation, production engineering, and judgement.",
        "Evals are the highest-leverage skill in the entire field and the clearest signal of seniority.",
        "Start at the API. Descend into theory only when a concrete problem forces you to.",
        "Knowing when not to use an LLM is a senior skill, not a cop-out.",
      ],
      quiz: [
        {
          q: "Which statement best captures the difference between an ML engineer and an AI engineer?",
          options: [
            "AI engineers work with larger models",
            "ML engineers produce trained models; AI engineers produce systems that call models",
            "AI engineers don't need to write code",
            "ML engineering is deprecated",
          ],
          answer: 1,
          why: "The dividing line is the artefact you own. ML engineers own model training; AI engineers own the system wrapped around a model they consume as a service. Both roles are in demand and both write plenty of code.",
        },
        {
          q: "You have three months to become employable in applied AI. Which allocation is most defensible?",
          options: [
            "Two months of deep learning theory, then one month building",
            "Build applications from week one, adding retrieval, agents, and evals as you go",
            "Read every major paper from the last two years first",
            "Learn CUDA and model-serving internals",
          ],
          answer: 1,
          why: "Applied AI hiring assesses whether you can ship a working, measured system. Building from week one and layering in retrieval, agents, and evaluation produces exactly the portfolio that demonstrates it. Theory, papers, and serving internals are valuable later and rarely the constraint early.",
        },
        {
          q: "Why is 'knowing when not to use an LLM' listed as a core capability?",
          options: [
            "Because LLMs are usually the wrong choice",
            "Because deterministic code is cheaper, faster, and testable when it suffices",
            "Because LLM APIs are unreliable",
            "Because it avoids vendor lock-in",
          ],
          answer: 1,
          why: "When a regex, a SQL query, or a lookup table solves the problem, it does so at microsecond latency, zero marginal cost, and with tests that pass deterministically. Reaching for a model there adds cost, latency, and a new failure mode for no gain. Recognising that boundary is a mark of experience.",
        },
      ],
      cards: [
        {
          f: "What is the core artefact an AI engineer owns?",
          b: "A system that calls models — not a trained model. The work is context engineering, tool integration, evaluation, and production concerns around a model consumed as a service.",
        },
        {
          f: "Name the five capabilities that get AI engineers hired.",
          b: "Retrieval (RAG), tool use and agents, evaluation, production engineering (tracing/cost/latency/security), and judgement about when not to use an LLM.",
        },
        {
          f: "Why are evals considered the highest-leverage AI engineering skill?",
          b: "They convert 'it feels better' into evidence. Without them you cannot tell whether a change helped, so you cannot improve a system reliably — only re-roll and hope.",
        },
      ],
      resources: [
        {
          title: "Anthropic — Building effective agents",
          url: "https://www.anthropic.com/engineering/building-effective-agents",
          kind: "guide",
        },
        {
          title: "OpenAI — A practical guide to building agents",
          url: "https://cdn.openai.com/business-guides-and-resources/a-practical-guide-to-building-agents.pdf",
          kind: "pdf",
        },
      ],
    },

    /* ------------------------------------------------------ */
    {
      id: "backend-delta",
      phase: "foundations",
      title: "What Transfers From Backend Engineering",
      subtitle:
        "If you already ship services, roughly a third of this roadmap is your day job with a stranger dependency. Here's the honest accounting of what carries over, what's new, and where experienced engineers get caught out.",
      minutes: 18,
      difficulty: "beginner",
      tags: ["orientation", "career", "backend"],
      objectives: [
        "Separate what your existing experience already covers from what is genuinely new",
        "Reframe an LLM as a dependency with familiar-but-shifted properties",
        "Recognise the three mistakes experienced engineers make first",
      ],
      body: [
        {
          t: "p",
          text: 'The most common framing of this transition is wrong in both directions. It is not "learn machine learning" — you won\'t be training anything. But it is also not "just call an API" — if it were, the field wouldn\'t have a hiring shortage. The accurate framing is narrower and more useful: **you are adding one unreliable, expensive, non-deterministic dependency to systems you already know how to build**, and almost all the new skill is in managing that dependency\'s peculiarities.',
        },

        { t: "h", text: "What transfers directly" },
        {
          t: "p",
          text: "This is not a token courtesy. Measured against the full roadmap, this column is a large fraction of the work — which is why an experienced backend engineer can reach employable competence in months rather than years.",
        },
        {
          t: "table",
          head: ["You already do", "Where it shows up"],
          rows: [
            [
              "HTTP APIs, SDKs, error taxonomies",
              "Every model call. The retry/terminal distinction is the same reasoning.",
            ],
            [
              "Retries, backoff, jitter, circuit breakers",
              "Provider outages and 429s are routine, not exceptional.",
            ],
            [
              "Idempotency keys with atomic claims",
              "Mandatory once a model call has side effects.",
            ],
            [
              "Caching and invalidation",
              "Prompt caching and response caching — same instincts, new key semantics.",
            ],
            [
              "Postgres, indexes, query plans",
              "pgvector is the right default vector store. Your tuning intuition mostly holds.",
            ],
            [
              "Tracing, spans, percentiles",
              "Multi-step LLM requests are unreadable without a trace tree.",
            ],
            [
              "Containers, canaries, rollback",
              "Prompts become deployable artefacts with the same lifecycle.",
            ],
            [
              "Automated tests and CI gates",
              "Eval suites are regression suites with fuzzy assertions.",
            ],
            [
              "Authz and least privilege",
              "The only defence that actually holds against prompt injection.",
            ],
            [
              "Queues and background jobs",
              "Compaction, evals, ingestion, and any task over ~30 seconds.",
            ],
            [
              "Cost/capacity modelling",
              "Unit economics decide whether an AI feature is a product.",
            ],
            ["SSE and streaming", "Every user-facing generation."],
          ],
        },
        {
          t: "note",
          kind: "insight",
          title: "The reframe that makes everything click",
          text: "Think of the model as an RPC call to a service that is **slow** (hundreds of ms to seconds), **expensive** (priced per word, in and out), **non-deterministic** (same input, different output), **stateless but charged cumulatively** (you resend the whole conversation every time), and **occasionally confidently wrong in ways that return HTTP 200**. Every one of those properties has a familiar engineering response. It is the *combination* — especially the last one — that needs new technique.",
        },

        { t: "h", text: "What is genuinely new" },
        {
          t: "table",
          head: ["New skill", "Why your existing experience doesn't cover it"],
          rows: [
            [
              "**Context engineering**",
              "There is no analogue. Deciding what occupies a finite, expensive, quality-degrading input window is a novel resource-allocation problem.",
            ],
            [
              "**Retrieval quality**",
              "You may know search. You probably don't know chunking strategy, why negation breaks embeddings, or how to localise a bad answer to one pipeline stage.",
            ],
            [
              "**Evaluation of non-deterministic output**",
              "Your test suite asserts equality. Here you assert on structure, semantics, and *statistical* properties — and you need confidence intervals to avoid chasing noise.",
            ],
            [
              "**Agent control flow**",
              "Control flow decided at runtime by a model, with budgets on five axes and failure modes (goal drift, thrashing) that have no classical equivalent.",
            ],
            [
              "**Prompt injection**",
              "You know injection classes — but there is **no parameterisation**. Instructions and data share one channel. The fix is architectural, not sanitisation.",
            ],
            [
              "**Token economics**",
              "Cost scales with conversation length in a way request-count-based intuition gets badly wrong.",
            ],
          ],
        },

        { t: "h", text: "Three mistakes experienced engineers make first" },
        {
          t: "steps",
          items: [
            {
              title: "1. Reaching for abstraction too early",
              text: "The instinct to wrap the provider in a framework before understanding the primitives is strong and counterproductive. Frameworks hide exactly the features that matter — prompt caching semantics, schema-enforced output, thinking controls. Write the tool loop by hand once. It's about forty lines, and you'll know what every framework is doing for you and what it's costing you.",
            },
            {
              title: "2. Trusting a test suite that can't fail usefully",
              text: "Snapshot-testing model output feels rigorous and is a trap: it flakes on a Tuesday for reasons you cannot act on, so people delete the assertions. Non-deterministic systems need property-based and statistical assertions from day one, and a regression suite you gate deploys on. Phase 06 exists for this and it is the phase that decides interviews.",
            },
            {
              title: "3. Treating the prompt as configuration",
              text: "It looks like a config string, so it ends up in a database that non-engineers edit live. It is the primary determinant of behaviour — closer to source code than to a feature flag. Put prompts in git, version them, gate them on evals, and canary them on quality metrics, because a prompt regression returns HTTP 200 and no infrastructure metric will catch it.",
            },
          ],
        },
        {
          t: "note",
          kind: "pitfall",
          title: "The specific trap of a strong backend background",
          text: "You will be tempted to spend your time on the parts you're already good at — the service architecture, the caching layer, the deployment pipeline — because that work is comfortable and visibly productive. Those parts are largely solved by what you already know. The hard, uncomfortable, differentiating work is retrieval quality and evaluation. Budget your time accordingly, even though it will feel slower.",
        },

        { t: "h", text: "Your unfair advantages" },
        {
          t: "list",
          items: [
            "**You instrument by reflex.** Most people building AI features have no traces and cannot debug their own systems. You'll have tracing before your first bug.",
            "**You think in percentiles.** The habit of asking for p95 rather than an average transfers directly and is unusually valuable here, because LLM latency and cost distributions are heavily skewed.",
            "**You already distrust input.** The mental move from 'never trust user input' to 'never trust model output, and never trust retrieved text' is short.",
            "**You know what production means.** Rate limits, quota headroom, graceful degradation, load shedding — the operational maturity that AI-first teams frequently lack.",
            "**You can read a failure.** Localising a fault to a component is the core skill in RAG debugging, and it's a skill, not knowledge.",
          ],
        },

        { t: "h", text: "How to sequence this with a job" },
        {
          t: "p",
          text: "Reported timelines for this transition cluster around three to six months of part-time study, and that matches the structure here. A plausible allocation at 8–10 hours a week:",
        },
        {
          t: "table",
          head: ["Weeks", "Focus", "Deliverable"],
          rows: [
            [
              "1–2",
              "Foundations, skimming what you know",
              "Cost model spreadsheet for a feature you'd actually build",
            ],
            [
              "3–5",
              "Prompting and context engineering",
              "A structured-extraction service with 25 test cases",
            ],
            [
              "6–7",
              "Application phase — skim, then build",
              "Streaming chat service with caching and routing",
            ],
            [
              "8–11",
              "**Retrieval.** Do not rush this one.",
              "RAG over a corpus you care about, with measured recall",
            ],
            [
              "12–14",
              "Agents and tools",
              "A bounded agent with tracing and budgets",
            ],
            [
              "15–17",
              "**Evaluation.** The differentiator.",
              "Eval harness with CI gates and a calibrated judge",
            ],
            [
              "18–20",
              "Production, security, ship it",
              "Something deployed, with real users and a public write-up",
            ],
          ],
        },
        {
          t: "note",
          kind: "pro",
          title: "Use the plan generator",
          text: "The **My Plan** page turns this into a concrete week-by-week schedule from your actual available hours, and annotates every chapter with what you can skim versus what's new for you. It reads the same skill claims you set during onboarding, so if your background shifts, regenerate it.",
        },

        {
          t: "check",
          key: "bd-1",
          q: "You've built a RAG prototype and want to make it production-grade. Your instinct is to add a Redis cache, a proper DI container, and a retry layer. What's the problem with that plan?",
          options: [
            "Those are the wrong technologies for AI systems",
            "It spends your time on solved problems while retrieval quality and evaluation — the actual differentiators — go unmeasured",
            "Caching breaks non-deterministic systems",
            "You should use a framework instead",
          ],
          answer: 1,
          why: "Every item on that list is something you already know how to do well, and none of it makes the answers better. The uncomfortable questions — is the right chunk being retrieved, does the answer stay faithful to it, did last week's prompt change help — are where the value and the difficulty are. Build the 30-question eval set first; it will tell you whether the caching layer is even on the critical path.",
        },
      ],
      takeaways: [
        "An LLM is a slow, expensive, non-deterministic dependency that can fail while returning HTTP 200.",
        "Your API, reliability, caching, database, observability, deployment, and testing skills transfer directly.",
        "Genuinely new: context engineering, retrieval quality, statistical evaluation, agent control flow, injection, token economics.",
        "Resist abstraction, snapshot tests, and prompts-as-config — the three traps of a strong backend background.",
        "Spend your time on retrieval and evaluation even though the infrastructure work feels more productive.",
      ],
      quiz: [
        {
          q: "Which existing backend skill is the strongest defence against prompt injection?",
          options: [
            "Input sanitisation",
            "Least-privilege authorisation enforced in code at the tool boundary",
            "Rate limiting",
            "TLS everywhere",
          ],
          answer: 1,
          why: "Injection cannot be parameterised away, so the defence is limiting what a compromised instruction can reach. Scoping every tool query to the authenticated session, and granting the narrowest possible credentials, means the model can be fully persuaded and still be unable to touch another tenant's data. Sanitisation — the reflex from SQL injection — is the weakest mitigation here.",
        },
        {
          q: "Why is snapshot-testing LLM output a trap?",
          options: [
            "Snapshots are too large to store",
            "Output is not byte-reproducible even at temperature 0, so the test flakes for reasons you cannot act on and eventually gets deleted",
            "Snapshots don't work with async code",
            "It's too slow for CI",
          ],
          answer: 1,
          why: "GPU float non-associativity, variable batch composition, and mixture-of-experts routing all mean identical requests can produce different bytes. A test that fails unpredictably and unactionably trains the team to ignore or remove it — which is worse than not having written it. Assert on structure, semantics, and properties instead.",
        },
        {
          q: "What's the strongest reason to keep prompts in git rather than a live-editable database?",
          options: [
            "Database reads are slower",
            "A prompt is the primary determinant of behaviour, so live editing is deploying untested code with no review, diff, or rollback",
            "Prompts contain secrets",
            "Version control compresses better",
          ],
          answer: 1,
          why: "Prompts behave like source, not configuration. Putting them in git gives you review, eval gating, canary rollout, a change record, and a revert path — all of which you already expect for anything that changes behaviour. The extra sting is that a prompt regression returns HTTP 200, so without those controls you find out from users.",
        },
        {
          q: "Which is the most consequential difference from a conventional API dependency?",
          options: [
            "It's slower",
            "It's stateless but billed cumulatively, so cost grows with roughly the square of conversation turns",
            "It requires an API key",
            "It returns JSON",
          ],
          answer: 1,
          why: "There is no server-side conversation, so turn 20 resends all 19 previous turns as input. Request-count-based cost intuition is badly wrong here, and this single property is what makes compaction and prompt caching load-bearing rather than optimisations.",
        },
      ],
      cards: [
        {
          f: "Reframe an LLM as a dependency: what are its five properties?",
          b: "Slow (100s ms–seconds), expensive (priced per word in and out), non-deterministic (same input, different output), stateless but billed cumulatively (resend whole history), and able to fail while returning HTTP 200.",
        },
        {
          f: "Which backend skills transfer directly to AI engineering?",
          b: "APIs and error taxonomies, retries/backoff/circuit breakers, idempotency, caching, relational databases, tracing and percentiles, deployment and canaries, testing and CI, authz/least privilege, queues, cost modelling, streaming.",
        },
        {
          f: "What's genuinely new (not covered by backend experience)?",
          b: "Context engineering, retrieval quality, statistical evaluation of non-deterministic output, agent control flow with multi-axis budgets, prompt injection (no parameterisation possible), and token economics.",
        },
        {
          f: "Name the three traps of a strong backend background.",
          b: "1) Abstracting over the provider before learning the primitives. 2) Snapshot-testing model output. 3) Treating the prompt as configuration rather than source code.",
        },
      ],
      resources: [
        {
          title: "Zen van Riel — Backend developer to AI engineer",
          url: "https://zenvanriel.com/ai-engineer-blog/backend-developer-to-ai-engineer-transition/",
          kind: "article",
        },
        {
          title: "Anthropic — Building effective agents",
          url: "https://www.anthropic.com/engineering/building-effective-agents",
          kind: "guide",
        },
      ],
    },

    /* ------------------------------------------------------ */
    {
      id: "llm-mental-model",
      phase: "foundations",
      title: "How LLMs Actually Work",
      subtitle:
        "You need exactly enough theory to predict how the system will fail. That's about fifteen minutes of reading — and it explains almost every strange behaviour you'll hit later.",
      minutes: 20,
      difficulty: "beginner",
      tags: ["theory", "mental-model"],
      objectives: [
        "Explain next-token prediction and why it produces hallucinations",
        "Describe what attention buys you and what it costs",
        "Predict which task types a model will struggle with, and why",
      ],
      body: [
        {
          t: "p",
          text: "A large language model computes one thing: **a probability distribution over the next token**, given all the tokens so far. Everything else — chat, code generation, reasoning, tool calls — is that single operation, run in a loop, with the output appended to the input each time.",
        },
        {
          t: "flow",
          nodes: [
            { b: "Your text", s: "prompt", c: "accent" },
            { b: "Tokenise", s: "→ integers" },
            { b: "Embed", s: "→ vectors" },
            { b: "N × transformer", s: "attention + MLP", c: "cyan" },
            { b: "Logits", s: "score per token" },
            { b: "Sample", s: "pick one", c: "amber" },
          ],
          cap: "One forward pass produces exactly one token. Then the whole thing runs again with that token appended.",
        },
        {
          t: "note",
          kind: "insight",
          title: "The consequence that explains everything",
          text: "There is no separate 'facts' module and no truth check anywhere in this loop. The model is trained to make plausible continuations. A confident, fluent, wrong answer is not a malfunction — it is the system working exactly as designed on input where the plausible continuation happens to be false.",
        },

        { t: "h", text: "Attention, in one paragraph" },
        {
          t: "p",
          text: "Each transformer layer lets every token look at every other token and pull in what's relevant. A pronoun can attend to the noun it refers to; a closing brace can attend to its opening brace; an instruction at the top can influence a token 4,000 positions later. This is why context works at all, and why models are so good at pattern-matching within a single prompt.",
        },
        {
          t: "p",
          text: "The cost: attention compares every token against every other token, so compute grows roughly with the *square* of sequence length. Doubling your prompt does not double the work — it roughly quadruples part of it. Every long-context feature is fighting this curve, and it's why providers price input tokens the way they do.",
        },

        { t: "h", text: "In-context learning is not learning" },
        {
          t: "p",
          text: "When you paste three examples into a prompt and the model suddenly follows your format, nothing was learned. No weights changed. The examples simply made the desired continuation the most probable one. Close the session and it's gone.",
        },
        {
          t: "compare",
          left: {
            title: "In-context (prompting)",
            kind: "good",
            items: [
              "Instant, free, reversible",
              "Per-request, per-user customisable",
              "Costs tokens on every single call",
              "Bounded by the context window",
            ],
          },
          right: {
            title: "Fine-tuning",
            kind: "bad",
            items: [
              "Changes weights permanently",
              "No per-call token cost for the behaviour",
              "Hours to days, needs a labelled dataset",
              "Teaches form and style, not facts",
            ],
          },
        },

        {
          t: "h",
          text: "Training: three stages that explain three behaviours",
        },
        {
          t: "steps",
          items: [
            {
              title: "Pretraining — next-token prediction on a huge corpus",
              text: "Produces raw capability: grammar, world knowledge, code idioms, reasoning patterns. Also produces a model that will happily continue your text rather than answer your question.",
            },
            {
              title: "Supervised fine-tuning — instruction following",
              text: "Trained on curated (instruction, good response) pairs. This is what turns a text-continuation engine into something that responds to requests.",
            },
            {
              title: "Preference optimisation (RLHF / DPO and successors)",
              text: "Trained on human or AI comparisons of two responses. This is where helpfulness, refusal behaviour, formatting habits, and the characteristic 'assistant voice' come from. It's also where sycophancy creeps in: agreeable answers get preferred.",
            },
          ],
        },
        {
          t: "note",
          kind: "pro",
          title: "Debugging tip that pays for itself",
          text: "When a model behaves oddly, ask which stage the behaviour comes from. Won't follow your format? An instruction-following problem — restructure the prompt or add examples. Confidently wrong about a fact? A pretraining-knowledge gap — retrieve the fact. Agreeing with your obviously wrong premise? That's preference training — ask it to critique instead of confirm.",
        },

        { t: "h", text: "What the architecture predicts about failures" },
        {
          t: "table",
          head: ["The model struggles with", "Because"],
          rows: [
            [
              "Exact character counts, reversing strings",
              "It sees tokens, not letters. 'strawberry' is a few opaque chunks, not nine characters.",
            ],
            [
              "Precise arithmetic on large numbers",
              "Digits are tokenised in groups and there's no ALU. It pattern-matches arithmetic rather than computing it.",
            ],
            [
              "Knowing what it doesn't know",
              "Nothing in training rewards calibrated uncertainty over a fluent guess.",
            ],
            [
              "Facts after its cutoff",
              "Weights are frozen at training time. This is exactly what retrieval fixes.",
            ],
            [
              "Recall from the middle of a very long context",
              "Attention degrades over distance and volume — the 'lost in the middle' effect.",
            ],
            [
              "Truly novel multi-step logic",
              "It's interpolating over patterns it has seen. Reasoning models improve this markedly but don't eliminate it.",
            ],
          ],
        },
        {
          t: "note",
          kind: "pitfall",
          title: "Don't over-index on the trivia failures",
          text: "'It can't count the r's in strawberry' is a tokenisation artefact, not evidence that the model can't reason. Judge a model on the tasks you actually need, with your own eval set. Viral failure examples are entertaining and almost never predictive of performance on your workload.",
        },

        {
          t: "check",
          key: "mm-1",
          q: "Your model confidently cites a research paper that doesn't exist. What is the correct diagnosis?",
          options: [
            "The model is broken and needs retraining",
            "Temperature is too high",
            "The model produced the most plausible continuation, and plausible citations look exactly like real ones",
            "The context window overflowed",
          ],
          answer: 2,
          why: "Citation strings have extremely regular structure — author, year, plausible title, plausible venue. Generating a well-formed fake one is precisely what next-token prediction does well. Lowering temperature makes the fake more deterministic, not more real. The fix is architectural: retrieve real sources and require the model to cite only from what it was given.",
        },
      ],
      takeaways: [
        "An LLM computes a probability distribution over the next token, in a loop. There is no truth check in that loop.",
        "Hallucination is a structural consequence of plausibility-maximisation, not a bug to be patched away.",
        "Attention is why context works and why long context is expensive — cost scales roughly quadratically.",
        "In-context learning changes no weights; it changes what continuation is most probable.",
        "Map each odd behaviour to a training stage — pretraining, instruction tuning, or preference tuning — and the fix follows.",
      ],
      quiz: [
        {
          q: "Why does a model fail at counting letters in a word?",
          options: [
            "Its context window is too small",
            "It processes tokens, which are multi-character chunks, not individual letters",
            "It wasn't trained on spelling",
            "Temperature introduces randomness",
          ],
          answer: 1,
          why: "Tokenisation is the whole story. The model receives opaque integer IDs representing chunks of several characters, so character-level operations require it to have memorised spellings rather than inspect them. This is an input-representation limit, not a reasoning limit.",
        },
        {
          q: "You paste 5 examples into a prompt and the model adopts your format. What happened?",
          options: [
            "The model was fine-tuned on your examples",
            "The examples made your desired output the most probable continuation; no weights changed",
            "The examples were cached into the model's memory",
            "The model learned permanently and will remember next session",
          ],
          answer: 1,
          why: "This is in-context learning. The examples condition the probability distribution for this call only. Nothing persists — start a fresh conversation and the behaviour is gone, which is exactly why you resend the examples every time and pay for them in tokens.",
        },
        {
          q: "Which failure is best fixed with retrieval rather than prompting?",
          options: [
            "The model returns prose when you asked for JSON",
            "The model doesn't know your company's Q3 revenue",
            "The model's tone is too casual",
            "The model agrees with a false premise you stated",
          ],
          answer: 1,
          why: "Missing facts are a knowledge problem, and knowledge lives outside the frozen weights. Retrieval puts the fact in the context window where the model can use it. Format, tone, and sycophancy are all behavioural and respond to prompt structure, examples, or explicit critique instructions.",
        },
        {
          q: "Why is prompt cost roughly super-linear in prompt length?",
          options: [
            "Providers charge a penalty for long prompts",
            "Attention compares every token pair, so compute grows with roughly the square of sequence length",
            "Longer prompts need more layers",
            "Tokenisation slows down on long inputs",
          ],
          answer: 1,
          why: "Self-attention is quadratic in sequence length for the attention computation itself. That physical cost — not a pricing policy — is why long-context calls are expensive and why careful retrieval beats dumping an entire corpus into the window.",
        },
      ],
      cards: [
        {
          f: "What single operation does an LLM perform?",
          b: "It computes a probability distribution over the next token given all previous tokens, then samples one. Everything else is that loop with output appended to input.",
        },
        {
          f: "Why is hallucination structural rather than a bug?",
          b: "The model is optimised to produce plausible continuations, and there is no truth-checking step anywhere in the loop. A fluent falsehood is a well-formed output of the objective it was trained on.",
        },
        {
          f: "What does attention cost you?",
          b: "Compute grows roughly quadratically with sequence length because every token is compared with every other token. Doubling prompt length more than doubles the work.",
        },
        {
          f: "Which training stage produces sycophancy?",
          b: "Preference optimisation (RLHF/DPO). Human raters tend to prefer agreeable responses, so agreeableness gets reinforced. Counter it by asking the model to critique rather than confirm.",
        },
      ],
      resources: [
        {
          title: "The Illustrated Transformer",
          url: "https://jalammar.github.io/illustrated-transformer/",
          kind: "article",
        },
        {
          title: "3Blue1Brown — But what is a GPT?",
          url: "https://www.3blue1brown.com/lessons/gpt",
          kind: "video",
        },
        {
          title: "Attention Is All You Need (original paper)",
          url: "https://arxiv.org/abs/1706.03762",
          kind: "paper",
        },
      ],
    },

    /* ------------------------------------------------------ */
    {
      id: "tokens",
      phase: "foundations",
      title: "Tokens, Context & the Economics",
      subtitle:
        "Tokens are the unit of your bill, your latency, and your context limit. Engineers who develop a feel for token counts make consistently better architecture decisions.",
      minutes: 22,
      difficulty: "beginner",
      tags: ["tokens", "cost", "context"],
      lab: "tokenizer",
      objectives: [
        "Estimate token counts for text, code, and non-English input",
        "Compute the cost of a feature before building it",
        "Explain context rot and why a bigger window isn't a bigger brain",
      ],
      body: [
        {
          t: "p",
          text: "Models don't read characters or words. Text is split by a **tokeniser** into subword units, each mapped to an integer. Common words become single tokens; rare words fragment; whitespace usually attaches to the following word.",
        },
        { t: "lab", id: "tokenizer" },
        { t: "h", text: "Rules of thumb worth memorising" },
        {
          t: "table",
          head: ["Content", "Tokens per unit", "Note"],
          rows: [
            [
              "English prose",
              "~1 token ≈ 4 characters ≈ 0.75 words",
              "The number everyone quotes. Good to ±15%.",
            ],
            [
              "Code",
              "~1 token ≈ 3 characters",
              "Punctuation, indentation and identifiers fragment heavily.",
            ],
            [
              "JSON",
              "~1.4× the equivalent prose",
              "Braces, quotes and keys all cost. Structure isn't free.",
            ],
            [
              "Non-Latin scripts",
              "2–4× worse than English",
              "A Hindi or Japanese sentence can cost triple its English translation.",
            ],
            [
              "Long numbers, UUIDs, hashes",
              "Very poor",
              "Digits group in small runs; random strings fragment per character.",
            ],
          ],
        },
        {
          t: "note",
          kind: "warn",
          title: "The non-English cost multiplier is a real product decision",
          text: "If your users write in Hindi, Thai, or Japanese, the same message can cost 2–4× more than its English equivalent and consume the context window that much faster. Budget for it explicitly rather than discovering it in a bill, and test your context-management logic in the worst-case language you support.",
        },

        { t: "h", text: "The context window is a budget, not a target" },
        {
          t: "p",
          text: "A million-token window does not mean you should send a million tokens. Two forces push the other way.",
        },
        {
          t: "list",
          ordered: true,
          items: [
            "**Cost and latency scale with what you send.** Every token in every call, forever.",
            "**Accuracy degrades as the window fills.** Retrieval and reasoning quality measurably drop well before the advertised limit — commonly called *context rot*, with the related *lost in the middle* effect where information buried mid-prompt gets ignored.",
          ],
        },
        {
          t: "note",
          kind: "insight",
          title: "The counter-intuitive result",
          text: "Careful retrieval of 4,000 relevant tokens routinely beats dumping 200,000 mostly-irrelevant ones — cheaper, faster, *and* more accurate. Long context is a convenience for prototyping and a crutch in production. When someone says long context killed RAG, ask to see their eval numbers on a corpus that doesn't fit in the window.",
        },

        { t: "h", text: "Arithmetic you should be able to do in your head" },
        {
          t: "p",
          text: "Providers price input and output tokens separately, and output is typically 3–5× the input rate. Let's cost a plausible support-bot feature. Take input at $3 per million tokens and output at $15 per million — mid-tier pricing in 2026 terms; substitute your provider's actual numbers.",
        },
        {
          t: "code",
          lang: "text",
          caption: "Per-request cost, worked out",
          code: `System prompt + tools     1,200 tok
Retrieved context (5 chunks) 2,500 tok
Conversation history        1,800 tok
User message                  120 tok
                        -------------
INPUT                       5,620 tok  ->  5,620/1e6 * $3  = $0.0169
OUTPUT (answer)               400 tok  ->    400/1e6 * $15 = $0.0060
                        -------------
Per request                                              ~= $0.0229

10,000 requests/day  ->  $229/day  ->  ~$6,870/month`,
        },
        {
          t: "p",
          text: "Now apply two optimisations. Prompt caching on the stable 1,200-token system block cuts that portion by roughly 90% on cache hits. Routing the 60% of turns that are trivial to a small model cuts their cost by ~10×. Both are covered properly in Phase 03.",
        },
        {
          t: "code",
          lang: "text",
          caption: "Same feature, engineered",
          code: `Cached system block   1,200 tok @ ~10% rate  = $0.0004
Fresh input           4,420 tok                 = $0.0133
Output                  400 tok                 = $0.0060
                                            ------------
Hard turns (40%)                             ~= $0.0197
Easy turns (60%), small model                ~= $0.0021

Blended per request                          ~= $0.0091
10,000 requests/day  ->  ~$2,730/month  (60% saved)`,
        },
        {
          t: "note",
          kind: "money",
          title: "Do this before you write code, not after",
          text: "Ten minutes of this arithmetic at design time regularly changes the architecture — it tells you whether you can afford retrieval, how many agent steps fit in budget, and whether the feature is viable at all. Build the spreadsheet before the prototype.",
        },

        { t: "h", text: "Counting tokens properly" },
        {
          t: "code",
          lang: "python",
          caption: "Never guess when you can measure",
          code: `# Provider-specific tokenisers give exact counts.
# For OpenAI models:
import tiktoken

enc = tiktoken.encoding_for_model("gpt-4o")
n = len(enc.encode(text))

# Anthropic exposes a count endpoint:
#   client.messages.count_tokens(model=..., messages=[...])

# Rough cross-provider estimate when you just need a guardrail:
def estimate_tokens(text: str, kind: str = "prose") -> int:
    divisor = {"prose": 4.0, "code": 3.0, "json": 2.8}.get(kind, 4.0)
    return int(len(text) / divisor) + 1

# Enforce a budget BEFORE the call, not after the bill.
MAX_INPUT = 8_000

def fit_to_budget(chunks: list[str], budget: int) -> list[str]:
    kept, used = [], 0
    for c in chunks:
        cost = estimate_tokens(c)
        if used + cost > budget:
            break
        kept.append(c)
        used += cost
    return kept`,
        },
        {
          t: "note",
          kind: "pro",
          title: "Log tokens on every call from day one",
          text: "Record input tokens, output tokens, cached tokens, model, and latency for every request. It costs you one log line and it's the only way to answer 'why did the bill triple?' three months later. Teams that skip this always regret it.",
        },

        {
          t: "check",
          key: "tok-1",
          q: "Your app has a 200k-token context window. A user's document set is 150k tokens. What should you do?",
          options: [
            "Send all 150k — it fits, so use it",
            "Retrieve the relevant 3–6k tokens and send those",
            "Truncate to the first 50k tokens",
            "Split into three calls and merge the answers",
          ],
          answer: 1,
          why: "Fitting is not the same as being a good idea. Sending 150k tokens costs roughly 25–50× more per call, adds seconds of latency, and measurably degrades accuracy through context rot. Targeted retrieval is cheaper, faster, and more accurate — the rare case where all three improve together.",
        },
      ],
      takeaways: [
        "English prose is ~4 characters per token; code ~3; non-Latin scripts 2–4× worse. Measure rather than guess when it matters.",
        "The context window is a budget. Filling it costs money, adds latency, and reduces accuracy.",
        "Context rot means retrieval quality drops as the window fills, well before the advertised limit.",
        "Output tokens typically cost 3–5× input tokens — bound response length deliberately.",
        "Cost arithmetic at design time changes architecture. Do it in a spreadsheet before you write code.",
      ],
      quiz: [
        {
          q: "Roughly how many tokens is a 500-word English email?",
          options: ["~250", "~665", "~1,500", "~2,600"],
          answer: 1,
          why: "One token averages about 0.75 English words, so tokens ≈ words ÷ 0.75 = words × 1.33. That gives 500 × 1.33 ≈ 665. The direction of the ratio trips people up constantly — tokens are always *more* numerous than words, never fewer.",
        },
        {
          q: "Why does sending 150k tokens often produce worse answers than sending 4k relevant tokens?",
          options: [
            "The model truncates anything past 4k",
            "Attention degrades over volume and distance — context rot and lost-in-the-middle effects",
            "Long prompts trigger provider rate limits",
            "Tokenisers behave differently on long text",
          ],
          answer: 1,
          why: "Accuracy on retrieval and reasoning tasks measurably declines as the window fills, and information buried in the middle of a long prompt is disproportionately ignored. Fewer, better-selected tokens win on quality as well as on cost and latency.",
        },
        {
          q: "Which content type is most token-expensive per character?",
          options: [
            "English prose",
            "Python code",
            "A UUID string",
            "Markdown",
          ],
          answer: 2,
          why: "Random alphanumeric strings have no learned subword structure, so tokenisers fragment them close to per-character. A single UUID can consume 20+ tokens. If you're passing many identifiers, consider shortening them or keeping them out of the prompt entirely.",
        },
        {
          q: "You need to cut LLM spend 50% without hurting quality. What do you try first?",
          options: [
            "Switch every call to the cheapest available model",
            "Prompt caching on stable prefixes, plus routing easy turns to a small model",
            "Reduce max_tokens to 100",
            "Batch requests together",
          ],
          answer: 1,
          why: "Caching a stable system block cuts that input cost by roughly 75–90% on hits with zero quality impact, and routing easy turns to a small model preserves quality where it matters. Blanket downgrades and hard output truncation both trade quality for savings, which was explicitly ruled out.",
        },
      ],
      cards: [
        {
          f: "Token ratios: English prose, code, non-Latin scripts?",
          b: "Prose ≈ 4 chars/token (0.75 words). Code ≈ 3 chars/token. Non-Latin scripts cost 2–4× more than the English equivalent.",
        },
        {
          f: "What is context rot?",
          b: "Measured degradation in retrieval and reasoning accuracy as the context window fills, occurring well before the advertised token limit. Related: 'lost in the middle', where mid-prompt information is disproportionately ignored.",
        },
        {
          f: "Why is 4k of retrieved context often better than 150k of raw context?",
          b: "Cheaper, lower latency, and more accurate — context rot means more irrelevant tokens actively hurt quality. All three metrics improve at once, which is unusual.",
        },
        {
          f: "Typical input vs output token pricing ratio?",
          b: "Output usually costs 3–5× input per token. Bounding response length is therefore one of the cheapest cost levers available.",
        },
      ],
      resources: [
        {
          title: "OpenAI Tokenizer (interactive)",
          url: "https://platform.openai.com/tokenizer",
          kind: "tool",
        },
        {
          title: "tiktoken",
          url: "https://github.com/openai/tiktoken",
          kind: "repo",
        },
        {
          title: "Chroma — Context Rot research",
          url: "https://research.trychroma.com/context-rot",
          kind: "research",
        },
      ],
    },

    /* ------------------------------------------------------ */
    {
      id: "sampling",
      phase: "foundations",
      title: "Sampling: Temperature, Top-p & Determinism",
      subtitle:
        "The model outputs a probability distribution. Sampling parameters decide how you collapse it into one token — and why the same prompt can give different answers.",
      minutes: 16,
      difficulty: "beginner",
      tags: ["sampling", "determinism"],
      lab: "sampling",
      objectives: [
        "Explain what temperature and top-p do to the distribution",
        "Pick sampling parameters per task type with justification",
        "Understand why temperature 0 is not truly deterministic",
      ],
      body: [
        {
          t: "p",
          text: "Each forward pass produces a **logit** — a raw score — for every token in the vocabulary. Softmax turns those scores into probabilities. Sampling parameters reshape that distribution before one token is drawn.",
        },
        { t: "lab", id: "sampling" },

        { t: "h", text: "Temperature" },
        {
          t: "p",
          text: "Temperature divides the logits before softmax. Values below 1 sharpen the distribution — the top token gets more probability mass. Values above 1 flatten it, giving unlikely tokens a real chance. At temperature 0 you take the single highest-probability token every time (greedy decoding).",
        },
        {
          t: "code",
          lang: "python",
          caption: "The whole mechanism, in five lines",
          code: `import numpy as np

def softmax_with_temperature(logits, T):
    if T == 0:                              # greedy: argmax
        p = np.zeros_like(logits)
        p[np.argmax(logits)] = 1.0
        return p
    z = np.array(logits) / T                # <- the entire trick
    z = z - z.max()                         # numerical stability
    e = np.exp(z)
    return e / e.sum()

logits = [4.2, 3.9, 2.1, 1.8, 0.5]
print(softmax_with_temperature(logits, 0.2))  # [0.82 0.18 0.00 0.00 0.00]
print(softmax_with_temperature(logits, 1.0))  # [0.44 0.33 0.05 0.04 0.01]
print(softmax_with_temperature(logits, 2.0))  # [0.31 0.27 0.11 0.09 0.05]`,
        },

        { t: "h", text: "Top-p and top-k" },
        {
          t: "list",
          items: [
            "**Top-k** keeps only the k highest-probability tokens and renormalises. Crude: k=40 is far too permissive when one token has 95% of the mass, and too restrictive when the distribution is genuinely flat.",
            "**Top-p (nucleus sampling)** keeps the smallest set of tokens whose cumulative probability reaches p, then renormalises. This adapts to the shape of the distribution, which is why it's the modern default.",
          ],
        },
        {
          t: "note",
          kind: "pitfall",
          title: "Don't tune temperature and top-p together",
          text: "They interact in ways that are genuinely hard to reason about, and you'll end up unable to attribute a behaviour change to either. Pick one — temperature is more intuitive — and leave the other at its default. Most provider defaults (temperature 1.0, top_p 1.0) are tuned for chat, not for your extraction task.",
        },

        { t: "h", text: "What to use, by task" },
        {
          t: "table",
          head: ["Task", "Temperature", "Reasoning"],
          rows: [
            [
              "Classification, extraction, routing",
              "0",
              "You want the same input to give the same label. Variation is pure downside.",
            ],
            [
              "Structured output / JSON",
              "0 – 0.2",
              "Format adherence collapses as temperature rises.",
            ],
            [
              "Tool and function calling",
              "0 – 0.3",
              "Argument correctness matters more than phrasing variety.",
            ],
            [
              "Factual Q&A over retrieved docs",
              "0 – 0.3",
              "The answer is in the context; you're extracting, not inventing.",
            ],
            [
              "Summarisation",
              "0.3 – 0.5",
              "A little variation improves readability without risking fabrication.",
            ],
            [
              "Conversational assistant",
              "0.5 – 0.8",
              "Repetitive phrasing reads as robotic across a long conversation.",
            ],
            [
              "Brainstorming, copywriting",
              "0.8 – 1.1",
              "Diversity is the deliverable.",
            ],
            [
              "Anything in production",
              "≤ 1.2",
              "Beyond that, coherence degrades unpredictably. There is no legitimate production use for 1.8.",
            ],
          ],
        },
        {
          t: "note",
          kind: "insight",
          title: "Reasoning models are different",
          text: "Models post-trained for extended internal deliberation often ignore or restrict temperature, and providers frequently fix it. Their variance comes from the reasoning process itself, not from token sampling. Check the model card rather than assuming your usual settings transfer.",
        },

        { t: "h", text: "Why temperature 0 still isn't deterministic" },
        {
          t: "p",
          text: "This surprises people, and it matters for testing. Greedy decoding is deterministic in theory. In practice, identical requests to a hosted model can still diverge:",
        },
        {
          t: "list",
          items: [
            "**Floating-point non-associativity.** GPU kernels reduce in nondeterministic order, and `(a+b)+c ≠ a+(b+c)` in floating point. Two logits within 1e-7 of each other can swap places.",
            "**Batching effects.** Your request is batched with others; batch composition changes kernel selection and reduction order.",
            "**Mixture-of-Experts routing.** Many frontier models route tokens to different expert subnetworks, and routing can be batch-sensitive.",
            "**Silent version changes.** A model alias can point at new weights without notice.",
          ],
        },
        {
          t: "note",
          kind: "warn",
          title: "Test design consequence",
          text: "Never write an assertion that requires byte-identical model output. Assert on structure (valid JSON, required fields present), on semantics (a judge or a similarity threshold), or on properties (no PII, under 200 words, cites a real chunk ID). Snapshot tests over raw LLM output are a maintenance trap that will fail on a Tuesday for no reason.",
        },
        {
          t: "code",
          lang: "python",
          caption: "Assertions that survive nondeterminism",
          code: `# BAD — will flake, eventually, for no reason you can act on
assert response == "The revenue was $4.2M in Q3 2025."

# GOOD — assert on the properties you actually care about
data = json.loads(response)                    # structure
assert set(data) >= {"revenue", "quarter"}     # required fields
assert data["quarter"] == "Q3 2025"            # extracted value
assert abs(data["revenue"] - 4_200_000) < 1    # numeric tolerance
assert data["source_chunk_id"] in retrieved_ids  # grounded in context`,
        },

        {
          t: "check",
          key: "samp-1",
          q: "Your JSON extraction endpoint returns malformed output about 5% of the time. Temperature is at the provider default of 1.0. What's the first move?",
          options: [
            "Add a retry loop with a JSON repair prompt",
            "Set temperature to 0 and use the provider's schema-enforced output mode",
            "Switch to a larger model",
            "Add 'You MUST return valid JSON' in capitals to the prompt",
          ],
          answer: 1,
          why: "Default temperature 1.0 is tuned for conversation and actively works against format adherence. Dropping to 0 removes the sampling variance, and provider-enforced schema modes make malformed JSON structurally impossible rather than merely discouraged. Retries and stern capitalised instructions treat the symptom; a bigger model is expensive and doesn't address the cause.",
        },
      ],
      takeaways: [
        "Temperature divides logits before softmax: below 1 sharpens, above 1 flattens, 0 is greedy argmax.",
        "Top-p adapts to distribution shape and is the better knob than top-k — but tune only one of temperature/top-p.",
        "Provider defaults are tuned for chat. Deterministic tasks need explicit temperature 0.",
        "Temperature 0 is not truly deterministic: float non-associativity, batching, and MoE routing all introduce variance.",
        "Assert on structure, semantics, and properties — never on exact output strings.",
      ],
      quiz: [
        {
          q: "What does temperature mathematically do?",
          options: [
            "Multiplies output probabilities by a constant",
            "Divides logits before softmax, sharpening (<1) or flattening (>1) the distribution",
            "Limits how many tokens can be sampled",
            "Controls how many layers run",
          ],
          answer: 1,
          why: "Temperature is a divisor applied to the logits before the softmax. Dividing by a small number spreads the logits apart, so softmax concentrates mass on the top token; dividing by a large number compresses them, flattening the distribution toward uniform.",
        },
        {
          q: "Why is top-p generally preferred over top-k?",
          options: [
            "It's computationally cheaper",
            "It adapts to the shape of the distribution instead of using a fixed count",
            "It guarantees deterministic output",
            "It works better with reasoning models",
          ],
          answer: 1,
          why: "A fixed k is wrong in both directions: too permissive when one token dominates, too restrictive when many tokens are genuinely plausible. Top-p takes however many tokens are needed to reach the probability mass p, so the candidate set grows and shrinks with the model's actual confidence.",
        },
        {
          q: "Your test asserting an exact model response passes locally and flakes in CI. Root cause?",
          options: [
            "A CI configuration bug",
            "GPU floating-point non-associativity, batching, and possible MoE routing make byte-identical output unguaranteed even at temperature 0",
            "The API key differs",
            "CI has higher network latency",
          ],
          answer: 1,
          why: "Hosted inference is not bitwise reproducible. Reduction order on GPUs varies with batch composition, and near-tied logits can swap. Exact-match assertions over model output are inherently flaky — assert on structure, semantics, or properties instead.",
        },
      ],
      cards: [
        {
          f: "What does temperature do mathematically?",
          b: "Divides the logits before softmax. T < 1 sharpens the distribution toward the top token; T > 1 flattens it; T = 0 is greedy argmax.",
        },
        {
          f: "Top-p vs top-k — which and why?",
          b: "Top-p (nucleus): keeps the smallest token set whose cumulative probability reaches p, adapting to distribution shape. Top-k's fixed count is wrong whenever confidence is very high or very flat.",
        },
        {
          f: "Temperature for extraction vs brainstorming?",
          b: "Extraction/classification/JSON: 0–0.2. Conversation: 0.5–0.8. Brainstorming/copywriting: 0.8–1.1. Never above ~1.2 in production.",
        },
        {
          f: "Why isn't temperature 0 deterministic in practice?",
          b: "GPU float non-associativity, variable batch composition changing reduction order, mixture-of-experts routing, and silent model-version updates. Assert on properties, not exact strings.",
        },
      ],
      resources: [
        {
          title: "How to sample from language models",
          url: "https://huggingface.co/blog/how-to-generate",
          kind: "article",
        },
        {
          title:
            "Thinking Machines — Defeating nondeterminism in LLM inference",
          url: "https://thinkingmachines.ai/blog/defeating-nondeterminism-in-llm-inference/",
          kind: "research",
        },
      ],
    },

    /* ------------------------------------------------------ */
    {
      id: "model-choice",
      phase: "foundations",
      title: "Choosing a Model Deliberately",
      subtitle:
        "There are hundreds of models and one correct method: define the task, define the constraints, then test two or three candidates on your own data. Leaderboards are marketing.",
      minutes: 18,
      difficulty: "beginner",
      tags: ["models", "decisions"],
      lab: "router",
      objectives: [
        "Classify a task into the tier of model it needs",
        "Read benchmarks without being misled by them",
        "Design a routing strategy that cuts cost without cutting quality",
      ],
      body: [
        {
          t: "p",
          text: "Model selection is a constraint-satisfaction problem, not a ranking problem. The question is never 'which model is best' — it's 'which is the cheapest, fastest model that clears my quality bar on my task'.",
        },
        { t: "lab", id: "router" },

        { t: "h", text: "The four tiers" },
        {
          t: "table",
          head: ["Tier", "Good for", "Wrong for"],
          rows: [
            [
              "**Nano / small** (fastest, cheapest)",
              "Classification, routing, extraction from clean text, moderation, simple rewrites",
              "Multi-step reasoning, nuanced judgement, long-context synthesis",
            ],
            [
              "**Mid / workhorse**",
              "The bulk of production traffic: RAG answers, summarisation, tool calling, chat",
              "Frontier maths, competitive-level code, long autonomous chains",
            ],
            [
              "**Frontier / large**",
              "Hard reasoning, agentic coding, ambiguous judgement, long-horizon tasks",
              "High-volume simple work — you're burning money",
            ],
            [
              "**Reasoning models**",
              "Maths, proofs, algorithmic code, multi-constraint planning, hard debugging",
              "Extraction, formatting, latency-sensitive UX. Slow and overqualified.",
            ],
          ],
        },
        {
          t: "note",
          kind: "insight",
          title: "The default that's right most of the time",
          text: "Prototype on a frontier model to establish what's achievable, then work downward until quality drops below your bar. Starting cheap and working up wastes weeks debugging problems that were model-capacity issues all along. Establish the ceiling first, then optimise toward it.",
        },

        { t: "h", text: "Reading benchmarks without being fooled" },
        {
          t: "list",
          items: [
            "**Contamination.** Public benchmarks leak into training data. A high MMLU score may partly reflect memorisation.",
            "**Ceiling saturation.** When every serious model scores 88–92%, the benchmark has stopped discriminating. Differences are noise.",
            "**Construct mismatch.** Graduate physics questions do not predict performance on extracting invoice line items.",
            "**Arena dynamics.** Human-preference leaderboards reward formatting, length, and confidence — which correlate with being liked, not with being right.",
            "**Harness variance.** The same model scores differently under different prompting, parsing, and few-shot setups. Compare only within one harness.",
          ],
        },
        {
          t: "note",
          kind: "pro",
          title: "The only benchmark that matters",
          text: "Twenty to fifty cases from your actual task, with known-good answers. This takes an afternoon and predicts production performance better than every public leaderboard combined. You'll build exactly this in Phase 06 — but build a rough version now, before you pick a model.",
        },

        { t: "h", text: "Constraints that override quality" },
        {
          t: "steps",
          items: [
            {
              title: "Latency budget",
              text: "An autocomplete feature needs sub-300ms time-to-first-token. That eliminates reasoning models outright, regardless of how much smarter they are.",
            },
            {
              title: "Unit cost ceiling",
              text: "If a request must cost under $0.002, do the arithmetic before you fall in love with a model. Cost per request is a hard product constraint.",
            },
            {
              title: "Data residency and privacy",
              text: "Regulatory requirements may force a specific cloud region, an enterprise agreement, or fully self-hosted inference. This decides your options before quality does.",
            },
            {
              title: "Context window",
              text: "If a single document is 400k tokens and you genuinely cannot chunk it, your candidate list is short.",
            },
            {
              title: "Capability requirements",
              text: "Native tool calling, schema-enforced output, vision, audio, prompt caching. Missing any required one is disqualifying.",
            },
            {
              title: "Rate limits and capacity",
              text: "A model you can't get enough throughput on at peak is not a model you can ship.",
            },
          ],
        },

        { t: "h", text: "Routing: how you get quality and cost" },
        {
          t: "p",
          text: "The mature pattern is not choosing one model — it's classifying each request and sending it to the cheapest tier that can handle it.",
        },
        {
          t: "code",
          lang: "python",
          caption: "A router that pays for itself",
          code: `from dataclasses import dataclass

@dataclass
class Route:
    model: str
    max_tokens: int
    temperature: float

SMALL = Route("small-fast", 512, 0.0)
MID   = Route("mid-workhorse", 1024, 0.3)
LARGE = Route("frontier", 2048, 0.3)
REASON = Route("reasoning", 4096, 1.0)

def route(req) -> Route:
    # 1. Deterministic rules first — free, instant, auditable.
    if req.task in ("classify", "extract", "moderate"):
        return SMALL
    if req.needs_math or req.task == "plan_multi_step":
        return REASON
    if req.turn_count > 12 or req.context_tokens > 30_000:
        return LARGE

    # 2. Cheap classifier for the ambiguous middle.
    #    A small model deciding "is this hard?" costs ~$0.0001.
    if complexity_score(req.text) > 0.7:
        return LARGE
    return MID

# 3. Escalate on failure rather than starting expensive.
def answer(req):
    r = route(req)
    out = call(r, req)
    if not passes_quality_gate(out) and r is not LARGE:
        out = call(LARGE, req)      # second attempt, better model
        log_escalation(req.id, r.model)
    return out`,
        },
        {
          t: "note",
          kind: "money",
          title: "Why this works so well",
          text: "Production traffic is heavily skewed: typically 50–70% of requests are genuinely easy. Routing those to a model that costs 10–20× less, while keeping the frontier model for the hard tail, commonly cuts total spend 50–70% with no measurable quality loss. Log every escalation — that log is your eval set for the router itself.",
        },

        { t: "h", text: "Avoiding lock-in without pretending it's free" },
        {
          t: "p",
          text: "Wrap provider calls behind one thin interface of your own from the start. Not a heavyweight abstraction framework — a single module with `complete()`, `stream()`, and `call_tools()` that normalises message format, error types, and token accounting. Swapping providers then costs a day instead of a quarter.",
        },
        {
          t: "note",
          kind: "pitfall",
          title: "But don't abstract away what you need",
          text: "Provider-specific features — prompt caching semantics, schema-enforced output, extended thinking controls, citation modes — are exactly where the value is. An abstraction that reduces every provider to the lowest common denominator costs you more than the lock-in it prevents. Normalise the boring parts; expose the good parts.",
        },

        {
          t: "check",
          key: "mc-1",
          q: "You need to classify 2 million support tickets into 12 categories, overnight, as accurately as possible. Which approach?",
          options: [
            "A frontier model on all 2M — accuracy matters most",
            "A reasoning model, since classification requires judgement",
            "A small model, validated against a few hundred hand-labelled tickets, escalating only low-confidence cases",
            "Fine-tune a model from scratch",
          ],
          answer: 2,
          why: "Classification into a fixed set of labels is exactly what small models are good at. Validate on a few hundred labelled examples; if the small model clears your bar, you've saved 10–20× on cost and finished in a fraction of the time. Route only genuinely ambiguous cases upward. Frontier and reasoning models are wildly overqualified here, and 2M requests makes the cost difference enormous.",
        },
      ],
      takeaways: [
        "Model choice is constraint satisfaction: cheapest and fastest model that clears your quality bar.",
        "Prototype on a frontier model to find the ceiling, then work downward — not the reverse.",
        "Public benchmarks suffer contamination, saturation, and construct mismatch. Build a 20–50 case internal eval instead.",
        "Latency, unit cost, data residency, and required capabilities can all override raw quality.",
        "Routing easy traffic to small models typically cuts spend 50–70% with no measurable quality loss.",
      ],
      quiz: [
        {
          q: "Why prototype on a frontier model even if you plan to ship a cheaper one?",
          options: [
            "Frontier models have better APIs",
            "It establishes the achievable quality ceiling, so later failures are attributable to your system rather than model capacity",
            "Cheaper models lack tool calling",
            "It's required for prompt caching",
          ],
          answer: 1,
          why: "If you start cheap and quality is poor, you can't tell whether your prompt, your retrieval, or the model is the problem — and you can burn weeks on the wrong one. Establishing the ceiling first turns everything afterwards into a controlled optimisation with a known target.",
        },
        {
          q: "A leaderboard shows Model A at 91.2% and Model B at 90.8% on a popular benchmark. What should you conclude?",
          options: [
            "Model A is better; use it",
            "Essentially nothing — that gap is within noise on a saturated benchmark, and neither score reflects your task",
            "Model B is better value",
            "Both are unsuitable for production",
          ],
          answer: 1,
          why: "A 0.4-point difference on a benchmark near its ceiling is not a signal. Add harness variance and possible contamination and the ordering could flip on a re-run. The only comparison that informs your decision is both models on your own eval set.",
        },
        {
          q: "Which is the strongest argument for a thin provider abstraction layer?",
          options: [
            "It makes your code provider-agnostic with zero effort",
            "It normalises message format, errors, and token accounting so switching costs a day instead of a quarter",
            "It improves latency",
            "Frameworks require it",
          ],
          answer: 1,
          why: "The value is in normalising the boring, repetitive parts — message shapes, error taxonomies, usage accounting — so a provider swap is bounded work. Note the tradeoff: a thick abstraction that hides provider-specific features like caching semantics or schema enforcement costs you more than the lock-in it avoids.",
        },
        {
          q: "When is a reasoning model the wrong choice despite being 'smarter'?",
          options: [
            "When the task involves code",
            "When you need sub-second latency, high volume, or simple extraction",
            "When you need tool calling",
            "When the context is long",
          ],
          answer: 1,
          why: "Reasoning models spend extra inference compute deliberating, which costs seconds and tokens. For latency-sensitive UX, high-volume simple work, or mechanical extraction, that deliberation buys nothing and you pay for it on every request.",
        },
      ],
      cards: [
        {
          f: "What's the correct method for choosing a model?",
          b: "Constraint satisfaction: find the cheapest, fastest model that clears your quality bar on your own 20–50 case eval set. Prototype on frontier to find the ceiling, then work down.",
        },
        {
          f: "Name four reasons public benchmarks mislead.",
          b: "Training-data contamination, ceiling saturation (differences become noise), construct mismatch with your task, and harness variance between evaluation setups.",
        },
        {
          f: "How much can model routing save?",
          b: "Typically 50–70% of total spend with no measurable quality loss, because 50–70% of production traffic is genuinely easy and can go to a model costing 10–20× less.",
        },
        {
          f: "When is a reasoning model the wrong tool?",
          b: "Latency-sensitive UX, high-volume simple tasks, and mechanical extraction or formatting. You pay seconds and tokens for deliberation that buys nothing.",
        },
      ],
      resources: [
        {
          title: "Artificial Analysis — model comparison",
          url: "https://artificialanalysis.ai/",
          kind: "tool",
        },
        {
          title: "LMArena leaderboard",
          url: "https://lmarena.ai/",
          kind: "tool",
        },
        {
          title: "Anthropic — Choosing the right model",
          url: "https://docs.anthropic.com/en/docs/about-claude/models/overview",
          kind: "docs",
        },
      ],
    }
  );
})(window);
