/* ============================================================
   Phase 06 — Evaluation
   ============================================================ */
(function (global) {
  "use strict";
  var C = global.Curriculum;

  C.chapters.push(
    /* ------------------------------------------------------ */
    {
      id: "why-evals",
      phase: "evals",
      title: "Why Evals Are the Job",
      subtitle:
        "The single highest-leverage skill in applied AI, and the one most people skip. Without evals you are not engineering — you are gambling with extra steps.",
      minutes: 16,
      difficulty: "intermediate",
      tags: ["evals", "mindset"],
      objectives: [
        "Articulate why evals are the differentiator between teams",
        "Recognise the failure pattern of eval-free development",
        "Choose the right eval type for a given question",
      ],
      body: [
        {
          t: "p",
          text: "Here is what happens to a team without evals. They ship a prototype that works well in demos. A user reports a bad answer. Someone tweaks the prompt. It fixes that case and silently breaks two others. Nobody notices for a week. Another report arrives; another tweak; another silent regression. Within a month the prompt is a 900-line accretion of patches that nobody dares touch, and quality oscillates around a plateau forever.",
        },
        {
          t: "note",
          kind: "insight",
          title: "The plateau is not a capability limit",
          text: "It's a measurement limit. The team isn't stuck because the model can't do better — they're stuck because they can't tell whether a change helped. Every improvement is a coin flip on everything else, so progress is a random walk. Teams that build evals go from a random walk to gradient descent, and the difference in trajectory is dramatic.",
        },

        { t: "h", text: "What an eval actually is" },
        {
          t: "p",
          text: "That plateau story is worth recognising because you will be inside it before you notice. It doesn't feel like a measurement problem — it feels like the model isn't good enough, or like the problem is intrinsically hard. It feels that way precisely because you have no instrument.",
        },
        {
          t: "p",
          text: "A dataset of inputs with known-good outputs or gradeable criteria, plus a scoring function, plus a way to run both repeatably. That's it. It's a test suite for a probabilistic system, and the only unusual part is that some assertions are fuzzy.",
        },
        {
          t: "table",
          head: ["Eval type", "Answers", "When to run"],
          rows: [
            [
              "**Unit-level**",
              "Does this one component behave?",
              "Every commit. Fast, deterministic, cheap.",
            ],
            [
              "**End-to-end**",
              "Does the whole system produce good answers?",
              "Every PR. Slower, some model grading.",
            ],
            [
              "**Regression suite**",
              "Did this change break anything previously working?",
              "Every PR. This is the one that stops the oscillation.",
            ],
            [
              "**Adversarial**",
              "Does it hold up under attack and edge cases?",
              "Weekly, and before any release.",
            ],
            [
              "**Online**",
              "Is production quality holding up on real traffic?",
              "Continuously, on a sample.",
            ],
            [
              "**Human review**",
              "Is our automated grading actually right?",
              "Weekly, on a sample. Calibrates everything else.",
            ],
          ],
        },

        { t: "h", text: "The virtuous cycle" },
        {
          t: "p",
          text: "Note how low the bar is. An eval is not a research artefact; it is a folder of cases and a scoring function. The reason it changes everything is not sophistication but the loop it makes possible.",
        },
        {
          t: "flow",
          nodes: [
            { b: "Production", s: "real traffic", c: "accent" },
            { b: "Find failures", s: "read traces", c: "cyan" },
            { b: "Add eval case", s: "before fixing", c: "amber" },
            { b: "Fix + verify", s: "no regression", c: "emerald" },
          ],
          cap: "Every production failure becomes a permanent test. Your eval set gets better exactly where your system is weakest.",
        },
        {
          t: "note",
          kind: "pro",
          title: "The rule that makes this work",
          text: "Add the failing case to your eval set *before* you fix it. This forces you to reproduce the failure, gives you a red test that turns green, and permanently protects the fix. Reversing the order means relying on memory that the case ever existed — and prompt changes routinely resurrect old bugs.",
        },

        {
          t: "check",
          key: "we-mid",
          q: "Your team's quality has plateaued: each prompt change fixes one report and seems to break something else. What does that pattern indicate?",
          options: [
            "You have hit the model's capability ceiling and need a stronger model",
            "You have no measurement, so every change is an untested guess",
            "The prompt has grown too long and needs rewriting",
          ],
          answer: 1,
          why: "Fix-one-break-two is the signature of changing a system you cannot measure: nothing tells you whether a change helped overall, so regressions ship invisibly. It feels like a capability limit, which is exactly why teams reach for a bigger model instead of an eval set. Twenty cases with known-good answers converts the guesswork into an experiment.",
        },
        { t: "h", text: "Objections, answered" },
        {
          t: "p",
          text: "Everyone agrees with this in principle and skips it in practice, for a small number of reasons that all sound sensible. They are worth answering directly, because each one has a specific reply.",
        },
        {
          t: "compare",
          left: {
            title: "The objection",
            kind: "bad",
            items: [
              "'We don't have labelled data'",
              "'Our outputs are subjective'",
              "'We don't have time'",
              "'The model keeps changing anyway'",
              "'Our task is too complex to grade'",
            ],
          },
          right: {
            title: "The answer",
            kind: "good",
            items: [
              "Write 20 cases by hand. It takes an afternoon.",
              "Then grade specific dimensions: is it grounded? does it cite? does it follow format?",
              "You already spend more time on unmeasured prompt tweaking.",
              "That's the argument *for* evals — they tell you if an upgrade helped.",
              "Then grade its checkable properties, not holistic quality.",
            ],
          },
        },

        {
          t: "p",
          text: "Underneath every one of those objections is the same instinct: that a partial eval isn't worth having. It is the most expensive wrong belief in this field.",
        },
        { t: "h", text: "Twenty cases beat zero, always" },
        {
          t: "p",
          text: "The most common failure is aiming for a perfect eval suite and building nothing. Twenty hand-written cases in a JSON file, scored by a `for` loop, is transformative compared to nothing. Everything else is refinement.",
        },
        {
          t: "code",
          lang: "python",
          caption: "A complete eval harness, honestly",
          code: `import json, statistics

CASES = json.load(open("evals/cases.json"))

def run_evals():
    results = []
    for case in CASES:
        out = my_system(case["input"])
        results.append({
            "id": case["id"],
            # Deterministic checks first — free and unambiguous.
            "has_citation": bool(re.search(r"\\[doc-\\d+\\]", out.text)),
            "under_limit": len(out.text.split()) <= 150,
            "correct_label": out.label == case["expected_label"],
            # Model-graded only where code cannot decide.
            "grounded": judge_grounded(out, case),
        })

    for metric in results[0]:
        if metric == "id":
            continue
        score = statistics.mean(r[metric] for r in results)
        print(f"{metric:16s} {score:.1%}")

    return results

# That is a real eval suite. Forty lines. Run it on every PR.`,
        },
        {
          t: "note",
          kind: "money",
          title: "The interview signal",
          text: "In an applied AI interview, 'how do you know it works?' separates candidates decisively. A specific answer — 'I built a 60-case set from production traffic, deterministic assertions where possible, an LLM judge calibrated against 40 human labels, gated in CI with confidence intervals' — is a stronger signal than any framework you can name. This is why the capstone for this phase exists.",
        },

        {
          t: "check",
          key: "we-1",
          q: "A user reports a bad answer. What do you do first?",
          options: [
            "Fix the prompt immediately",
            "Add the case to your eval set, confirm it fails, then fix and verify nothing else regressed",
            "Switch to a larger model",
            "Add a retry",
          ],
          answer: 1,
          why: "Adding the case first forces you to reproduce the failure (many reports aren't reproducible), gives you a red test that must turn green, and permanently protects the fix. Then running the full suite catches the regression your fix would otherwise have introduced silently — which is the mechanism that keeps quality moving upward rather than oscillating.",
        },
      ],
      takeaways: [
        "Without evals, every prompt fix is a coin flip on everything else — progress becomes a random walk.",
        "Teams plateau on measurement limits, not model capability limits.",
        "An eval is a dataset plus a scoring function plus a repeatable runner. Nothing more.",
        "Add the failing case to your eval set *before* fixing it.",
        "Twenty hand-written cases beat zero. Ship those today; refine later.",
      ],
      quiz: [
        {
          q: "Why do eval-free teams plateau?",
          options: [
            "The models hit capability limits",
            "They cannot tell whether a change helped, so each fix risks silent regressions and progress becomes a random walk",
            "They lack compute",
            "Prompts have a length limit",
          ],
          answer: 1,
          why: "The bottleneck is measurement, not capability. Without a regression suite, fixing one case and breaking two others is indistinguishable from improvement. Evals convert a random walk into gradient descent.",
        },
        {
          q: "'Our outputs are too subjective to evaluate.' Best response?",
          options: [
            "They're right; skip evals",
            "Grade specific checkable dimensions — grounded, cites sources, follows format, correct label — rather than holistic quality",
            "Use only human review",
            "Use a bigger judge model",
          ],
          answer: 1,
          why: "Holistic quality may be genuinely subjective, but its components usually aren't. Whether every claim is supported by retrieved context, whether citations resolve, whether the format matches — all mechanically checkable. Decomposing subjective quality into checkable properties is the standard move.",
        },
        {
          q: "Why add a failing case to your eval set before fixing it?",
          options: [
            "For documentation",
            "It forces reproduction, gives a red test to turn green, and permanently protects the fix from regression",
            "To slow down risky changes",
            "It's required by CI",
          ],
          answer: 1,
          why: "Three benefits at once. Many reported failures don't reproduce, and finding that out early saves wasted work. A red-to-green test proves the fix works. And the case stays in the suite forever, so a future prompt change can't quietly resurrect the bug.",
        },
      ],
      cards: [
        {
          f: "Why do teams without evals plateau?",
          b: "It's a measurement limit, not a capability limit. Without a regression suite you can't distinguish improvement from fix-one-break-two, so progress is a random walk instead of gradient descent.",
        },
        {
          f: "What is an eval, minimally?",
          b: "A dataset of inputs with known-good outputs or gradeable criteria, a scoring function, and a repeatable runner. Twenty hand-written cases in a JSON file scored by a for-loop is a real eval suite.",
        },
        {
          f: "What's the rule about failing cases?",
          b: "Add the case to your eval set BEFORE fixing it. Forces reproduction, gives a red test to turn green, and permanently protects against regression.",
        },
      ],
      resources: [
        {
          title: "Hamel Husain — Your AI product needs evals",
          url: "https://hamel.dev/blog/posts/evals/",
          kind: "article",
        },
        {
          title: "Anthropic — Create strong empirical evaluations",
          url: "https://docs.anthropic.com/en/docs/test-and-evaluate/develop-tests",
          kind: "docs",
        },
      ],
    },

    /* ------------------------------------------------------ */
    {
      id: "eval-datasets",
      phase: "evals",
      title: "Building Your First Eval Set",
      subtitle:
        "Where the cases come from, how many you need, and how to avoid building a set that's systematically easier than reality.",
      minutes: 20,
      difficulty: "intermediate",
      tags: ["evals", "datasets"],
      objectives: [
        "Source eval cases from four different places",
        "Size a set so results are statistically meaningful",
        "Avoid the biases that make eval sets misleading",
      ],
      body: [
        {
          t: "p",
          text: "The previous chapter argued that you need an eval set. This one is about where the cases come from, and the answer determines whether the suite measures your product or your imagination.",
        },
        { t: "h", text: "Four sources, in order of value" },
        {
          t: "p",
          text: "The ordering below is by how much the cases resemble real usage, which is the only quality that matters. Every source above the last is a substitute for traffic you don't have yet.",
        },
        {
          t: "steps",
          items: [
            {
              title: "1. Production traces — the gold standard",
              text: "Real queries, real phrasing, real ambiguity. Sample deliberately: successes, failures, thumbs-down, abandoned sessions, and queries users rephrased (a rephrase is a failure signal the user didn't report).",
            },
            {
              title: "2. Hand-written by a domain expert",
              text: "Necessary before you have traffic, and irreplaceable for edge cases nobody has hit yet. Twenty cases in an afternoon.",
            },
            {
              title: "3. Synthetic, generated from your corpus",
              text: "Take a document, ask a model to generate questions it answers. Scales well for retrieval evals. Verify a sample by hand — generated questions skew easy and use the document's own vocabulary.",
            },
            {
              title: "4. Adversarial, written to break things",
              text: "Injections, ambiguity, off-corpus questions, contradictions, wrong-language input, empty input, enormous input. Small in number, disproportionate in value.",
            },
          ],
        },
        {
          t: "note",
          kind: "pitfall",
          title: "The bias that makes eval sets useless",
          text: "Hand-written and synthetic questions are well-formed, single-topic, and phrased in your corpus's vocabulary. Real questions are terse, ambiguous, compound, misspelled, and use the user's words. A set built only from imagined questions will show 92% while real users see 60% — and you'll have no idea why. Get real traffic in as soon as you have any.",
        },

        { t: "h", text: "How many cases?" },
        {
          t: "p",
          text: "That bias is why the ordering matters: questions you invent are questions you already know how to answer. Real users ask things you didn't think of, in phrasing you wouldn't have chosen, and those are the cases that move your score.",
        },
        {
          t: "p",
          text: "Size comes next, and it is where most teams are unknowingly fooling themselves.",
        },
        {
          t: "p",
          text: "Read that table as a statistical commitment rather than a convenience. Detectable difference shrinks with the square root of the sample, so each row buys resolution at a steeply rising price in authoring effort: doubling from 50 cases to 100 does not halve your uncertainty, it cuts it by about 30%. Pick the size that matches the decision you intend to make — a PR gate catching regressions needs far less resolution than a call on which of two models to ship.",
        },
        {
          t: "table",
          head: ["Size", "Detects", "Use"],
          rows: [
            [
              "20",
              "Gross breakage only",
              "Day one. Better than nothing by a wide margin.",
            ],
            [
              "50",
              "~15 percentage point differences",
              "A solid working minimum",
            ],
            ["100", "~10 point differences", "Good for PR gates"],
            [
              "300",
              "~5 point differences",
              "Model comparisons and release gates",
            ],
            [
              "1,000+",
              "~2 point differences",
              "Only if you have the traffic and a real need",
            ],
          ],
        },
        {
          t: "note",
          kind: "warn",
          title: "The statistics nobody does, and should",
          text: "On 50 cases, moving from 80% to 84% is two extra cases passing. That is noise — a 95% confidence interval on 50 binary trials at 80% spans roughly ±11 points. If your harness reports bare percentages without intervals, you will chase phantom improvements and dismiss real ones. Print the interval; it's one line of code.",
        },
        {
          t: "p",
          text: "Here is that line of code. The Wilson score interval is the one to reach for: the textbook normal approximation misbehaves badly at small samples and near 0% or 100%, which is exactly where eval scores live. Print it beside every number your harness reports and phantom improvements stop being tempting.",
        },
        {
          t: "code",
          lang: "python",
          caption: "Confidence intervals, cheaply",
          code: `import math

def wilson_interval(successes: int, n: int, z: float = 1.96):
    """Wilson score interval — behaves properly at small n and
    near 0% or 100%, unlike the normal approximation."""
    if n == 0:
        return (0.0, 1.0)
    p = successes / n
    denom = 1 + z * z / n
    centre = (p + z * z / (2 * n)) / denom
    margin = z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / denom
    return (max(0.0, centre - margin), min(1.0, centre + margin))


def report(name: str, successes: int, n: int):
    lo, hi = wilson_interval(successes, n)
    print(f"{name:22s} {successes/n:6.1%}  [{lo:.1%}, {hi:.1%}]  n={n}")

report("faithfulness", 41, 50)   # faithfulness  82.0%  [69.2%, 90.2%]  n=50
report("faithfulness", 82, 100)  # faithfulness  82.0%  [73.3%, 88.3%]  n=100

# Same score, much tighter interval. This is what more cases buys you.`,
        },

        {
          t: "check",
          key: "ed-mid",
          q: "Your eval score moves from 79% to 83% on 50 cases after a prompt change. What have you learned?",
          options: [
            "The change helped by about 4 points",
            "Very little — that move is inside the noise for this sample size",
            "The change helped, but you need to rerun to confirm the size",
          ],
          answer: 1,
          why: "On 50 cases the 95% confidence interval is roughly ±11 points, so 79% and 83% are indistinguishable. Shipping on that basis means sometimes shipping changes that did nothing and reverting ones that helped. Either gather more cases or accept that only large moves are readable — the interval is cheap to compute and it stops you fooling yourself.",
        },
        { t: "h", text: "Structuring a case" },
        {
          t: "p",
          text: "Take that confidence interval seriously — it changes how you work. A four-point move on 50 cases is not a result, and treating it as one means shipping changes that did nothing and reverting changes that helped.",
        },
        {
          t: "code",
          lang: "python",
          caption: "A case with everything you'll want later",
          code: `{
  "id": "billing-refund-enterprise-001",
  "input": "can I get a refund on the enterprise plan after 45 days?",

  # Grade what you can check deterministically.
  "expect": {
    "must_mention": ["30-day", "enterprise"],
    "must_not_mention": ["automatic", "guaranteed"],
    "gold_chunk_ids": ["refund-policy#enterprise"],
    "expected_status": "answered",
    "max_words": 150
  },

  # A reference answer for the judge to compare against.
  # Judges are far more reliable comparing than scoring in a vacuum.
  "reference": "Enterprise refunds are available within 30 days of "
               "the billing date. After 45 days a refund requires "
               "manager approval and is not guaranteed [doc-12].",

  # Metadata for slicing results — this is what turns an aggregate
  # score into an actionable diagnosis.
  "tags": ["billing", "refund", "enterprise", "temporal-reasoning"],
  "difficulty": "hard",
  "source": "production-trace-2026-04-02",
  "added_because": "user thumbs-down: model said refunds are automatic"
}`,
        },
        {
          t: "p",
          text: "Almost none of that structure is about grading the answer. The `expect` block is the only part a scorer reads; everything else exists so that six months from now you can answer questions about your own eval set — which cases came from real traffic, which were added after a specific failure, and which slice of behaviour is dragging the average down.",
        },
        {
          t: "note",
          kind: "pro",
          title: "Tag everything, then slice",
          text: "An aggregate score of 84% tells you nothing actionable. Sliced by tag it might reveal 96% on simple lookups and 51% on temporal reasoning — which tells you exactly what to work on. Tags cost nothing at authoring time and are the difference between a number and a diagnosis.",
        },

        { t: "h", text: "Keeping the set honest" },
        {
          t: "p",
          text: "One last discipline, and it is the one that decays silently. An eval set is a fixed measurement of a moving product, and it stops being informative unless you maintain it deliberately.",
        },
        {
          t: "list",
          items: [
            "**Hold out a test set.** Develop against one split, measure final quality on another you look at rarely. Otherwise you overfit your prompt to your eval set — the same overfitting that plagues benchmarks.",
            "**Version the set.** Score comparisons across different case sets are meaningless. Tag the version in every result.",
            "**Never let a case become wrong.** When policy changes, the expected answer changes. A stale eval set actively misleads.",
            "**Rebalance deliberately.** If 80% of cases are easy lookups because they were easy to write, your aggregate score mostly measures the easy path.",
            "**Include the abstention cases.** At least 10% of cases should have 'cannot be answered from the corpus' as the correct response.",
          ],
        },
        {
          t: "p",
          text: "None of the five is technically difficult and all five get skipped under deadline. The one worth defending hardest is the held-out split, because its absence is invisible: a set you have been iterating against for three months reports how well your prompt fits those particular cases, and you find out it was measuring the wrong thing only when the same prompt meets real traffic.",
        },

        {
          t: "check",
          key: "ed-1",
          q: "Your eval improves from 79% to 83% on 50 cases after a prompt change. What do you conclude?",
          options: [
            "A clear 4-point improvement; ship it",
            "Nothing yet — that's two extra cases, well inside the confidence interval",
            "The prompt is worse",
            "You need a different model",
          ],
          answer: 1,
          why: "Two additional passing cases out of 50. The 95% Wilson interval at 79% on n=50 spans roughly ±11 points, so 83% sits comfortably inside it. To resolve a 4-point difference you need several hundred cases, or a paired analysis on the same cases showing which specific ones flipped and why.",
        },
      ],
      takeaways: [
        "Production traces are the best source; synthetic and hand-written cases skew systematically easier.",
        "Fifty cases is a working minimum; 300 to resolve ~5-point differences.",
        "Always report confidence intervals — a 4-point move on 50 cases is noise.",
        "Tag every case and slice results; an aggregate score is not a diagnosis.",
        "Hold out a test split, version the set, and include ~10% abstention cases.",
      ],
      quiz: [
        {
          q: "Why are synthetic eval questions systematically easier than real ones?",
          options: [
            "Models generate simple questions",
            "They're well-formed, single-topic, and use the source document's own vocabulary — unlike real queries",
            "They're shorter",
            "They lack context",
          ],
          answer: 1,
          why: "A question generated from a document inherits its phrasing and covers exactly one topic. Real users write terse, ambiguous, compound, misspelled queries in their own words. That gap is why synthetic-only eval sets report scores far above production reality.",
        },
        {
          q: "On 50 cases, what difference can you reliably detect?",
          options: ["1 point", "About 15 points", "5 points", "Any difference"],
          answer: 1,
          why: "With n=50, the 95% confidence interval spans roughly ±11–14 points depending on the base rate. Anything smaller is indistinguishable from noise. Resolving 5-point differences needs a few hundred cases, or paired per-case analysis.",
        },
        {
          q: "Why tag eval cases with topic and difficulty?",
          options: [
            "For organisation",
            "So you can slice results — 84% overall might be 96% on lookups and 51% on temporal reasoning",
            "To generate more cases",
            "For the judge model",
          ],
          answer: 1,
          why: "Aggregates hide structure. Slicing converts an unactionable number into a specific diagnosis: which category is failing, and therefore what to fix. Tags cost nothing when authoring and are what makes eval results useful.",
        },
        {
          q: "Why hold out a test split?",
          options: [
            "To save compute",
            "Because iterating against a single set overfits your prompt to those specific cases",
            "For statistical validity",
            "To rotate cases",
          ],
          answer: 1,
          why: "Repeatedly tuning against the same cases fits the prompt to their idiosyncrasies rather than the underlying task — the same overfitting that makes public benchmarks unreliable. A rarely-touched holdout gives you an honest estimate of generalisation.",
        },
      ],
      cards: [
        {
          f: "Rank the four eval case sources.",
          b: "1) Production traces (real phrasing/ambiguity — sample failures, thumbs-down, rephrases). 2) Hand-written by a domain expert. 3) Synthetic from your corpus (skews easy). 4) Adversarial (small, high value).",
        },
        {
          f: "How many eval cases to detect a 5-point difference?",
          b: "About 300. At n=50 the 95% interval is roughly ±11–14 points, so only ~15-point differences are reliably detectable. Always report intervals, not bare percentages.",
        },
        {
          f: "Why tag and slice eval results?",
          b: "An aggregate 84% is unactionable; sliced it might be 96% on simple lookups and 51% on temporal reasoning — which tells you precisely what to fix.",
        },
        {
          f: "Four rules for keeping an eval set honest?",
          b: "Hold out a test split (avoid overfitting), version the set (scores across sets are incomparable), update cases when policy changes, and include ~10% abstention cases.",
        },
      ],
      resources: [
        {
          title: "Wilson score interval",
          url: "https://en.wikipedia.org/wiki/Binomial_proportion_confidence_interval",
          kind: "article",
        },
      ],
    },

    /* ------------------------------------------------------ */
    {
      id: "eval-metrics",
      phase: "evals",
      title: "Metrics: Deterministic, Model-Graded, Human",
      subtitle:
        "Never grade with a model what code can check. The discipline of pushing checks down to the cheapest reliable layer is most of what makes an eval harness trustworthy.",
      minutes: 25,
      difficulty: "intermediate",
      tags: ["evals", "metrics"],
      lab: "evalscore",
      objectives: [
        "Push each check to the cheapest layer that can do it",
        "Choose RAG and agent metrics that isolate stages",
        "Avoid metrics that look rigorous and measure nothing",
      ],
      body: [
        {
          t: "p",
          text: "Three layers, in strict order of preference. Every check should live at the highest layer that can perform it reliably.",
        },
        { t: "lab", id: "evalscore" },
        {
          t: "table",
          head: ["Layer", "Cost", "Reliability", "Use for"],
          rows: [
            [
              "**Deterministic code**",
              "Free",
              "Perfect",
              "Format, schema, citations resolve, length, exact labels, latency, cost, PII presence",
            ],
            [
              "**Model-graded**",
              "Cents",
              "Good if calibrated",
              "Faithfulness, relevance, tone, helpfulness, subtle correctness",
            ],
            [
              "**Human**",
              "Expensive",
              "The ground truth",
              "Calibrating the model graders; final release sign-off",
            ],
          ],
        },
        {
          t: "note",
          kind: "insight",
          title: "Most teams over-use the middle layer",
          text: "They spin up an LLM judge for things a regex answers definitively — does the output contain a citation, is it valid JSON, is it under 150 words, is the label one of five values. That costs money, adds latency, and introduces judge noise into a measurement that could have been exact. Audit your suite: every model-graded check that code could do is a defect.",
        },

        { t: "h", text: "Deterministic checks you should always have" },
        {
          t: "p",
          text: "That over-use of judges is the expensive mistake in this chapter. A judge costs money, adds latency, and needs its own validation — so every check you can push down to code is a check that gets faster, free, and trustworthy at the same time.",
        },
        {
          t: "code",
          lang: "python",
          caption: "Free, instant, and unambiguous",
          code: `import re, json

def deterministic_checks(out, case) -> dict:
    text = out.text
    return {
        # --- structure ---
        "valid_json": (
            is_valid_json(text) if case.get("expects_json") else None
        ),
        "schema_ok": validates_against(text, case.get("schema")),
        "not_truncated": out.stop_reason != "length",

        # --- grounding, mechanically ---
        # Every cited id must exist in what we actually supplied.
        "citations_resolve": all(
            cid in out.supplied_chunk_ids
            for cid in re.findall(r"\\[(doc-\\d+)\\]", text)
        ),
        "has_citation": bool(re.search(r"\\[doc-\\d+\\]", text)),
        # Quoted spans must appear verbatim in the sources.
        "quotes_verbatim": all(
            q in out.supplied_text for q in extract_quotes(text)
        ),

        # --- constraints ---
        "under_word_limit": len(text.split()) <= case["expect"]["max_words"],
        "no_pii": not detect_pii(text),
        "required_terms": all(
            t.lower() in text.lower()
            for t in case["expect"].get("must_mention", [])
        ),
        "forbidden_terms": not any(
            t.lower() in text.lower()
            for t in case["expect"].get("must_not_mention", [])
        ),

        # --- exact-match tasks ---
        "label_correct": out.label == case["expect"].get("expected_label"),

        # --- operational ---
        "under_latency_budget": out.latency_ms < 3000,
        "under_cost_budget": out.cost_usd < 0.05,
    }`,
        },

        { t: "h", text: "RAG metrics that isolate stages" },
        {
          t: "p",
          text: "Beyond the generic layers, the systems you built in Phase 04 and Phase 05 each have metrics of their own. The RAG ones matter because they attribute a failure to a stage rather than reporting one number for the whole pipeline.",
        },
        {
          t: "table",
          head: ["Metric", "Measures", "Layer"],
          rows: [
            [
              "**Recall@k**",
              "Is the gold chunk in the top k?",
              "Deterministic — needs labelled gold chunks",
            ],
            [
              "**MRR / nDCG@10**",
              "Rank quality, not just presence",
              "Deterministic",
            ],
            [
              "**Context precision**",
              "What fraction of retrieved chunks are relevant?",
              "Model-graded",
            ],
            [
              "**Faithfulness**",
              "Is every claim supported by the retrieved context?",
              "Model-graded — the core RAG metric",
            ],
            [
              "**Answer relevance**",
              "Does it address what was asked?",
              "Model-graded",
            ],
            [
              "**Citation coverage**",
              "What fraction of claims carry a citation?",
              "Deterministic",
            ],
            [
              "**Abstention correctness**",
              "Does it abstain exactly when it should?",
              "Deterministic — needs labelled unanswerables",
            ],
          ],
        },
        {
          t: "note",
          kind: "pro",
          title: "Faithfulness and correctness are different, and both matter",
          text: "An answer can be **faithful but wrong** (accurately reflecting an outdated document) or **correct but unfaithful** (right from the model's training data, not from your sources). The second is more dangerous: your citations imply grounding that isn't there, and the next question on the same topic may be confidently wrong. Measure both.",
        },

        { t: "h", text: "Agent metrics" },
        {
          t: "p",
          text: "Agents need the same treatment, and for the same reason: a trajectory has many places to go wrong and a single success flag tells you about none of them. The next chapter is entirely about this.",
        },
        {
          t: "list",
          items: [
            "**Task success** — did it achieve the goal? Needs a checkable success criterion per case, not a judge's opinion.",
            "**Trajectory quality** — were the tool calls sensible and in a defensible order? Grade the path, because a right answer via a lucky path breaks next week.",
            "**Tool-selection accuracy** — right tool, right arguments, first time.",
            "**Efficiency** — steps, tokens, and cost against a per-task budget. Regressions here are as real as quality regressions.",
            "**Recovery rate** — when a tool fails, does it adapt or flail?",
            "**Unsafe-action rate** — how often does it attempt something the guardrails must block? Should be tracked and trending down.",
          ],
        },

        { t: "h", text: "Metrics that look rigorous and measure nothing" },
        {
          t: "p",
          text: "Now the negative space. Several widely used metrics produce a plausible number that does not track quality, and they are dangerous precisely because a number feels like measurement.",
        },
        {
          t: "compare",
          left: {
            title: "Useful",
            kind: "good",
            items: [
              "Exact match on a closed label set",
              "Citations resolve to supplied IDs",
              "Recall@k against labelled gold chunks",
              "Pairwise preference vs a reference answer",
              "Cost and p95 latency per case",
            ],
          },
          right: {
            title: "Misleading",
            kind: "bad",
            items: [
              "BLEU/ROUGE on free-form answers — n-gram overlap isn't correctness",
              "Cosine similarity to a reference — paraphrase scores low, plausible-but-wrong scores high",
              "A 1–10 'quality' score from a judge — poorly calibrated, drifts",
              "Average of unrelated metrics into one number — hides everything",
              "Perplexity — irrelevant to whether the output is right",
            ],
          },
        },
        {
          t: "note",
          kind: "pitfall",
          title:
            "Embedding similarity to a reference answer is worse than it looks",
          text: "'Refunds are available within 30 days' and 'Refunds are not available within 30 days' score above 0.9 — embeddings don't encode negation. Meanwhile a correct answer phrased differently scores lower than a wrong answer phrased similarly. The metric is anti-correlated with correctness in exactly the cases you care about most.",
        },

        { t: "h", text: "Composite scores: report the components" },
        {
          t: "p",
          text: "Which suggests a general discipline about reporting. The moment you average several metrics into one headline figure, you lose the ability to see which one moved.",
        },
        {
          t: "code",
          lang: "python",
          caption: "A scorecard, not a score",
          code: `# --- Anti-pattern: one number that hides everything ---
score = (faithful + relevant + formatted + fast) / 4      # 0.84
# What broke? No way to tell. And a 0.84 can be 4 x 0.84
# or 3 x 1.0 + 1 x 0.36, which are completely different problems.

# --- Pattern: gate on components, report the whole card ---
GATES = {
    "citations_resolve": 1.00,    # zero tolerance
    "valid_schema":      1.00,    # zero tolerance
    "not_truncated":     1.00,
    "faithfulness":      0.90,
    "answer_relevance":  0.85,
    "abstains_correctly":0.80,
    "p95_latency_ok":    0.95,
}

def gate(results) -> tuple[bool, list[str]]:
    failures = []
    for metric, floor in GATES.items():
        actual = mean(r[metric] for r in results if r[metric] is not None)
        lo, _ = wilson_interval(sum(...), len(results))
        # Fail on the interval's lower bound, not the point estimate —
        # this is what stops noise from failing your build.
        if lo < floor:
            failures.append(f"{metric}: {actual:.1%} (floor {floor:.0%})")
    return (not failures), failures`,
        },

        {
          t: "check",
          key: "em-1",
          q: "You're grading whether answers cite their sources. Which approach?",
          options: [
            "An LLM judge asked 'does this answer cite sources?'",
            "A regex extracting citation markers, plus a check that each resolves to a supplied chunk ID",
            "Embedding similarity to a reference answer",
            "Human review of every case",
          ],
          answer: 1,
          why: "This is fully mechanical: extract the markers, verify each ID was in the supplied set. Free, instant, perfectly reliable, and it also catches fabricated citations — which a judge asked a yes/no question typically won't. Using a model here adds cost, latency, and judge noise for strictly worse accuracy.",
        },
      ],
      takeaways: [
        "Never model-grade what code can check. Audit your suite for this — it's the most common defect.",
        "Faithfulness (supported by context) and correctness (actually true) are different; measure both.",
        "Grade agent trajectories, not just final answers — a right answer via a lucky path is fragile.",
        "BLEU/ROUGE, embedding similarity to a reference, and 1–10 judge scores are misleading.",
        "Gate on individual components at their confidence-interval lower bound, and report the full scorecard.",
      ],
      quiz: [
        {
          q: "Which check should never use an LLM judge?",
          options: [
            "Whether the answer is faithful to the context",
            "Whether every citation marker resolves to a supplied chunk ID",
            "Whether the tone is appropriate",
            "Whether the answer is helpful",
          ],
          answer: 1,
          why: "Citation resolution is a set-membership test: extract the IDs, check each against what you supplied. Code does this perfectly and free, and catches fabricated citations that a judge answering yes/no would wave through. The others require judgement code can't provide.",
        },
        {
          q: "An answer accurately reflects an outdated document. How do you score it?",
          options: [
            "Faithful and correct",
            "Faithful but incorrect — which is why both metrics are needed",
            "Unfaithful and incorrect",
            "It can't be scored",
          ],
          answer: 1,
          why: "Faithfulness asks whether the answer is supported by the retrieved context — it is. Correctness asks whether it's true — it isn't. Separating them localises the fault to your corpus (stale document) rather than your generation prompt, which is exactly the diagnostic value.",
        },
        {
          q: "Why is embedding similarity to a reference answer a poor metric?",
          options: [
            "It's slow",
            "It's anti-correlated with correctness in the cases that matter — negations score highly similar, correct paraphrases score low",
            "It requires a reference",
            "Embeddings are expensive",
          ],
          answer: 1,
          why: "'Refunds are available' and 'refunds are not available' exceed 0.9 similarity because embeddings don't encode negation. Simultaneously, a correct answer worded differently scores below a wrong answer worded similarly. The metric actively misleads on the boundary cases.",
        },
        {
          q: "Why gate on a metric's confidence-interval lower bound rather than its point estimate?",
          options: [
            "It's more conservative",
            "So random noise on a small eval set doesn't fail builds that are actually fine",
            "It's faster to compute",
            "Point estimates are biased",
          ],
          answer: 1,
          why: "On 50 cases a point estimate swings several points run to run. Gating on it produces flaky builds that erode trust in the suite. Gating on the lower bound means you only fail when the evidence genuinely supports a regression.",
        },
      ],
      cards: [
        {
          f: "What's the metric-layer discipline?",
          b: "Deterministic code (free, perfect) > model-graded (cents, needs calibration) > human (expensive, ground truth). Never model-grade what code can check — that's the most common eval defect.",
        },
        {
          f: "Faithfulness vs correctness — what's the difference?",
          b: "Faithful = supported by the retrieved context. Correct = actually true. An answer can be faithful but wrong (stale document) or correct but unfaithful (from training data, not your sources — the more dangerous case).",
        },
        {
          f: "Name four misleading eval metrics.",
          b: "BLEU/ROUGE on free-form text (n-gram overlap ≠ correctness), embedding similarity to a reference (negation-blind, anti-correlated at the boundary), 1–10 judge scores (uncalibrated, drifts), and averaging unrelated metrics into one number.",
        },
        {
          f: "Six agent-specific metrics?",
          b: "Task success (checkable criterion), trajectory quality (grade the path), tool-selection accuracy, efficiency (steps/tokens/cost vs budget), recovery rate after tool failure, and unsafe-action attempt rate.",
        },
      ],
      resources: [
        {
          title: "RAGAS metrics reference",
          url: "https://docs.ragas.io/en/stable/concepts/metrics/",
          kind: "docs",
        },
      ],
    },

    /* ------------------------------------------------------ */
    {
      id: "llm-judge",
      phase: "evals",
      title: "LLM-as-a-Judge, Done Right",
      subtitle:
        "Powerful, cheap, and easy to fool yourself with. Uncalibrated judges measure their own biases and report them as your quality score.",
      minutes: 22,
      difficulty: "advanced",
      tags: ["evals", "judges"],
      objectives: [
        "Build a judge with a rubric, anchors, and structured output",
        "Calibrate against human labels and report agreement",
        "Recognise and mitigate the six known judge biases",
      ],
      body: [
        {
          t: "p",
          text: "An LLM judge scores output against criteria. Used carefully it gives you cheap, scalable grading of things code can't check. Used carelessly it produces a confident number that tracks response length and formatting rather than quality.",
        },

        { t: "h", text: "The six biases, and what to do" },
        {
          t: "p",
          text: "A judge is a measuring instrument you built out of the thing you're measuring, and that should make you cautious rather than dismissive. Used carefully it is the only affordable way to grade qualities like faithfulness at scale. Used carelessly it produces confident numbers that track nothing.",
        },
        {
          t: "p",
          text: "Start with the known failure modes, because they are systematic rather than random — which means they bias your results in a consistent direction rather than adding noise.",
        },
        {
          t: "table",
          head: ["Bias", "Effect", "Mitigation"],
          rows: [
            [
              "**Position**",
              "Favours whichever candidate appears first",
              "Evaluate both orders and average, or randomise position",
            ],
            [
              "**Verbosity**",
              "Prefers longer answers regardless of quality",
              "Add a conciseness criterion; cap length in the rubric",
            ],
            [
              "**Self-preference**",
              "Prefers output from its own model family",
              "Use a different model family as judge than as generator",
            ],
            [
              "**Formatting**",
              "Rewards bullet points and headers over substance",
              "State explicitly that formatting is not being assessed",
            ],
            [
              "**Sycophancy**",
              "Agrees with any expectation stated in the prompt",
              "Never tell the judge what answer you expect",
            ],
            [
              "**Scale compression**",
              "Clusters everything at 7–8 on a 1–10 scale",
              "Use 3–5 discrete labels with explicit definitions, not a 10-point scale",
            ],
          ],
        },
        {
          t: "note",
          kind: "pitfall",
          title: "The mistake that invalidates a whole eval run",
          text: "Including the expected answer in the judge prompt — 'The correct answer is X. Does this response say X?' — invites the judge to pattern-match on your stated expectation rather than assess the response. Give it the criteria and the source material, never your conclusion. This single error has quietly invalidated a lot of published eval numbers.",
        },

        { t: "h", text: "A judge that works" },
        {
          t: "p",
          text: "Every one of those biases has a mitigation, and together they produce a fairly specific recipe.",
        },
        {
          t: "code",
          lang: "python",
          caption: "Rubric, anchors, structured verdict",
          code: `class Verdict(BaseModel):
    # Reasoning FIRST — it conditions the label. Putting the label
    # first means the reasoning is a post-hoc rationalisation.
    reasoning: str = Field(max_length=600)

    unsupported_claims: list[str] = Field(
        description="Verbatim claims from the answer that the sources "
                    "do not support. Empty if all claims are supported.",
    )

    # Discrete labels with definitions beat a 1-10 scale.
    label: Literal["fully_supported", "mostly_supported",
                   "partly_supported", "unsupported"]

    confidence: Literal["high", "medium", "low"]


JUDGE_PROMPT = """You assess whether an answer is supported by its sources.

You are NOT assessing whether the answer is well-written, helpful,
or comprehensive. You are assessing ONE thing: is every factual
claim in the answer supported by <sources>?

Labels
- fully_supported: every factual claim is directly supported.
- mostly_supported: main claims supported; a minor detail is not.
- partly_supported: some claims supported, at least one significant
  claim is not.
- unsupported: the central claim is not supported by the sources.

Calibration examples

<example>
Sources: "Free tier: 100 webhook deliveries/day."
Answer: "The free tier allows 100 webhook deliveries per day [doc-1]."
-> fully_supported. Exact match to the source.
</example>

<example>
Sources: "Free tier: 100 webhook deliveries/day."
Answer: "The free tier allows 100 deliveries/day [doc-1], and you can
         request an increase by contacting support."
-> partly_supported. The limit is supported; the increase-request
   process appears nowhere in the sources.
</example>

<example>
Sources: "Refunds require manager approval above $500."
Answer: "Refunds are processed automatically within 5 business days."
-> unsupported. The central claim contradicts the source.
</example>

Ignore formatting, length, and tone entirely.
Do not consider whether the answer is what a user would want to hear.

<sources>{sources}</sources>
<question>{question}</question>
<answer>{answer}</answer>"""`,
        },
        {
          t: "note",
          kind: "insight",
          title: "Why reasoning must come before the label",
          text: "In an autoregressive model, tokens generated later are conditioned on tokens generated earlier. If the label comes first, the reasoning is generated to justify a label already committed to — a rationalisation. Putting reasoning first means the label is conditioned on actual analysis. This ordering measurably improves judge accuracy and costs nothing.",
        },

        {
          t: "check",
          key: "lj-mid",
          q: "Why must an LLM judge produce its reasoning *before* its score rather than after?",
          options: [
            "It makes the output easier for humans to audit",
            "An autoregressive model conditions the score on the reasoning it already wrote",
            "It reduces token cost by allowing an early stop",
          ],
          answer: 1,
          why: "The model generates left to right, so whatever comes first conditions what follows. Reasoning first means the label is derived from an argument; label first means the reasoning is a post-hoc justification of a number the model already committed to. The audit benefit is real but secondary — the ordering changes the answer, not just its presentation.",
        },
        { t: "h", text: "Calibration is not optional" },
        {
          t: "p",
          text: "And now the step that separates a judge you can cite from a judge you merely have. Everything above makes the instrument sensible; none of it tells you whether it agrees with a human.",
        },
        {
          t: "p",
          text: "An uncalibrated judge is an unvalidated instrument. Label 40–50 cases by hand, compare, and measure agreement.",
        },
        {
          t: "code",
          lang: "python",
          caption: "Cohen's kappa — agreement above chance",
          code: `def cohens_kappa(human: list[str], judge: list[str]) -> float:
    """Agreement corrected for chance. Raw agreement is misleading
    when one label dominates: 90% raw agreement on a set that is
    90% 'fully_supported' means the judge learned nothing."""
    labels = sorted(set(human) | set(judge))
    n = len(human)

    observed = sum(h == j for h, j in zip(human, judge)) / n

    expected = sum(
        (human.count(l) / n) * (judge.count(l) / n) for l in labels
    )
    return (observed - expected) / (1 - expected)


# Interpretation:
#   > 0.80  excellent   — trust the judge
#   0.60-0.80 good      — usable, review disagreements
#   0.40-0.60 moderate  — fix the rubric before relying on it
#   < 0.40  poor        — the judge is measuring something else

k = cohens_kappa(human_labels, judge_labels)
if k < 0.6:
    raise RuntimeError(
        f"kappa={k:.2f}: judge not calibrated. Read the "
        f"disagreements, sharpen the rubric, add anchor examples."
    )`,
        },
        {
          t: "note",
          kind: "pro",
          title: "Disagreements are the most valuable data you have",
          text: "Every human/judge disagreement is either a rubric ambiguity or a judge failure, and both are fixable. Read all of them — there are only ever a handful. In practice most disagreements reveal that *your rubric* was ambiguous, which means your humans were also inconsistent. Fixing the rubric improves both.",
        },

        { t: "h", text: "Pairwise comparison beats absolute scoring" },
        {
          t: "p",
          text: "If calibration comes out poor, the usual fix is not a better rubric but an easier question.",
        },
        {
          t: "p",
          text: "Judges are much better at 'which of these two is better?' than 'rate this from 1 to 10'. Comparison needs no calibrated scale, and it's the natural shape for the question you usually have: is the new version better than the old one?",
        },
        {
          t: "code",
          lang: "python",
          caption: "Position-debiased pairwise judging",
          code: `async def compare(question, answer_a, answer_b, sources) -> str:
    # Run both orderings to cancel position bias.
    v1 = await judge_pair(question, answer_a, answer_b, sources)
    v2 = await judge_pair(question, answer_b, answer_a, sources)

    # v2's verdict refers to swapped positions - invert it.
    v2 = {"first": "second", "second": "first", "tie": "tie"}[v2]

    if v1 != v2:
        return "tie"          # genuine ambiguity; do not force a winner
    return {"first": "a", "second": "b", "tie": "tie"}[v1]


# Aggregate across the eval set:
#   win rate for B vs A, with a confidence interval.
#   Ties count as half a win to each side.
# This directly answers "did my change help?" — which is the
# question you actually have.`,
        },

        {
          t: "check",
          key: "lj-1",
          q: "Your judge reports 91% faithfulness. Kappa against 40 human labels is 0.31. What's the situation?",
          options: [
            "Faithfulness is genuinely 91%",
            "The judge isn't measuring faithfulness — 91% is not evidence of anything until the rubric is fixed",
            "You need more human labels",
            "The judge model is too small",
          ],
          answer: 1,
          why: "Kappa of 0.31 is poor agreement — barely above chance. Whatever the judge is scoring, it doesn't track what your humans mean by faithfulness. The 91% is a precise measurement of an unknown quantity. Read the disagreements, sharpen the label definitions, add anchor examples, and re-calibrate until kappa clears 0.6 before quoting any number.",
        },
      ],
      takeaways: [
        "Judges have six known biases: position, verbosity, self-preference, formatting, sycophancy, scale compression.",
        "Never put your expected answer in the judge prompt — it invites pattern-matching on your expectation.",
        "Order the verdict schema reasoning-first, then label: later tokens condition on earlier ones.",
        "Calibrate against 40–50 human labels and require Cohen's kappa above 0.6 before trusting a number.",
        "Pairwise comparison with both orderings beats absolute 1–10 scoring.",
      ],
      quiz: [
        {
          q: "Why must the judge's reasoning field come before its label?",
          options: [
            "For readability",
            "Later tokens condition on earlier ones — label-first makes the reasoning a post-hoc rationalisation",
            "Schemas require it",
            "It reduces tokens",
          ],
          answer: 1,
          why: "Autoregressive generation means each token is conditioned on what preceded it. A label emitted first is committed to before any analysis exists, and the reasoning that follows justifies it. Reasoning-first means the label follows from actual analysis — a free accuracy improvement.",
        },
        {
          q: "Why use Cohen's kappa instead of raw agreement percentage?",
          options: [
            "It's more standard",
            "Raw agreement is inflated when one label dominates — 90% agreement on a 90%-one-label set means nothing",
            "Kappa is easier to compute",
            "It handles multiple judges",
          ],
          answer: 1,
          why: "If 90% of your cases are 'fully_supported', a judge that always says 'fully_supported' achieves 90% raw agreement while having learned nothing. Kappa subtracts the agreement expected by chance, so it exposes exactly that failure.",
        },
        {
          q: "Why is pairwise comparison generally better than 1–10 scoring?",
          options: [
            "It's cheaper",
            "Judges compare reliably but score poorly on absolute scales, and comparison directly answers 'did my change help?'",
            "It avoids position bias",
            "It needs no rubric",
          ],
          answer: 1,
          why: "Absolute scales suffer compression — everything clusters at 7–8 — and drift between runs. Comparison needs no calibrated scale and matches the question you actually have. Note it does *not* avoid position bias; that's why you run both orderings.",
        },
        {
          q: "What's wrong with 'The correct answer is X. Does this response say X?'",
          options: [
            "It's too long",
            "Stating the expected answer invites the judge to pattern-match on your expectation rather than assess the response",
            "It should use a schema",
            "X might be wrong",
          ],
          answer: 1,
          why: "You've told the judge what conclusion you want, and preference-trained models are agreeable. The verdict now reflects your expectation rather than an independent assessment. Supply the criteria and the source material; never your conclusion.",
        },
      ],
      cards: [
        {
          f: "Name the six LLM-judge biases.",
          b: "Position (favours first), verbosity (prefers longer), self-preference (own model family), formatting (rewards bullets over substance), sycophancy (agrees with stated expectations), scale compression (clusters at 7–8 of 10).",
        },
        {
          f: "Why reasoning-before-label in a judge schema?",
          b: "Autoregressive generation conditions later tokens on earlier ones. Label-first makes the reasoning a rationalisation of an already-committed verdict; reasoning-first means the label follows real analysis.",
        },
        {
          f: "What kappa threshold before trusting a judge?",
          b: "Above 0.6 (good). Below 0.4 the judge is measuring something other than your criterion. Calibrate on 40–50 human labels and read every disagreement — most reveal rubric ambiguity.",
        },
        {
          f: "How do you debias pairwise judging for position?",
          b: "Run both orderings (A,B) and (B,A), invert the second verdict, and only declare a winner if both agree. Disagreement means genuine ambiguity — score it a tie rather than forcing a winner.",
        },
      ],
      resources: [
        {
          title: "Judging LLM-as-a-Judge (MT-Bench paper)",
          url: "https://arxiv.org/abs/2306.05685",
          kind: "paper",
        },
        {
          title: "Hamel Husain — Creating a LLM-as-Judge",
          url: "https://hamel.dev/blog/posts/llm-judge/",
          kind: "article",
        },
      ],
    },

    /* ------------------------------------------------------ */
    {
      id: "agent-evals",
      phase: "evals",
      title: "Agent & Trajectory Evaluation",
      subtitle:
        "Grading only the final answer misses almost everything that matters about an agent. This is the round that filters most candidates in agentic-AI interviews — and the one most teams skip.",
      minutes: 30,
      difficulty: "advanced",
      tags: ["evals", "agents", "trajectories"],
      lab: "trajectory",
      objectives: [
        "Explain why outcome-only grading is insufficient for agents",
        "Build a golden-trajectory anchor set and score it step by step",
        "Treat cost per task as a first-class eval signal, not a footnote",
      ],
      body: [
        {
          t: "p",
          text: "A single-turn system has one output to grade. An agent has a **trajectory**: a sequence of reasoning steps, tool calls, observations, retries, and a final answer. Grading only the last item is like reviewing a pull request by checking that the tests pass — sometimes adequate, frequently misleading.",
        },
        { t: "lab", id: "trajectory" },

        { t: "h", text: "Why outcome-only grading fails" },
        {
          t: "steps",
          items: [
            {
              title: "Right answer, indefensible path",
              text: "The agent guessed, or got lucky with a tool call that happened to return the answer. It passes today and breaks next week when the data shifts. You have no signal that it was fragile.",
            },
            {
              title: "Right answer, unacceptable cost",
              text: "Two agents can hit the same accuracy and differ by a large multiple in spend — reported gaps of 50× at equal accuracy are not unusual. Outcome-only evals score them identically.",
            },
            {
              title: "Right answer, unsafe route",
              text: "It read a record it had no business reading, or attempted a destructive tool the guardrail blocked. The outcome is fine; the trajectory is a security finding.",
            },
            {
              title: "Wrong answer, unclear cause",
              text: "Was it bad retrieval, a wrong tool, a malformed argument, an unrecovered tool error, or bad synthesis at the end? Without step-level scoring you cannot tell, so you cannot fix it.",
            },
          ],
        },
        {
          t: "note",
          kind: "insight",
          title: "Score per step, aggregate at the trajectory",
          text: "The standard mistake is grading the trajectory as one blob at the end. The pattern that works is the inverse: score each step against what a competent operator would have done at that point, then roll those up. That gives you a per-step accuracy you can actually act on — 'tool selection is 94% but argument construction is 71%' is a work item; 'the agent is 68% good' is not.",
        },

        { t: "h", text: "Golden trajectories" },
        {
          t: "p",
          text: "Read those failure cases carefully: in each one, outcome-only grading gives full marks to a run you would never want in production. That is the argument for grading the route as well as the destination.",
        },
        {
          t: "p",
          text: "A golden trajectory is a task where a human has written down not just the expected outcome but the expected *route*: which tools should be called, roughly in what order, with what arguments, and what a reasonable number of steps looks like. They're expensive to author and they are the anchor everything else calibrates against.",
        },
        {
          t: "table",
          head: ["Property", "Guidance"],
          rows: [
            [
              "How many",
              "50–100 hand-authored cases as an anchor set, covering your most critical user scenarios. Below ~30 you can't distinguish signal from noise.",
            ],
            [
              "Who writes them",
              "Someone who knows what *correct operation* looks like — a domain expert or the engineer who owns the tools.",
            ],
            [
              "What's recorded",
              "Task, expected outcome, required tool calls, forbidden tool calls, acceptable step range, cost ceiling.",
            ],
            [
              "Order strictness",
              "Usually partial. Encode genuine dependencies ('lookup before query') and leave the rest unordered, or you'll fail correct-but-different routes.",
            ],
            [
              "Refresh cadence",
              "Re-verify whenever tools change. A golden trajectory referencing a removed tool silently becomes a wrong test.",
            ],
          ],
        },
        {
          t: "code",
          lang: "python",
          caption: "A golden trajectory, and how to score against it",
          code: `GOLDEN = {
    "id": "billing-duplicate-charge-001",
    "task": "Customer j@example.com says they were charged twice in March.",

    # Outcome: what a correct final answer must contain.
    "outcome": {
        "must_mention": ["duplicate", "5 business days"],
        "must_cite": ["doc-3"],
        "must_not_do": ["issue_refund"],   # policy is automatic
    },

    # Route: required calls, with a genuine dependency encoded.
    "required_calls": [
        {"tool": "lookup_customer",
         "args_contain": {"email": "j@example.com"}},
        {"tool": "search_invoices", "after": "lookup_customer"},
        {"tool": "search_docs"},
    ],
    "forbidden_calls": ["issue_refund", "delete_records"],

    # Budgets. These are pass/fail criteria, not reporting.
    "max_steps": 8,
    "max_usd": 0.05,
    "max_seconds": 20,
}


def score_trajectory(golden, run) -> dict:
    """Per-step scores that roll up. Every field here is a
    deterministic check — no judge needed for any of it."""
    called = [c.tool for c in run.tool_calls]

    required = [r["tool"] for r in golden["required_calls"]]
    hit = [t for t in required if t in called]

    # Order: only the dependencies we actually declared.
    order_ok = True
    for r in golden["required_calls"]:
        if "after" in r and r["tool"] in called and r["after"] in called:
            if called.index(r["tool"]) < called.index(r["after"]):
                order_ok = False

    return {
        # --- route ---
        "tool_recall": len(hit) / len(required),
        "tool_precision": len(hit) / max(1, len(set(called))),
        "order_respected": order_ok,
        "no_forbidden": not (set(called) & set(golden["forbidden_calls"])),
        "arg_accuracy": arg_match_rate(golden, run),

        # --- efficiency (first-class, not a footnote) ---
        "steps": run.steps,
        "within_step_budget": run.steps <= golden["max_steps"],
        "usd": run.cost_usd,
        "within_cost_budget": run.cost_usd <= golden["max_usd"],
        "within_time_budget": run.seconds <= golden["max_seconds"],

        # --- recovery ---
        "tool_errors": run.tool_errors,
        "recovered": run.tool_errors > 0 and run.completed,

        # --- outcome ---
        "outcome_ok": check_outcome(golden["outcome"], run.answer),
    }`,
        },
        {
          t: "note",
          kind: "pro",
          title: "Almost all of this needs no judge model",
          text: "Look at that scorecard: tool recall, precision, ordering, forbidden calls, step count, spend, wall-clock, error count. Every one is a deterministic check over the trace. Teams reach for an LLM judge on agent evals far too early — grade the route in code, and reserve the judge for the one genuinely subjective question, which is whether the final answer was good.",
        },

        { t: "h", text: "The metric set" },
        {
          t: "p",
          text: 'A golden trajectory gives you a reference to score one run against. Turning that into an ongoing signal needs a metric set, and the useful ones separate "did it succeed" from "how well did it get there".',
        },
        {
          t: "table",
          head: ["Metric", "Question it answers", "How"],
          rows: [
            [
              "**Task success**",
              "Did it achieve the goal?",
              "Deterministic check against a stated success criterion",
            ],
            [
              "**Tool selection accuracy**",
              "Right tool, first time?",
              "Compare against required/forbidden lists",
            ],
            [
              "**Argument accuracy**",
              "Right arguments?",
              "Field-level match. Often the weakest link.",
            ],
            [
              "**Trajectory quality**",
              "Was the route defensible?",
              "Step-level scoring, rolled up",
            ],
            [
              "**Efficiency**",
              "Steps, tokens, spend, wall-clock",
              "From the trace. Regressions here are real regressions.",
            ],
            [
              "**Recovery rate**",
              "When a tool failed, did it adapt?",
              "Inject failures deliberately and measure",
            ],
            [
              "**Unsafe-attempt rate**",
              "How often did guardrails have to fire?",
              "Count blocked calls. Should trend down.",
            ],
            [
              "**Cost per task**",
              "What does one completion cost?",
              "p50 and p95, tracked per version",
            ],
          ],
        },
        {
          t: "note",
          kind: "money",
          title: "Cost is a first-class signal",
          text: "Modern eval frameworks emit cost alongside outcome, and for good reason: an agent that is 2 points more accurate for 8× the spend is usually the wrong trade, and outcome-only evals will recommend it. Report p50 and p95 cost per task next to every accuracy number, and set a per-task ceiling that fails the suite the way an accuracy floor does.",
        },

        { t: "h", text: "Deliberate failure injection" },
        {
          t: "p",
          text: "Those metrics measure the happy path. Production is not the happy path — tools time out, APIs return garbage, permissions get revoked — and an agent's response to that is the property most likely to differ between a demo and a system.",
        },
        {
          t: "p",
          text: "Recovery is the property that most distinguishes a robust agent from a demo, and you cannot measure it by waiting for real failures. Inject them.",
        },
        {
          t: "code",
          lang: "python",
          caption: "Fault injection as an eval dimension",
          code: `FAULTS = [
    ("timeout",      lambda: TimeoutError("tool timed out")),
    ("empty",        lambda: {"results": []}),
    ("malformed",    lambda: "not json at all"),
    ("wrong_shape",  lambda: {"unexpected_key": 1}),
    ("permission",   lambda: PermissionError("not authorised")),
    ("stale",        lambda: {"results": [...], "updated_at": "2019-01-01"}),
]

async def eval_recovery(golden, fault_name, fault):
    """Fail the FIRST call to the primary tool, then behave normally.
    A good agent adapts; a brittle one either gives up or loops."""
    run = await run_agent_with_fault(golden["task"], fault, fail_nth=1)
    return {
        "fault": fault_name,
        "completed": run.completed,
        "gave_up": run.steps < 3 and not run.completed,
        "thrashed": max_repeat_count(run.tool_calls) >= 3,
        "extra_cost": run.cost_usd - baseline_cost(golden["id"]),
        # The important one: did it tell the user what was wrong,
        # rather than inventing an answer to cover the gap?
        "disclosed_failure": mentions_limitation(run.answer),
    }`,
        },
        {
          t: "note",
          kind: "pitfall",
          title: "The failure mode fault injection reveals",
          text: "The most common and most damaging response to a failed tool is not giving up — it's **quietly answering anyway** from whatever the model already believed, with no indication that the lookup failed. That produces a confident, plausible, unsourced answer, and it is invisible unless you injected the fault yourself. `disclosed_failure` is the field worth watching.",
        },

        { t: "h", text: "Running these affordably" },
        {
          t: "p",
          text: "Agent evals are expensive in a way single-turn evals are not: each case is many model calls, and a full suite of a thousand trajectories can cost real money and take hours. That cost profile forces a tiered structure.",
        },
        {
          t: "table",
          head: ["Tier", "Cases", "When", "Cost control"],
          rows: [
            [
              "**Mocked**",
              "All of them",
              "Every commit",
              "Stub every tool with recorded fixtures. No model calls in the tool layer; near-free and fast.",
            ],
            [
              "**Anchor**",
              "20–30 goldens",
              "Every PR",
              "Real model, real tools against a fixture backend. Minutes and cents.",
            ],
            [
              "**Full**",
              "50–100 goldens + faults",
              "Nightly / pre-release",
              "Real everything. Budget it explicitly.",
            ],
            [
              "**Online**",
              "1–2% of traffic",
              "Continuous",
              "Deterministic route checks on all sampled runs; judge a fraction.",
            ],
          ],
        },
        {
          t: "note",
          kind: "pro",
          title: "Record and replay is the highest-leverage tooling here",
          text: "Capture real tool responses once, then replay them as fixtures. You get deterministic, fast, free eval runs for everything except the model's own decisions — which is exactly the variable you're trying to measure. This is the same insight as VCR-style HTTP fixtures in ordinary integration testing, and it applies unusually well.",
        },

        {
          t: "p",
          text: "All of which is more expensive than it sounds, and cost is the reason agent evals get skipped. Record-and-replay is the single technique that makes them routine rather than occasional.",
        },
        { t: "h", text: "What interviewers actually ask" },
        {
          t: "p",
          text: "The agentic-AI eval round is reportedly where most candidates get filtered, and the questions are consistent: how would you evaluate an agent that calls four tools in a loop; what is a golden trajectory; how do you score a partially-correct route; what's your cost-per-task budget and how do you enforce it. If you can answer those with specifics from something you built, you are past the filter.",
        },
        {
          t: "compare",
          left: {
            title: "A strong answer contains",
            kind: "good",
            items: [
              "A named anchor set size and where the cases came from",
              "Step-level metrics, not one aggregate number",
              "Deterministic route checks; judge only for the final answer",
              "Cost and step budgets as pass/fail criteria",
              "Fault injection to measure recovery",
              "A tiered run strategy with the cost implications stated",
            ],
          },
          right: {
            title: "A weak answer sounds like",
            kind: "bad",
            items: [
              "'We check whether it got the right answer'",
              "'We use an LLM to judge the trajectory'",
              "'We track accuracy' (one number, no slices)",
              "No mention of cost at all",
              "'We'd add evals once it's stable'",
              "Naming a framework instead of describing a method",
            ],
          },
        },

        {
          t: "check",
          key: "ae-1",
          q: "Two agent versions both score 91% task success. A costs $0.04 per task; B costs $0.31 and uses 3× the steps. Your eval reports only accuracy. What's the problem?",
          options: [
            "Nothing — they're equally good",
            "The eval is blind to an 8× cost difference and will happily recommend the worse system",
            "B is better because it's more thorough",
            "You need a bigger eval set",
          ],
          answer: 1,
          why: "Outcome-only evals treat these as identical, and at scale that 8× gap is the difference between a viable feature and an unviable one. Cost and step count belong next to every accuracy number, with an explicit per-task ceiling that can fail the suite. The extra steps are also a reliability signal: more steps means more places to go wrong.",
        },
      ],
      takeaways: [
        "Grade the trajectory, not just the outcome: right answers via lucky routes are fragile and unsafe routes are invisible.",
        "Score per step and aggregate up — 'tool selection 94%, argument accuracy 71%' is actionable; one number is not.",
        "Author 50–100 golden trajectories with required calls, forbidden calls, and explicit step/cost/time budgets.",
        "Almost every route check is deterministic. Reserve the judge for final-answer quality only.",
        "Inject tool faults deliberately: the dangerous response is answering anyway without disclosing the failure.",
      ],
      quiz: [
        {
          q: "What is a golden trajectory?",
          options: [
            "The cheapest path an agent can take",
            "A hand-authored case recording the expected outcome AND the expected route — required calls, forbidden calls, and step/cost budgets",
            "A trace from a successful production run",
            "The trajectory a reasoning model produces",
          ],
          answer: 1,
          why: "The defining feature is that a human recorded what correct *operation* looks like, not just the right answer. That's what lets you score a route as defensible or not, and it's why goldens are expensive to author and used as an anchor set of 50–100 rather than thousands.",
        },
        {
          q: "Why score per step rather than grading the whole trajectory at the end?",
          options: [
            "It's cheaper",
            "Per-step scores localise the fault — tool selection versus argument construction versus synthesis — so you know what to fix",
            "End-of-trajectory grading isn't possible",
            "It avoids needing golden trajectories",
          ],
          answer: 1,
          why: "One aggregate score tells you the agent is mediocre without telling you why. Step-level scoring that rolls up gives you separable numbers for tool choice, arguments, ordering, and final synthesis — each of which has a different fix.",
        },
        {
          q: "Which agent eval check genuinely requires an LLM judge?",
          options: [
            "Whether required tools were called",
            "Whether the final answer is a good response to the question",
            "Whether the step budget was respected",
            "Whether a forbidden tool was attempted",
          ],
          answer: 1,
          why: "Route checks — tool recall and precision, ordering, forbidden calls, step count, spend, wall-clock — are all deterministic reads over the trace and should be done in code. Final-answer quality is the one genuinely subjective judgement, and even there a reference answer plus pairwise comparison beats absolute scoring.",
        },
        {
          q: "You inject a tool timeout. The agent returns a confident answer with no mention of the failure. How should this score?",
          options: [
            "Pass — it completed the task",
            "Fail — it fabricated over a known gap without disclosing it, which is the most damaging recovery failure",
            "Pass with a warning about latency",
            "Inconclusive — retry the case",
          ],
          answer: 1,
          why: "Giving up loudly is recoverable; answering silently from prior belief is not, because nothing downstream can tell that the lookup failed. This is exactly what fault injection exists to surface, and `disclosed_failure` should be a hard criterion rather than a nice-to-have.",
        },
      ],
      cards: [
        {
          f: "What does a golden trajectory record?",
          b: "Task, expected outcome, required tool calls (with genuine dependencies), forbidden calls, and explicit max steps / max spend / max wall-clock. 50–100 of them as a hand-authored anchor set.",
        },
        {
          f: "Why score agent steps individually?",
          b: "It localises the fault. 'Tool selection 94%, argument accuracy 71%' is a work item; a single 'agent is 68% good' is not actionable.",
        },
        {
          f: "Which agent eval checks are deterministic?",
          b: "Tool recall and precision, order dependencies, forbidden-call attempts, argument field match, step count, cost, wall-clock, tool-error count. Only final-answer quality needs a judge.",
        },
        {
          f: "What's the most damaging tool-failure response, and how do you find it?",
          b: "Answering anyway from prior belief without disclosing that the lookup failed — a confident, unsourced answer. Only deliberate fault injection surfaces it; track a `disclosed_failure` criterion.",
        },
        {
          f: "How do you run agent evals affordably?",
          b: "Tiered: mocked tools with recorded fixtures on every commit (near-free), 20–30 anchor goldens per PR, full suite plus faults nightly, and deterministic route checks on 1–2% of production traffic.",
        },
      ],
      resources: [
        {
          title: "Confident AI — LLM agent evaluation metrics",
          url: "https://www.confident-ai.com/blog/llm-agent-evaluation-complete-guide",
          kind: "article",
        },
        {
          title: "Anthropic — Multi-agent research system",
          url: "https://www.anthropic.com/engineering/multi-agent-research-system",
          kind: "guide",
        },
      ],
    },

    /* ------------------------------------------------------ */
    {
      id: "evals-ci",
      phase: "evals",
      title: "Evals in CI & Online Monitoring",
      subtitle:
        "An eval suite you run manually is a document. One that gates every PR and samples production traffic is infrastructure.",
      minutes: 20,
      difficulty: "advanced",
      tags: ["evals", "ci", "monitoring"],
      objectives: [
        "Gate deploys on eval regressions without flaky builds",
        "Run online evals on production traffic affordably",
        "Detect drift before users report it",
      ],
      body: [
        {
          t: "p",
          text: "An eval suite you run by hand is a document. This chapter is about making it infrastructure — something that blocks a bad change without your involvement, and keeps measuring after the change ships. That second half is the part teams skip, and it is where the failures users actually see get caught.",
        },
        { t: "h", text: "The three tiers" },
        {
          t: "p",
          text: "The tension is between coverage and speed: a suite thorough enough to trust is too slow to run on every commit. The standard resolution is three tiers with different triggers.",
        },
        {
          t: "table",
          head: ["Tier", "Cases", "Runtime", "Trigger"],
          rows: [
            ["**Smoke**", "10–15, deterministic only", "< 30s", "Every commit"],
            ["**Gate**", "50–100, includes judges", "2–5 min", "Every PR"],
            [
              "**Full**",
              "300+, plus adversarial",
              "20–60 min",
              "Nightly and pre-release",
            ],
          ],
        },
        {
          t: "note",
          kind: "pro",
          title: "Keep the PR gate under five minutes",
          text: "A suite that takes twenty minutes gets skipped, or worse, people stop reading its output. Run deterministic checks on every commit for fast feedback, a moderate judged suite on PRs, and the exhaustive run nightly. Fast feedback that people actually use beats comprehensive feedback they route around.",
        },
        {
          t: "p",
          text: "Notice what the tiering is really doing: it separates checks by how much confidence they buy per second of runtime. Deterministic assertions are nearly free and catch the failures that should never reach review, so they run everywhere. Judged metrics are slow and noisy, so they run where a human is already waiting and can read a result. The exhaustive suite is where you put everything too slow to gate on but too important to never run.",
        },

        { t: "h", text: "Gating without flakiness" },
        {
          t: "p",
          text: "Tiers decide when a suite runs. The harder question is what makes it fail, and this is where eval gates usually go wrong in one of two opposite directions.",
        },
        {
          t: "code",
          lang: "python",
          caption: "Compare against a stored baseline, on the interval",
          code: `import json, sys

BASELINE = json.load(open("evals/baseline.json"))

# Hard floors: never regress below these regardless of baseline.
FLOORS = {
    "citations_resolve": 1.00,
    "valid_schema": 1.00,
    "not_truncated": 1.00,
}

# Allowed drop vs baseline, per metric. Tighter for metrics you
# care most about.
TOLERANCE = {
    "faithfulness": 0.02,
    "answer_relevance": 0.03,
    "abstains_correctly": 0.05,
}

def gate(current: dict, n: int) -> int:
    failures, warnings = [], []

    for metric, floor in FLOORS.items():
        if current[metric] < floor:
            failures.append(
                f"{metric} {current[metric]:.1%} < floor {floor:.0%}"
            )

    for metric, tol in TOLERANCE.items():
        base = BASELINE[metric]
        cur = current[metric]
        lo, hi = wilson_interval(round(cur * n), n)

        # Fail only if the INTERVAL clears the tolerance — a point
        # estimate alone produces flaky builds on small n.
        if hi < base - tol:
            failures.append(
                f"{metric} regressed {base:.1%} -> {cur:.1%} "
                f"(95% CI upper {hi:.1%}, tolerance {tol:.0%})"
            )
        elif cur < base - tol:
            warnings.append(f"{metric} may have regressed (n={n} too small)")

    for w in warnings:
        print(f"::warning::{w}")
    for f in failures:
        print(f"::error::{f}")

    return 1 if failures else 0

sys.exit(gate(run_evals(), n=len(CASES)))`,
        },
        {
          t: "note",
          kind: "warn",
          title: "Two failure modes of eval gates",
          text: "**Too strict** and the suite blocks legitimate changes over noise; people add `--skip-evals` and you've lost the whole benefit. **Too loose** and real regressions ship. Gate hard on deterministic invariants (citations must resolve, schema must validate — zero tolerance), and gate softly on judged metrics with confidence intervals and a small tolerance.",
        },
        {
          t: "p",
          text: "The asymmetry is the point, and it follows from the previous chapter: a deterministic assertion has no confidence interval, so failing it is unambiguous evidence of a bug. A judged score has an interval wide enough that ordinary variation crosses any tight threshold you set, so treating the two the same is what produces a gate people disable.",
        },

        {
          t: "check",
          key: "eci-mid",
          q: "Your CI eval gate fails about one PR in four for changes unrelated to the model. What is wrong?",
          options: [
            "The suite is too small, so noise dominates",
            "The gate is too strict — it is failing on movement inside the noise band",
            "Judged metrics are unsuitable for CI and should be removed",
          ],
          answer: 1,
          why: "A gate that fires on noise gets disabled, and then you have no gate at all. The fix is to gate hard only on deterministic invariants — citations resolve, schema validates, no PII — and softly on judged metrics, comparing against a baseline with a tolerance wide enough to clear the confidence interval. Removing judged metrics entirely throws away the signal you most wanted.",
        },
        { t: "h", text: "Online evals on production traffic" },
        {
          t: "p",
          text: "Everything so far tests what you thought to test. Your users are not limited to your imagination, which is why the offline suite is necessary and never sufficient.",
        },
        {
          t: "p",
          text: "Offline evals test what you thought to test. Online evals test what users actually do — including the queries you never imagined.",
        },
        {
          t: "code",
          lang: "python",
          caption: "Sampled, asynchronous, cheap",
          code: `SAMPLE_RATE = 0.02          # 2% of traffic

async def handle_request(req):
    result = await my_system(req)

    # Never block the user's response on evaluation.
    if random.random() < SAMPLE_RATE:
        asyncio.create_task(evaluate_async(req, result))

    return result


async def evaluate_async(req, result):
    scores = {
        # Deterministic checks on 100% of sampled traffic — free.
        "citations_resolve": check_citations(result),
        "under_latency": result.latency_ms < 3000,
        "no_pii": not detect_pii(result.text),
        "abstained": result.status != "answered",
    }

    # Judge only a fraction of the sample — this is the cost driver.
    if random.random() < 0.25:
        scores["faithfulness"] = await judge_faithfulness(req, result)

    await metrics.record(scores, tags={
        "model": result.model,
        "prompt_version": result.prompt_version,
        "retrieval_version": result.retrieval_version,
    })

    # Route anything that fails into tomorrow's eval set.
    if not all(v for v in scores.values() if isinstance(v, bool)):
        await eval_candidates.add(req, result, scores)`,
        },
        {
          t: "note",
          kind: "insight",
          title: "The last three lines are the important ones",
          text: "Online evals that only produce dashboards are half a system. Automatically routing failures into a review queue that feeds your offline eval set is what closes the loop — your test suite then grows precisely where production is weakest, without anyone having to remember to do it.",
        },

        { t: "h", text: "What to alert on" },
        {
          t: "p",
          text: "Scores in a dashboard nobody opens are not monitoring. A small number of signals are worth waking someone for.",
        },
        {
          t: "list",
          items: [
            "**Deterministic invariant broken** — a citation that doesn't resolve, invalid schema, PII in output. Page someone; these should be impossible.",
            "**Judged metric drop beyond the interval** — sustained over an hour, not a single sample.",
            "**Abstention rate change in either direction** — a fall means it's answering things it shouldn't; a spike means retrieval broke.",
            "**Cost per request rate-of-change** — catches cache misses and runaway loops in minutes, not on the monthly bill.",
            "**p95 latency by stage** — so you know which component regressed.",
            "**Thumbs-down rate by prompt version** — the cheapest real-user signal available, and it correlates with everything else.",
          ],
        },
        {
          t: "p",
          text: "Six signals is about the ceiling for a set of alerts anyone will keep responding to. What makes them useful is not the thresholds but the last clause of each: every one is scoped to a version or a stage, so firing tells you where to look rather than only that something is wrong.",
        },
        {
          t: "note",
          kind: "pitfall",
          title: "Tag every request with your versions",
          text: "Prompt version, retrieval config version, model version, index version. Without these tags a quality drop is an unsolvable mystery; with them it's a two-minute query against the deploy log. This is five lines of code and the single highest-value piece of instrumentation in an AI system.",
        },

        { t: "h", text: "Drift" },
        {
          t: "p",
          text: "Finally, the failure mode with no error message. Nothing breaks; the world moves, and your system's quality decays against it while every metric you own reports normal.",
        },
        {
          t: "table",
          head: ["Drift type", "Cause", "Detection"],
          rows: [
            [
              "**Model drift**",
              "Provider updated weights behind an alias",
              "Pin versions; run the full suite on a schedule regardless of your own changes",
            ],
            [
              "**Data drift**",
              "Corpus changed — new docs, deprecated pages",
              "Track index version; re-run retrieval evals after ingestion",
            ],
            [
              "**Query drift**",
              "Users started asking different things",
              "Cluster production queries monthly; compare against your eval set's distribution",
            ],
            [
              "**Prompt drift**",
              "Accumulated untracked edits",
              "Version prompts in git; require a version bump to deploy",
            ],
          ],
        },
        {
          t: "p",
          text: "Three of those four are detected by pinning a version and re-running on a schedule — which is why the schedule matters even in a week when you shipped nothing. The fourth is different in kind, and it is the one that quietly undermines everything else in this phase.",
        },
        {
          t: "note",
          kind: "warn",
          title: "Query drift silently invalidates your eval set",
          text: "Your suite was built for the questions users asked six months ago. If usage has shifted — a new feature launched, a different user segment arrived — you're measuring a workload that no longer exists while real quality quietly degrades. Cluster production queries monthly and compare the distribution against your eval set. When they diverge, refresh the set.",
        },

        {
          t: "check",
          key: "ci-1",
          q: "Your CI eval gate fails roughly one PR in four for changes unrelated to quality. Engineers now use `--skip-evals` routinely. What's the fix?",
          options: [
            "Enforce a policy against skipping",
            "Split into zero-tolerance deterministic invariants and interval-based judged metrics with a tolerance band, and move the slow exhaustive suite to nightly",
            "Remove the gate",
            "Use a larger eval set in CI",
          ],
          answer: 1,
          why: "A gate that fires on noise trains people to bypass it, which is worse than no gate because it also destroys trust in the numbers. Deterministic invariants — citations resolve, schema validates — should never flake and deserve zero tolerance. Judged metrics on a small sample are inherently noisy, so gate on the confidence interval with a tolerance band. Policy enforcement doesn't fix a false-positive problem; a bigger CI set makes it slower without fixing the flakiness.",
        },
      ],
      takeaways: [
        "Three tiers: smoke on every commit, gate on every PR (under five minutes), full suite nightly.",
        "Gate hard on deterministic invariants; gate softly on judged metrics using confidence intervals.",
        "A flaky gate gets bypassed, which is worse than no gate — it destroys trust in the numbers too.",
        "Sample 2% of production traffic asynchronously and route failures into your offline eval set.",
        "Tag every request with prompt, retrieval, model, and index versions. Five lines, enormous payoff.",
      ],
      quiz: [
        {
          q: "Why gate on a metric's confidence interval rather than its point estimate?",
          options: [
            "It's more rigorous",
            "Point estimates fluctuate run to run on small sets, producing flaky builds that get bypassed",
            "Intervals are cheaper",
            "CI systems require it",
          ],
          answer: 1,
          why: "On 50–100 cases, judged metrics move several points between runs from sampling variance alone. Gating on the point estimate blocks good PRs, engineers start skipping the gate, and you lose both the protection and the credibility of the numbers.",
        },
        {
          q: "What makes online evals valuable beyond offline ones?",
          options: [
            "They're cheaper",
            "They cover real user behaviour, including query types you never thought to test",
            "They're faster",
            "They don't need labels",
          ],
          answer: 1,
          why: "An offline suite tests your imagination of the workload. Production traffic contains the phrasings, ambiguities, and topics you didn't anticipate — which is exactly where quality problems hide. Routing sampled failures back into the offline set closes the loop.",
        },
        {
          q: "Why tag requests with prompt and retrieval config versions?",
          options: [
            "For billing",
            "So a quality drop becomes a two-minute query against the deploy log instead of an unsolvable mystery",
            "For compliance",
            "To enable caching",
          ],
          answer: 1,
          why: "When faithfulness drops 6% you need to know what changed. Version tags let you slice metrics by deployed configuration and identify the culprit immediately. Without them you're guessing across every change made that week.",
        },
        {
          q: "How does query drift invalidate an eval set?",
          options: [
            "Cases become stale",
            "The suite measures a workload users no longer have, so real degradation goes unnoticed",
            "Judges drift over time",
            "The corpus changes",
          ],
          answer: 1,
          why: "If usage shifts — a new feature, a new user segment — your eval set still tests last year's question distribution. Metrics stay green while actual quality on current traffic falls. Cluster production queries monthly and compare distributions.",
        },
      ],
      cards: [
        {
          f: "What are the three eval CI tiers?",
          b: "Smoke: 10–15 deterministic cases, <30s, every commit. Gate: 50–100 with judges, 2–5 min, every PR. Full: 300+ with adversarial, 20–60 min, nightly and pre-release.",
        },
        {
          f: "How do you gate on evals without flaky builds?",
          b: "Zero tolerance on deterministic invariants (citations resolve, schema validates). For judged metrics, compare against a stored baseline using the confidence interval plus a small tolerance band.",
        },
        {
          f: "How should online evals be structured?",
          b: "Sample ~2% of traffic, evaluate asynchronously so the user never waits, run deterministic checks on all sampled requests, judge a fraction of those, and route failures into your offline eval set.",
        },
        {
          f: "Name the four drift types.",
          b: "Model drift (provider updated weights behind an alias), data drift (corpus changed), query drift (users ask different things — silently invalidates your eval set), prompt drift (untracked edits).",
        },
      ],
      resources: [
        {
          title: "Braintrust — evaluation platform docs",
          url: "https://www.braintrust.dev/docs",
          kind: "docs",
        },
        {
          title: "OpenAI Evals",
          url: "https://github.com/openai/evals",
          kind: "repo",
        },
      ],
    }
  );
})(window);
