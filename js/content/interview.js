/* ============================================================
   Interview drills — saying it out loud.

   The rest of this app can tell you that you know something. None of it can tell
   you whether you can *say* it, and the gap is enormous: explaining hybrid search
   to a skeptical staff engineer who interrupts you at ninety seconds is a
   different skill from understanding hybrid search, and it is the one that decides
   the loop.

   This is not flashcards. A card checks recall of a fact and the answer is short
   enough that self-marking is honest. A drill asks you to produce a structured
   argument under time pressure, where the failure mode is self-flattery — you read
   the model answer, recognise every part of it, and conclude you would have said
   it. So the rubric is the product here, not the question: named things a strong
   answer *contains*, and named things a weak answer *actually says*. You can lie
   to yourself about "did I know that". It is much harder to lie about "did I say
   the words 'recall@5' out loud".

   Drills deliberately do not feed the readiness score. That model is calibrated
   against a measured trajectory and its bands are documented; adding a
   self-reported signal would move every number in it and make the least reliable
   input the easiest one to inflate.
   ============================================================ */
(function (global) {
  "use strict";

  var C = global.Curriculum;

  /* What kind of question it is. Interviewers mix them deliberately and each has
     a different shape of good answer, so the drill says which one you are in —
     answering a trade-off question with a system design is a common way to lose a
     round while sounding knowledgeable. */
  C.drillKinds = [
    {
      id: "design",
      label: "System design",
      hint: "Draw the boxes, name the failure modes, and say what you would measure.",
    },
    {
      id: "deep",
      label: "Deep dive",
      hint: "One mechanism, explained precisely. Vagueness is the failure here.",
    },
    {
      id: "tradeoff",
      label: "Trade-off",
      hint: "Both sides, then a decision with a reason. Refusing to decide is a fail.",
    },
    {
      id: "debug",
      label: "Debugging",
      hint: "A method, not a guess. They are watching how you narrow it down.",
    },
    {
      id: "behavioural",
      label: "Behavioural",
      hint: "A specific story with a number in it. Generalities are forgettable.",
    },
  ];

  /* Self-rating after each drill. Three points, because five invites the middle
     and two invites optimism — and the labels are about what you *said*, not what
     you knew. */
  C.drillRatings = [
    {
      id: 0,
      label: "Fumbled it",
      hint: "Missed most of the strong points, or could not get started.",
    },
    {
      id: 1,
      label: "Got there",
      hint: "Covered the substance, but slowly or without the numbers.",
    },
    {
      id: 2,
      label: "Clean",
      hint: "Said it in the time, with specifics. You would pass on this one.",
    },
  ];

  /* ---------------------------------------------------------
     The bank
     --------------------------------------------------------- */

  C.drills = [
    /* ---- internals ---- */
    {
      id: "cost-arithmetic",
      competency: "internals",
      ch: "tokens",
      kind: "deep",
      minutes: 3,
      q: "A feature sends a 4,000-token system prompt and a 200-token user message, and gets back 600 tokens. It runs 50,000 times a day. Talk me through the monthly bill and where you would attack it.",
      probe:
        "Whether you can do unit economics out loud. Most candidates have never multiplied it out, and it shows within one sentence.",
      strong: [
        "Separates input from output pricing rather than quoting one number",
        "Multiplies it out to a monthly figure and says the arithmetic",
        "Spots that the 4,000-token system prompt is 87% of input and the first thing to cache",
        "Mentions that caching needs a byte-identical prefix, so prompt layout is a cost decision",
        "Names a cheaper model for the easy subset before optimising the prompt",
      ],
      weak: [
        '"It depends on the model" — and then stops',
        "Talks about output tokens first because they cost more per token, missing that there are far fewer of them",
        "Suggests fine-tuning as the cost fix without comparing it to caching",
      ],
      follow: "Now the system prompt has a timestamp in it. What breaks?",
    },
    {
      id: "same-prompt-twice",
      competency: "internals",
      ch: "sampling",
      kind: "deep",
      minutes: 2,
      q: "Same prompt, same model, same parameters — two different answers. Why?",
      probe:
        "Whether you understand sampling as sampling, or think of the model as a lookup that occasionally glitches.",
      strong: [
        "Next-token prediction produces a distribution, and sampling draws from it",
        "Names temperature and top-p and what each actually does to that distribution",
        "Says temperature 0 is near-deterministic but not guaranteed, and why (batching, kernel non-determinism, MoE routing)",
        "Distinguishes 'I want reproducibility' from 'I want the best answer' as different asks",
      ],
      weak: [
        '"Because it is an AI" or "it is non-deterministic by design" with no mechanism',
        "Claims temperature 0 is fully deterministic",
        "Confuses temperature with top-p or treats them as the same knob",
      ],
      follow:
        "You need byte-identical output for a regression test. What do you do?",
    },
    {
      id: "model-choice",
      competency: "internals",
      ch: "model-choice",
      kind: "tradeoff",
      minutes: 3,
      q: "How do you pick a model for a new feature? Assume nobody will give you a budget number.",
      probe:
        "Whether you have a method or a favourite. Naming one model unprompted is the answer they are hoping not to hear.",
      strong: [
        "Starts from the constraints: latency ceiling, per-request cost ceiling, quality floor",
        "Says you write the eval first, then the model is a measurement rather than an opinion",
        "Mentions routing — the easy majority to a small model, the hard tail to a large one",
        "Raises data residency or self-hosting only if the context calls for it, rather than as a reflex",
      ],
      weak: [
        "Names a specific model as 'the best one' with no constraints",
        "Picks on benchmark scores alone",
        "Never mentions measuring anything on their own task",
      ],
      follow:
        "The model you chose is deprecated in 60 days. How much work is that?",
    },
    {
      id: "backend-transfer",
      competency: "internals",
      ch: "backend-delta",
      kind: "behavioural",
      minutes: 3,
      q: "You are coming from backend engineering. What transfers, and what did you have to unlearn?",
      probe:
        "Self-awareness, and whether you are treating this as a new field or as a new dependency. The second answer is the right one and most candidates overclaim novelty.",
      strong: [
        "Names concrete transfers: idempotency, backoff, timeouts, tracing, cost per request",
        "Names a specific thing that genuinely differs — output is a distribution, so 'correct' becomes statistical",
        "Gives one example of a habit that misfired, with what happened",
        "Frames evals as the tests you did not previously need",
      ],
      weak: [
        '"It is all just APIs" — technically true and reads as not having hit the hard parts',
        "Claims everything is new and nothing transfers",
        "No specific example, only categories",
      ],
      follow: "Which of your existing instincts is most dangerous here?",
    },

    /* ---- application ---- */
    {
      id: "structured-output",
      competency: "application",
      ch: "structured-output",
      kind: "design",
      minutes: 4,
      q: "Design a service that turns support emails into validated tickets. It has to be reliable enough that a human only sees the ones it flags.",
      probe:
        "The bread and butter of the job. They want to hear schema thinking and a failure path, not prompt wording.",
      strong: [
        "Schema first, with real constraints — enums, ranges, optional fields",
        "Passes the schema as a tool definition or structured-output spec, not as prose in the prompt",
        "A bounded repair loop, with a cap, and a dead-letter path when it fails",
        "Field-level accuracy rather than whole-record, because one bad field is the actual failure",
        "A confidence or abstain path for the flag-to-human case, and a check that it correlates with correctness",
      ],
      weak: [
        "Regex or string parsing over free-form output",
        "An unbounded retry loop, or no cap mentioned at all",
        '"I would prompt it to always return JSON" as the whole reliability story',
        "One accuracy number for the whole record",
      ],
      follow: "Your accuracy is 94%. Is that good?",
    },
    {
      id: "context-budget",
      competency: "application",
      ch: "context-engineering",
      kind: "debug",
      minutes: 3,
      q: "A long-running assistant starts giving worse answers the longer a conversation goes on. Where do you look?",
      probe:
        "Whether you know that context is a budget with competing claimants, or think a bigger window is the fix.",
      strong: [
        "Enumerates what is consuming the window: system prompt, history, retrieved chunks, tool schemas, few-shot examples, output reserve",
        "Names the no-output-reserve failure specifically — the model runs out of room mid-answer",
        "Mentions position effects: instructions buried in the middle get followed less reliably",
        "Proposes compaction or summarisation at a threshold, with the threshold named",
        "Says how they would measure it rather than eyeballing it",
      ],
      weak: [
        '"Use a model with a bigger context window" as the answer rather than one option',
        "Blames the model without instrumenting anything",
        "No mention of the output reserve",
      ],
      follow: "You summarise at 70%. What does that lose?",
    },
    {
      id: "streaming-latency",
      competency: "application",
      ch: "streaming",
      kind: "tradeoff",
      minutes: 3,
      q: "Users say the feature is slow. Your p50 total generation time is 4 seconds. What do you do first?",
      probe:
        "Whether you know which number users actually feel. Optimising total time here is the wrong first move and a very common answer.",
      strong: [
        "Separates time-to-first-token from total time and says users feel TTFT",
        "Streams before optimising, because it changes the perceived number without changing the real one",
        "Quotes p95, not just p50, and says why",
        "Names what actually moves TTFT — prompt length, cache hits, model size — versus what does not",
      ],
      weak: [
        "Goes straight to a smaller model without measuring where the time goes",
        "Only ever quotes averages, so the slow tail stays invisible",
        "Treats streaming as a UI nicety rather than a latency intervention",
      ],
      follow: "You stream, and users still say it is slow. Now what?",
    },
    {
      id: "caching-idempotency",
      competency: "application",
      ch: "resilience",
      kind: "design",
      minutes: 3,
      q: "The provider starts returning 529s for ten minutes at a time. Make your feature survive it.",
      probe:
        "Ordinary backend engineering, which is most of this job. A candidate who cannot do this here cannot do it anywhere.",
      strong: [
        "Exponential backoff with full jitter, and says why jitter matters",
        "A circuit breaker so a dead provider stops eating your capacity",
        "Idempotency keys so a retried request cannot double-charge or double-write",
        "A fallback: a second provider, a smaller model, or a graceful degradation the product can live with",
        "Timeouts set from the p99, not from a round number",
      ],
      weak: [
        "Retry three times with a fixed sleep",
        "No idempotency story, so a retry can double-charge or double-write",
        '"I would add a queue" with no consumer-side reasoning',
      ],
      follow:
        "Your retry succeeded but the client had already timed out. What did the user get charged for?",
    },

    /* ---- retrieval ---- */
    {
      id: "rag-diagnose",
      competency: "retrieval",
      ch: "rag-debug",
      kind: "debug",
      minutes: 4,
      q: "Your RAG system returns confident, fluent answers that are wrong. Walk me through finding out why.",
      probe:
        "The single most common system-design question in this field. They want a method that isolates stages, not a list of things that could be wrong.",
      strong: [
        "Splits retrieval from generation first: was the right chunk retrieved at all?",
        "Checks recall@k on a labelled set before touching the prompt",
        "If retrieval is fine, looks at whether the answer is grounded in what was retrieved — faithfulness, not correctness",
        "Names chunking as a suspect: mid-sentence cuts and orphaned context",
        "Checks for the no-answer case — the system should refuse, and usually does not",
        "Ends with a measurement, not a fix",
      ],
      weak: [
        "Starts rewriting the prompt before establishing that retrieval worked",
        '"I would add a reranker" before establishing where the loss is',
        "Confuses faithfulness with accuracy",
        "No eval set anywhere in the answer",
      ],
      follow:
        "Retrieval recall is 0.95 and answers are still wrong. Where does that leave you?",
    },
    {
      id: "hybrid-search",
      competency: "retrieval",
      ch: "hybrid-rerank",
      kind: "deep",
      minutes: 3,
      q: "Why would you run BM25 alongside vector search instead of just using embeddings?",
      probe:
        "Whether you know where dense retrieval actually fails. Answering 'for better results' means you have not seen it fail.",
      strong: [
        "Dense retrieval fails on exact tokens: error codes, part numbers, rare proper nouns, negation",
        "Lexical fails on paraphrase, which is where dense wins — the two fail differently, which is the point",
        "Names a fusion method, and that RRF needs no score calibration between the two",
        "Puts a reranker after fusion and says what it costs in latency",
      ],
      weak: [
        '"Hybrid is better" with no failure mode named',
        "Adds the scores together without addressing that they are on different scales",
        "Thinks a reranker replaces retrieval rather than reordering it",
      ],
      follow:
        "Your reranker adds 300ms. How do you decide whether it is worth it?",
    },
    {
      id: "chunking",
      competency: "retrieval",
      ch: "chunking",
      kind: "tradeoff",
      minutes: 3,
      q: "How big should a chunk be?",
      probe:
        "A trap. There is no number, and confidently giving one is the fail. They want to hear the trade-off and a measurement.",
      strong: [
        "Names the tension: too small loses context, too large dilutes the embedding and wastes the window",
        "Says it depends on the corpus and the question shape, then says how they would find out",
        "Mentions structure-preserving splits over fixed sizes, and overlap as a mitigation not a fix",
        "Proposes comparing strategies on one eval set and publishing the numbers",
      ],
      weak: [
        '"512 tokens with 50 overlap" as a universal answer',
        "Never says how they would find out which size is right for this corpus",
        "Never considers document structure",
      ],
      follow:
        "You compared three strategies and they are within two points. What now?",
    },
    {
      id: "embeddings",
      competency: "retrieval",
      ch: "embeddings",
      kind: "deep",
      minutes: 2,
      q: "What does cosine similarity between two embeddings actually tell you, and what does it not?",
      probe:
        "Whether embeddings are a mechanism to you or a magic distance function.",
      strong: [
        "Similarity in the model's learned space, which encodes what it was trained to encode",
        "Semantic relatedness is not the same as relevance to a question — the classic failure",
        "Notes that opposites often sit close together, because they share context",
        "Mentions that the query and the document are different shapes of text, hence asymmetric models or query rewriting",
      ],
      weak: [
        '"How similar the meanings are" with no limits',
        "Treats a high score as proof of an answer",
        "Cannot say what changes when you swap embedding models",
      ],
      follow: "Two chunks score 0.91 and 0.89. Is the first one better?",
    },

    /* ---- agents ---- */
    {
      id: "agent-or-workflow",
      competency: "agents",
      ch: "agent-loop",
      kind: "tradeoff",
      minutes: 3,
      q: "When would you not build an agent?",
      probe:
        "Restraint. This is the question that separates people who have run an agent in production from people who have demoed one.",
      strong: [
        "If the steps are known, it is a workflow, and a workflow is cheaper, faster and testable",
        "Compounding reliability: several steps at 95% each is not a 95% system",
        "Cost and latency variance are unbounded in a loop, which is hard to put behind an SLA",
        "Names a case where an agent genuinely earns it — unknown-length search, real branching",
      ],
      weak: [
        '"Agents are the future" or enthusiasm with no failure analysis',
        "Cannot name a case where a workflow wins",
        "No mention of reliability compounding across steps",
      ],
      follow: "Your agent is 6 steps at 97% each. What is your success rate?",
    },
    {
      id: "tool-design",
      competency: "agents",
      ch: "tool-use",
      kind: "design",
      minutes: 3,
      q: "You are giving an agent six tools. What makes a good tool definition?",
      probe:
        "Whether you write descriptions for a model or for a human. Most people write documentation and are surprised the agent misuses them.",
      strong: [
        "The description is a prompt: it says when to use the tool and when not to",
        "Narrow, single-purpose tools over one overloaded tool with a mode flag",
        "Errors are returned as usable text the model can act on, not stack traces",
        "Results are validated before entering the trajectory, so a bad response cannot corrupt it",
        "Irreversible actions are gated behind approval",
      ],
      weak: [
        "Copying an internal API surface straight into tool definitions",
        "One 'do_thing' tool with a big enum",
        "No error contract, so a failing tool returns a stack trace the model cannot act on",
      ],
      follow:
        "The agent calls the wrong tool 20% of the time. Is that a prompt problem?",
    },
    {
      id: "agent-budgets",
      competency: "agents",
      ch: "agent-guardrails",
      kind: "design",
      minutes: 3,
      q: "Your agent occasionally spends £40 on a single run. Fix it.",
      probe:
        "Whether you think in hard limits. Soft mitigations here mean it will happen again.",
      strong: [
        "Hard caps, enumerated: max steps, max tokens, max wall-clock, max spend per run",
        "Kills the run at the cap rather than warning, and treats the kill as a normal outcome",
        "Instruments cost per run and quotes p95, because the median hides this entirely",
        "Looks at the trace to find the loop rather than only capping the symptom",
      ],
      weak: [
        "Only a step cap, which a single expensive call walks straight past",
        "Logs a warning and lets the run continue, so it happens again tomorrow",
        "Quotes the average cost, which is exactly the statistic that hides this",
      ],
      follow: "A run gets killed at the cap. What does the user see?",
    },
    {
      id: "agent-memory",
      competency: "agents",
      ch: "agent-memory",
      kind: "deep",
      minutes: 3,
      q: "What does 'memory' mean for an agent, concretely?",
      probe:
        "Whether you can decompose a vague product word into mechanisms. Interviewers use this to see if you fill vagueness with more vagueness.",
      strong: [
        "Separates the conversation window from anything persisted",
        "Names distinct kinds: scratchpad within a run, summarised history, retrieved facts, explicit user profile",
        "Says retrieval is a memory implementation, with the same recall problem",
        "Raises staleness and contradiction — what happens when a remembered fact is now wrong",
      ],
      weak: [
        '"It remembers what you said" with no mechanism',
        "Conflates context window with storage",
        "No account of invalidation — what happens when a remembered fact is now wrong",
      ],
      follow: "A user corrects a fact you stored last month. What happens?",
    },

    /* ---- evaluation ---- */
    {
      id: "eval-first",
      competency: "evaluation",
      ch: "why-evals",
      kind: "design",
      minutes: 4,
      q: "You are the first engineer on an AI feature. What do you build in week one?",
      probe:
        "The round that filters most candidates. The answer they are listening for is 'the eval set', and most people say 'a prototype'.",
      strong: [
        "An eval set before, or alongside, the first prototype — otherwise every later change is a guess",
        "Cases from real or realistic traffic, plus deliberate adversarial ones",
        "Deterministic assertions wherever code can check it, model grading only where it cannot",
        "A number you can move, in CI, before anyone is depending on the feature",
        "Says explicitly that vibes-based iteration stops working at about week three",
      ],
      weak: [
        "Prototype first, evals later when there is time",
        '"I would try some prompts and see how it does"',
        "Grades everything with an LLM because it is easier",
      ],
      follow:
        "Where do the first 40 cases come from if you have no traffic yet?",
    },
    {
      id: "judge-calibration",
      competency: "evaluation",
      ch: "llm-judge",
      kind: "deep",
      minutes: 3,
      q: "You are grading answers with an LLM judge. How do you know the judge is any good?",
      probe:
        "The most common unexamined assumption in applied AI. An uncalibrated judge is a random number generator with good manners.",
      strong: [
        "Label a sample by hand and measure agreement with the judge",
        "Names a number: agreement rate, or a kappa, and what would be too low to use",
        "Investigates disagreements rather than averaging over them",
        "Mentions known judge biases — position, length, self-preference — and how to blunt them",
        "Uses a rubric with few-shot anchors and a forced structured verdict, not a 1-10 score",
      ],
      weak: [
        '"I use a strong model as the judge" as the whole answer',
        "No human labels anywhere, so the judge is unverified by construction",
        "Asks the judge for a score out of ten with no rubric",
      ],
      follow: "Judge and humans agree 78% of the time. Can you ship it?",
    },
    {
      id: "regression-noise",
      competency: "evaluation",
      ch: "evals-ci",
      kind: "deep",
      minutes: 3,
      q: "Your eval score moved from 81% to 84% after a prompt change. Ship it?",
      probe:
        "Statistical literacy. Most candidates say yes, and the number of cases is the whole question.",
      strong: [
        "Asks how many cases first — on 50, three points is noise",
        "Names a confidence interval or a test rather than gesturing at 'significance'",
        "Says what sample size would be needed to detect a 3-point move",
        "Checks whether any case regressed, not just the aggregate",
      ],
      weak: [
        '"Yes, it went up"',
        "Talks about significance without a number",
        "Never asks how large the eval set is",
      ],
      follow:
        "Aggregate is up 3 points and four previously passing cases now fail. Ship it?",
    },
    {
      id: "trajectory-eval",
      competency: "evaluation",
      ch: "agent-evals",
      kind: "design",
      minutes: 3,
      q: "How do you evaluate an agent, as opposed to a single response?",
      probe:
        "Whether you understand that the right answer by the wrong route is still a failure.",
      strong: [
        "Grades the trajectory, not only the final answer",
        "Says explicitly that a correct answer reached by a wrong or wasteful route should fail",
        "Names what to assert: which tools, in a defensible order, within budget",
        "Golden trajectories with tolerance for legitimate alternate routes",
        "Tracks cost and step count as outcomes, not just correctness",
      ],
      weak: [
        "Only checks the final output, so a lucky right answer passes",
        '"I would look at the traces" with no assertions',
        "No budget dimension, so a run that cost £40 counts as a pass",
      ],
      follow:
        "Two different tool orders both reach the right answer. How does your eval handle that?",
    },

    /* ---- production ---- */
    {
      id: "lethal-trifecta",
      competency: "production",
      ch: "prompt-injection",
      kind: "design",
      minutes: 4,
      q: "Your agent reads customer emails, has access to an internal database, and can send messages. What is the problem?",
      probe:
        "Whether you can see the lethal trifecta unprompted. This is the senior signal in the security round.",
      strong: [
        "Names the combination: untrusted input, access to private data, and an exfiltration path",
        "Says prompt injection is not solved and delimiters do not hold",
        "Removes a leg of the trifecta rather than trying to filter the input",
        "Human approval for anything irreversible or outbound",
        "Least privilege on the data side, so a successful injection reaches less",
      ],
      weak: [
        '"I would sanitise the input"',
        "Relies on instructing the model to ignore injected instructions",
        "Treats it as a content-filtering problem",
      ],
      follow: "The product needs all three. What do you actually ship?",
    },
    {
      id: "tracing",
      competency: "production",
      ch: "observability",
      kind: "design",
      minutes: 3,
      q: "It is 2am and a user says the assistant gave them a wrong answer an hour ago. What do you need to have already built?",
      probe:
        "Whether observability was designed in or bolted on. The answer reveals which one within a sentence.",
      strong: [
        "A trace per request, with a span per model call and per tool call",
        "The actual prompt and completion recorded, with a retention and privacy policy stated",
        "Retrieved chunk ids, so you can tell a retrieval failure from a generation failure",
        "Token counts and cost on the span, so the same trace answers the billing question",
        "A way to find the trace from what the user can tell you — a request id surfaced in the UI",
      ],
      weak: [
        "Application logs with the response text and nothing else",
        "No way to link a user report to a trace",
        "Records everything with no privacy consideration",
      ],
      follow:
        "The prompt contained the user's medical history. Is it still in your traces?",
    },
    {
      id: "deploy-model-change",
      competency: "production",
      ch: "deployment",
      kind: "tradeoff",
      minutes: 3,
      q: "The provider is deprecating your model in 60 days. Walk me through the migration.",
      probe:
        "This happens constantly and is the most predictable operational event in the field. A candidate with no plan has not operated anything.",
      strong: [
        "Runs the existing eval suite against the candidate model before changing anything",
        "Expects prompt-level regressions, because prompts are tuned to a model whether you meant to or not",
        "Shadow or canary rather than a cutover",
        "Re-checks cost and latency, not only quality",
        "Says the eval suite is what makes this a two-week job instead of a quarter",
      ],
      weak: [
        "Swap the model string and watch for complaints",
        "Assumes a newer model is strictly better",
        "No rollback path, and no canary — a straight cutover on a live feature",
      ],
      follow:
        "The new model is better on your evals and users complain anyway. What happened?",
    },
    {
      id: "pii",
      competency: "production",
      ch: "safety-privacy",
      kind: "tradeoff",
      minutes: 3,
      q: "Users are pasting personal data into your product. What are you obliged to do about it?",
      probe:
        "Whether you think about data at all. This is the question that ends loops for otherwise strong candidates.",
      strong: [
        "Knows where the data goes: the provider, your logs, your traces, your eval sets",
        "Names retention as a decision, with a number",
        "Raises the eval-set leak specifically — production data copied into a fixture is the easiest way to keep PII forever",
        "Distinguishes what the provider contractually does with it from what you assume",
        "Redaction at the boundary rather than after storage",
      ],
      weak: [
        '"The provider does not train on API data" as the entire answer',
        "No mention of their own logs, traces or eval fixtures as data stores",
        "Never considers eval sets or traces as data stores",
      ],
      follow: "A user asks you to delete everything. Can you?",
    },

    /* ---- career / judgement ---- */
    {
      id: "finetune-or-not",
      competency: "career",
      ch: "finetuning-decision",
      kind: "tradeoff",
      minutes: 3,
      q: "When is fine-tuning the right answer?",
      probe:
        "Judgement. Fine-tuning is the most over-reached-for tool in the field and interviewers know it.",
      strong: [
        "Prompting, then retrieval, then fine-tuning — in that order, because the cost of being wrong rises",
        "Fine-tuning teaches form and style far more reliably than it teaches facts",
        "Names what it costs beyond compute: a labelled set, an eval to prove it helped, and a retraining commitment",
        "Says the break-even is a calculation and gives the shape of it",
        "Mentions that a fine-tune pins you to a model that will be deprecated",
      ],
      weak: [
        '"To teach the model our internal knowledge" — the classic wrong answer',
        "No comparison against retrieval",
        "No mention of an eval to prove it worked",
      ],
      follow: "You fine-tuned and it is 4 points better. Was it worth it?",
    },
    {
      id: "build-or-buy",
      competency: "career",
      ch: "local-models",
      kind: "tradeoff",
      minutes: 3,
      q: "Would you run a model yourself instead of calling an API?",
      probe:
        "Whether you can cost out an option you are not going to pick, which is most of senior engineering.",
      strong: [
        "Names the real reasons: data residency, per-token economics at high volume, latency floor, no rate limits",
        "Counts the costs people forget: GPU availability, memory for the KV cache, evaluation of a weaker model, on-call",
        "Gives a rough volume where the arithmetic flips",
        "Notes that the frontier moves and a self-hosted model does not",
      ],
      weak: [
        '"It is cheaper" with no volume',
        "Only counts the weights and not the KV cache",
        "Ignores operational cost entirely",
      ],
      follow:
        "You are told the GPUs are already paid for. Does that change it?",
    },
    {
      id: "disagreed",
      competency: "career",
      ch: "interview-prep",
      kind: "behavioural",
      minutes: 3,
      q: "Tell me about a time you were wrong about a technical decision.",
      probe:
        "10% of the loop and 100% of the reason some strong candidates fail it. They are checking whether you can be corrected.",
      strong: [
        "A specific decision, with the reasoning you had at the time",
        "What evidence changed your mind, and roughly when",
        "What it cost, with a number if there is one",
        "What you changed about how you decide, not just what you changed in the code",
      ],
      weak: [
        'A non-answer wearing a mistake\'s clothes — "I was too thorough"',
        "Blames someone else's requirements",
        "No specifics, no consequence, no change",
      ],
      follow: "Who told you, and how did you take it?",
    },
    {
      id: "explain-to-pm",
      competency: "career",
      ch: "interview-prep",
      kind: "behavioural",
      minutes: 2,
      q: "A product manager asks why the feature cannot just be 99% accurate. Answer them.",
      probe:
        "Communication under a wrong premise. They want to see you correct it without condescending.",
      strong: [
        "Asks what 99% would be measured on before agreeing or disagreeing",
        "Explains that accuracy is per-task and per-distribution, in plain language",
        "Offers the real lever: narrow the task, or add an abstain path so errors are caught not shipped",
        "Gives them a number they can plan with rather than a lecture",
      ],
      weak: [
        '"LLMs are probabilistic" and stops',
        "Agrees to 99% to end the conversation",
        "Uses jargon the PM has no way to check",
      ],
      follow: "They say the competitor claims 99%. What do you say?",
    },
  ];

  /* ---------------------------------------------------------
     Selection
     --------------------------------------------------------- */

  C.drillsFor = function (competencyId) {
    return C.drills.filter(function (d) {
      return !competencyId || competencyId === "all"
        ? true
        : d.competency === competencyId;
    });
  };

  /* What to practise next.

     Unseen first, then the ones you graded yourself down on — a drill you fumbled
     is the only kind worth repeating, and one you called clean is worth repeating
     much later or never. Deliberately not a spaced-repetition schedule: these take
     three minutes each and there are a few dozen, so a due-date model would spend
     its complexity budget on a problem the ordering already solves.

     `state` is plain data: { drills: {id: {seen, rating}} }  */
  C.drillQueue = function (competencyId, state) {
    state = state || {};
    var seen = state.drills || {};
    var pool = C.drillsFor(competencyId);

    function rank(d) {
      var rec = seen[d.id];
      if (!rec || !rec.seen) return 0; // never attempted
      if (rec.rating === 0) return 1; // fumbled
      if (rec.rating === 1) return 2; // got there
      return 3; // clean
    }

    return pool
      .slice()
      .sort(function (a, b) {
        var d = rank(a) - rank(b);
        if (d) return d;
        /* Within a tier, least-recently-seen first, then bank order so the result
           is stable rather than dependent on sort implementation. */
        var at = (seen[a.id] || {}).at || 0;
        var bt = (seen[b.id] || {}).at || 0;
        if (at !== bt) return at - bt;
        return C.drills.indexOf(a) - C.drills.indexOf(b);
      })
      .map(function (d) {
        var rec = seen[d.id] || {};
        return {
          drill: d,
          seen: !!rec.seen,
          rating: rec.seen ? rec.rating : null,
        };
      });
  };

  /* Progress per competency, for the readiness page's rehearse links. */
  C.drillStats = function (competencyId, state) {
    state = state || {};
    var seen = state.drills || {};
    var pool = C.drillsFor(competencyId);
    var attempted = 0;
    var clean = 0;
    var weak = 0;
    pool.forEach(function (d) {
      var rec = seen[d.id];
      if (!rec || !rec.seen) return;
      attempted++;
      if (rec.rating === 2) clean++;
      if (rec.rating === 0) weak++;
    });
    return {
      total: pool.length,
      attempted: attempted,
      clean: clean,
      weak: weak,
    };
  };
})(window);
