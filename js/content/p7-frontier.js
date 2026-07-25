/* ============================================================
   Phase 08 — Frontier, Specialisation & Career
   ============================================================ */
(function (global) {
  "use strict";
  var C = global.Curriculum;

  C.chapters.push(
    /* ------------------------------------------------------ */
    {
      id: "finetuning-decision",
      phase: "frontier",
      title: "Fine-Tuning vs Prompting vs RAG",
      subtitle:
        "The decision people get wrong most often. Fine-tuning teaches form, retrieval supplies facts, and prompting does more than you'd expect.",
      minutes: 20,
      difficulty: "advanced",
      tags: ["fine-tuning", "decisions"],
      objectives: [
        "Route a problem to the right technique with a clear rule",
        "Know what fine-tuning genuinely delivers and what it can't",
        "Estimate whether fine-tuning pays for itself",
      ],
      body: [
        {
          t: "p",
          text: "One rule resolves most of the confusion: **fine-tuning changes behaviour; retrieval changes knowledge.** If your problem is 'the model doesn't know X', fine-tuning is the wrong tool — and it will appear to work on your test set while failing in ways that are hard to diagnose.",
        },
        {
          t: "table",
          head: ["Problem", "Technique", "Why"],
          rows: [
            [
              "Doesn't know your internal facts",
              "**RAG**",
              "Facts belong in context, not weights",
            ],
            [
              "Won't follow your output format",
              "**Prompting** → then fine-tuning",
              "Schema mode usually solves it entirely",
            ],
            [
              "Wrong tone or house style",
              "**Fine-tuning**",
              "Style is behavioural; hard to specify, easy to demonstrate",
            ],
            [
              "Needs domain jargon and conventions",
              "**Fine-tuning** + RAG",
              "Fine-tune the register, retrieve the specifics",
            ],
            [
              "Too slow or expensive at volume",
              "**Fine-tune a small model**",
              "Distil a proven task into something cheap",
            ],
            [
              "Facts change weekly",
              "**RAG**",
              "Re-fine-tuning weekly is untenable",
            ],
            [
              "Needs multi-step reasoning",
              "**Better model / reasoning model**",
              "Fine-tuning rarely adds reasoning capability",
            ],
            [
              "Long, complex prompt you'd like to shorten",
              "**Fine-tuning**",
              "Bake the instructions into weights, cut per-call tokens",
            ],
          ],
        },
        {
          t: "note",
          kind: "pitfall",
          title: "Why fine-tuning facts fails badly",
          text: "Train on 500 examples containing your product's pricing and the model learns the *shape* of pricing answers, not the specific numbers. It will then produce confident, well-formatted, fluent pricing that is wrong — arguably worse than not knowing, because it looks authoritative and carries no citation to check. Facts belong in the context window where you can verify them.",
        },

        { t: "h", text: "What fine-tuning genuinely delivers" },
        {
          t: "compare",
          left: {
            title: "Delivers well",
            kind: "good",
            items: [
              "Consistent output format without prompt scaffolding",
              "Domain tone, register, and conventions",
              "Shorter prompts (instructions live in the weights)",
              "A small model matching a large one on one narrow task",
              "Lower latency and unit cost at volume",
            ],
          },
          right: {
            title: "Doesn't deliver",
            kind: "bad",
            items: [
              "New factual knowledge that stays current",
              "General reasoning improvement",
              "Reliable behaviour on inputs unlike your training data",
              "Anything you couldn't demonstrate in 500 examples",
              "A fix for a problem you haven't diagnosed",
            ],
          },
        },

        { t: "h", text: "The methods" },
        {
          t: "table",
          head: ["Method", "Cost", "Use when"],
          rows: [
            [
              "**Prompting + few-shot**",
              "Free",
              "Always try first. Solves more than people expect.",
            ],
            [
              "**LoRA / QLoRA**",
              "Low — hours on one GPU",
              "The default for fine-tuning. Small adapter, base model untouched, easy to swap or revert.",
            ],
            [
              "**Full fine-tuning**",
              "High",
              "Rarely justified for application work. Risks catastrophic forgetting.",
            ],
            [
              "**Distillation**",
              "Medium",
              "Generate training data with a large model, train a small one. The main path to a cheap specialist.",
            ],
            [
              "**Preference tuning (DPO)**",
              "Medium",
              "You have pairwise preference data — usually from production thumbs up/down.",
            ],
          ],
        },
        {
          t: "note",
          kind: "insight",
          title: "Distillation is the pattern that actually earns its keep",
          text: "Run a frontier model on your task until quality is proven and you have thousands of validated outputs. Use those as training data for a small model. You get a specialist at a fraction of the cost and latency, and you already know the task is solvable because the big model solved it. This is a far better path than fine-tuning speculatively from hand-labelled data.",
        },

        { t: "h", text: "Does it pay for itself?" },
        {
          t: "code",
          lang: "text",
          caption: "The arithmetic to do before committing",
          code: `Costs
  Data preparation      1,000 examples, cleaned + validated
                        -> 20-60 engineer-hours (the real cost)
  Training runs         a few hundred dollars for LoRA, plus retries
  Eval harness          you need this anyway; build it first
  Hosting               dedicated endpoint OR per-token premium
  Maintenance           retrain on base model upgrades, drift,
                        and every task change

Savings
  (prompted cost/req - tuned cost/req) x requests/month
  + latency improvement, if it has product value

Worked example
  Prompted:  4,000 input tok (long instructions) @ mid-tier
             ~= $0.014/req
  Tuned:     600 input tok (instructions in weights), small model
             ~= $0.0011/req
  Saving:    ~$0.0129/req

  At 100k req/month  -> ~$1,290/month saved
  Setup cost         -> ~$8,000 (mostly engineer time)
  Payback            -> ~6 months, IF the task stays stable

  At 5k req/month    -> ~$65/month saved. Payback: never.
                        Do not fine-tune.`,
        },
        {
          t: "note",
          kind: "money",
          title: "Volume is the deciding variable",
          text: "Fine-tuning is a fixed cost amortised over requests. Under roughly 50k requests/month on a stable task, the engineering time almost never pays back — and the maintenance burden (retraining on every base-model upgrade and task change) is a recurring tax people forget to count. Ship prompted first, measure real volume, then revisit.",
        },

        { t: "h", text: "If you do fine-tune" },
        {
          t: "list",
          ordered: true,
          items: [
            "**Build the eval set first.** Without it you cannot tell whether the tuned model is better, and 'it feels better' is not a basis for a model deployment.",
            "**Quality over quantity.** 500 excellent, consistent examples beat 5,000 noisy ones. Inconsistent labels teach inconsistency.",
            "**Hold out a real test set** the model never sees during training or hyperparameter selection.",
            "**Check for regression on general capability.** Fine-tuning on a narrow task can degrade unrelated abilities — catastrophic forgetting is real, especially with full fine-tuning.",
            "**Version everything.** Base model, dataset, hyperparameters, adapter weights. Reproducibility matters more here than anywhere else in the stack.",
            "**Plan for base-model upgrades.** When the base improves, your adapter needs retraining, and sometimes the new base model matches your tuned old one out of the box.",
          ],
        },

        {
          t: "check",
          key: "ft-1",
          q: "Your support bot gives wrong answers about your product's current pricing. Which approach?",
          options: [
            "Fine-tune on 2,000 pricing conversations",
            "RAG over your pricing documentation with citation requirements",
            "A larger model",
            "More few-shot examples of pricing answers",
          ],
          answer: 1,
          why: "Pricing is a fact that changes, and facts belong in the context window. Fine-tuning would teach the model to produce confident, well-formatted pricing answers with the wrong numbers — and re-training every time you change a price is untenable. Retrieval keeps the numbers current, gives you a citation to verify, and lets you update pricing by editing a document.",
        },
      ],
      takeaways: [
        "Fine-tuning changes behaviour; retrieval changes knowledge. This rule resolves most confusion.",
        "Fine-tuning facts produces confident, well-formatted, wrong answers — worse than not knowing.",
        "LoRA is the default method; distillation from a proven frontier-model pipeline is the pattern that pays.",
        "Under ~50k requests/month on a stable task, fine-tuning rarely pays back its engineering cost.",
        "Build the eval set before fine-tuning, and check for regression on general capability.",
      ],
      quiz: [
        {
          q: "What's the core rule for choosing between fine-tuning and RAG?",
          options: [
            "Fine-tuning is for large datasets, RAG for small",
            "Fine-tuning changes behaviour; retrieval changes knowledge",
            "Fine-tuning is cheaper long-term",
            "RAG is for text, fine-tuning for structured data",
          ],
          answer: 1,
          why: "Weights encode patterns of behaviour — format, tone, register, conventions. Context encodes specific current facts. Matching the technique to which of those your problem is fixes the great majority of mis-selections.",
        },
        {
          q: "Why does fine-tuning on factual data fail?",
          options: [
            "It needs too much data",
            "The model learns the shape of such answers, not the specific facts, then produces confident well-formatted wrong output",
            "Facts can't be tokenised",
            "It's too slow",
          ],
          answer: 1,
          why: "Training on 500 pricing conversations teaches the pattern of pricing responses. Specific numbers aren't reliably memorised, so you get fluent, authoritative, uncitable, wrong pricing. That's arguably worse than not knowing, because nothing signals the error.",
        },
        {
          q: "What is distillation and why is it the fine-tuning pattern that works?",
          options: [
            "Compressing a model's weights",
            "Using a proven frontier-model pipeline's outputs as training data for a small model — you already know the task is solvable",
            "Removing training data",
            "Merging multiple models",
          ],
          answer: 1,
          why: "You run the large model in production until quality is validated, accumulating thousands of good outputs. Training a small model on those gives you a cheap specialist with the risk already removed — you're not gambling on whether the task is learnable.",
        },
        {
          q: "At 5,000 requests/month, should you fine-tune to save $0.013 per request?",
          options: [
            "Yes — savings compound",
            "No — that's ~$65/month against thousands in setup plus ongoing maintenance",
            "Only with LoRA",
            "Only if latency matters",
          ],
          answer: 1,
          why: "Fine-tuning is a fixed cost amortised over volume. $65/month against $8,000 of setup never pays back, and the recurring maintenance — retraining on base-model upgrades and task changes — makes it worse. Volume is the deciding variable.",
        },
      ],
      cards: [
        {
          f: "What's the fine-tuning vs RAG rule?",
          b: "Fine-tuning changes behaviour (format, tone, register, conventions); retrieval changes knowledge (specific current facts). Match the technique to which one your problem actually is.",
        },
        {
          f: "Why does fine-tuning on facts fail?",
          b: "The model learns the shape of such answers rather than reliably memorising specifics, producing confident, well-formatted, uncitable wrong output. Worse than not knowing, since nothing signals the error.",
        },
        {
          f: "What's the volume threshold for fine-tuning to pay back?",
          b: "Roughly 50k requests/month on a stable task. Below that, the engineering time (20–60 hours of data prep) plus recurring maintenance on base-model upgrades never amortises.",
        },
        {
          f: "What is distillation?",
          b: "Use a proven frontier-model pipeline's validated outputs as training data for a small model. You get a cheap specialist with the learnability risk already eliminated — the fine-tuning pattern that reliably pays.",
        },
      ],
      resources: [
        {
          title: "LoRA paper",
          url: "https://arxiv.org/abs/2106.09685",
          kind: "paper",
        },
        {
          title: "OpenAI — Fine-tuning guide",
          url: "https://platform.openai.com/docs/guides/fine-tuning",
          kind: "docs",
        },
      ],
    },

    /* ------------------------------------------------------ */
    {
      id: "multimodal",
      phase: "frontier",
      title: "Multimodal Systems",
      subtitle:
        "Vision, audio, and document understanding are now ordinary features. The engineering differs from text in ways that matter: cost, latency, and failure modes.",
      minutes: 20,
      difficulty: "intermediate",
      tags: ["multimodal", "vision", "audio"],
      objectives: [
        "Estimate the cost of image and audio inputs",
        "Choose between a vision model and a specialist parser",
        "Design multimodal features that degrade gracefully",
      ],
      body: [
        { t: "h", text: "Vision: what it's actually good at" },
        {
          t: "table",
          head: ["Task", "Verdict"],
          rows: [
            ["Describing image content", "Excellent"],
            [
              "Reading text in images (OCR)",
              "Very good, and better than traditional OCR on messy layouts",
            ],
            [
              "Understanding charts and diagrams",
              "Good — reads trends reliably, misreads precise values",
            ],
            [
              "Extracting tables from documents",
              "**Often beats dedicated parsers**, especially on merged cells and irregular layouts",
            ],
            [
              "Reading UI screenshots",
              "Good, and the foundation of computer-use agents",
            ],
            [
              "Precise spatial measurement",
              "Poor. Don't ask for pixel coordinates or exact dimensions.",
            ],
            [
              "Counting many similar objects",
              "Poor beyond roughly a dozen items",
            ],
            [
              "Reading dense handwriting",
              "Variable. Test on your actual samples.",
            ],
          ],
        },
        {
          t: "note",
          kind: "insight",
          title:
            "Vision models for document parsing is genuinely a better default now",
          text: "For PDFs with complex layouts, multi-column text, merged table cells, or embedded charts, sending a page image to a vision model frequently produces better structured output than a traditional PDF parser plus OCR. It's more expensive per page but a great deal less code — and it handles the irregular cases that break rule-based parsers. Benchmark both on your own documents.",
        },

        { t: "h", text: "Image cost, which surprises people" },
        {
          t: "code",
          lang: "text",
          caption: "Images are expensive input",
          code: `Images are billed as tokens, roughly proportional to area.
Providers tile the image and charge per tile.

  Small thumbnail (512x512)     ~   250 tokens
  Standard screenshot (1024x768) ~ 1,100 tokens
  Full page scan (1536x2048)     ~ 2,800 tokens
  High-res photo (2048x2048)     ~ 3,500 tokens

Practical consequences

  A 40-page PDF at full resolution
    -> ~110,000 input tokens for ONE request
    -> at $3/M input, ~$0.33 per document, per call

  A conversation with 8 screenshots
    -> ~9,000 tokens of images resent on EVERY subsequent turn,
       because the API is stateless

Levers
  1. Downscale before sending. Most tasks don't need full
     resolution - test where quality actually degrades.
  2. Crop to the region of interest.
  3. Extract once, then discard the image. Store the structured
     text and drop the pixels from the conversation.
  4. Cache aggressively - image prefixes cache like text.`,
        },
        {
          t: "note",
          kind: "pitfall",
          title: "Images accumulate in conversation history",
          text: "Because the API is stateless, every image in the history is resent with every turn. Eight screenshots in a conversation means ~9,000 image tokens on turn nine, turn ten, and so on. Extract what you need from an image once, replace it in the history with the extracted text, and drop the image. This is one of the largest silent cost sinks in multimodal apps.",
        },

        { t: "h", text: "Audio" },
        {
          t: "list",
          items: [
            "**Transcription-then-text** is the cheap, controllable path: run speech-to-text, then process the transcript with your existing text pipeline. Loses tone, emotion, and speaker overlap.",
            "**Native audio models** understand tone, emphasis, and non-speech cues, and enable genuine speech-to-speech interaction. More expensive and harder to evaluate.",
            "**Real-time voice** needs a fundamentally different architecture: streaming both directions, voice-activity detection, interruption handling, and sub-500ms round trips. Not a small feature.",
            "**Diarisation** (who spoke when) is a separate capability. Don't assume your transcription model does it well.",
          ],
        },

        { t: "h", text: "Multimodal RAG" },
        {
          t: "p",
          text: "Retrieving over images and documents needs a decision about what you actually index.",
        },
        {
          t: "table",
          head: ["Approach", "How", "Trade-off"],
          rows: [
            [
              "**Caption then embed text**",
              "Generate a description, embed that",
              "Cheap, searchable with existing text infra; loses visual detail",
            ],
            [
              "**Multimodal embeddings**",
              "Embed images and text into one shared space (CLIP-style)",
              "True cross-modal search; weaker on fine detail and text-in-image",
            ],
            [
              "**Both, fused**",
              "Index captions and image vectors, fuse with RRF",
              "**Usually best.** Same reasoning as hybrid text search.",
            ],
            [
              "**Page-image retrieval**",
              "Retrieve page images, pass them to a vision model",
              "Excellent for documents where layout carries meaning",
            ],
          ],
        },
        {
          t: "note",
          kind: "pro",
          title: "Caption for retrieval, keep the original for generation",
          text: "Generate a rich caption to make the image findable, but pass the *actual image* to the model when answering. The caption is a search key; the image is the evidence. Answering from a caption alone loses exactly the detail the user is asking about — a pattern directly analogous to parent-child retrieval in text.",
        },

        { t: "h", text: "Failure modes and graceful degradation" },
        {
          t: "list",
          items: [
            "**Unsupported formats.** HEIC, TIFF, animated GIFs, and password-protected PDFs all fail. Convert or reject with a clear message, never silently.",
            "**Size limits.** Providers cap dimensions and file size. Resize before sending rather than surfacing a provider error to the user.",
            "**Injection via images.** Text inside an image is read as text. An uploaded screenshot containing 'ignore previous instructions' is a live injection vector, and it bypasses text-based input filters entirely.",
            "**Confident misreading.** A vision model will read a chart value wrongly with complete confidence. For anything numeric, require it to quote the axis labels and state its uncertainty.",
            "**Cost blowouts.** A user uploading twenty high-resolution photos is an expensive request. Rate limit by pixels, not just by request count.",
          ],
        },
        {
          t: "note",
          kind: "warn",
          title: "Image-based injection bypasses your text filters",
          text: "If you scan user text for injection patterns but pass uploaded images through untouched, you have a gap. Text rendered in an image reaches the model as instructions with no filtering. Treat image-derived text with exactly the same distrust as any other untrusted input — and remember the lethal trifecta test applies to it.",
        },

        {
          t: "check",
          key: "mm-2",
          q: "Your app lets users upload screenshots and chat about them. After several turns, costs spike well beyond expectations. Most likely cause?",
          options: [
            "Images are more expensive than documented",
            "Every image in the conversation history is resent on every turn, since the API is stateless",
            "The model reprocesses images each time internally",
            "Image caching is disabled",
          ],
          answer: 1,
          why: "Statelessness applies to images exactly as it does to text. Eight screenshots at ~1,100 tokens each means ~9,000 image tokens resent on every subsequent turn, and the growth is quadratic across the conversation. Extract what you need from each image once, replace it in history with the extracted text, and drop the image.",
        },
      ],
      takeaways: [
        "Vision models often beat dedicated parsers on complex document layouts and tables.",
        "Images cost roughly 250–3,500 tokens each; downscale, crop, and extract-then-discard.",
        "Images accumulate in stateless conversation history — a major silent cost sink.",
        "For multimodal RAG, caption for retrieval but pass the original image for generation.",
        "Text inside an uploaded image is an injection vector that bypasses text-based input filters.",
      ],
      quiz: [
        {
          q: "Roughly how many input tokens is a 1024x768 screenshot?",
          options: ["~100", "~1,100", "~5,000", "~20,000"],
          answer: 1,
          why: "Providers tile images and bill roughly by area — a standard screenshot lands around 1,000–1,200 tokens. Worth internalising, because it means a handful of images can dominate a request's input cost.",
        },
        {
          q: "In multimodal RAG, why keep the original image for generation rather than answering from the caption?",
          options: [
            "Captions are inaccurate",
            "The caption is a search key with limited detail; the image is the actual evidence the question is about",
            "Images are cheaper",
            "Captions can't be cited",
          ],
          answer: 1,
          why: "A caption compresses an image into a few sentences — enough to make it findable, not enough to answer a specific question about it. Passing the original at generation time is the same reasoning as parent-child retrieval: index small and precise, generate from complete evidence.",
        },
        {
          q: "Why is an uploaded image a prompt-injection vector?",
          options: [
            "Images can carry malware",
            "Text rendered in an image is read as text by the model, bypassing text-based input filters",
            "Image metadata can contain code",
            "Images can't be sanitised",
          ],
          answer: 1,
          why: "A vision model reads text in an image and it enters the context as instructions. If your injection filtering only inspects the text field, an uploaded screenshot containing an injected instruction passes straight through. Apply the same distrust to image-derived text as to any untrusted input.",
        },
      ],
      cards: [
        {
          f: "Image token costs by size?",
          b: "Thumbnail 512² ≈ 250 tok. Screenshot 1024×768 ≈ 1,100 tok. Page scan 1536×2048 ≈ 2,800 tok. High-res photo 2048² ≈ 3,500 tok. Billed roughly by area.",
        },
        {
          f: "Why do multimodal conversations get expensive fast?",
          b: "The API is stateless, so every image in the history is resent on every turn. Extract what you need once, replace the image in history with the extracted text, and drop the pixels.",
        },
        {
          f: "Best approach for multimodal RAG?",
          b: "Index both captions (text embeddings) and image vectors, fuse with RRF. Caption for retrieval; pass the ORIGINAL image for generation — the caption is a search key, the image is the evidence.",
        },
        {
          f: "Why are uploaded images an injection risk?",
          b: "Text rendered inside an image is read as text and enters the context as instructions, bypassing any filter that only inspects the text field. The lethal trifecta test applies to image-derived content too.",
        },
      ],
      resources: [
        {
          title: "Anthropic — Vision",
          url: "https://docs.anthropic.com/en/docs/build-with-claude/vision",
          kind: "docs",
        },
        {
          title: "ColPali — document retrieval with vision",
          url: "https://arxiv.org/abs/2407.01449",
          kind: "paper",
        },
      ],
    },

    /* ------------------------------------------------------ */
    {
      id: "local-models",
      phase: "frontier",
      title: "Small Models & Local Inference",
      subtitle:
        "Open-weight models running on your own hardware are a real option now. Here's when it's the right call and what it actually costs.",
      minutes: 18,
      difficulty: "advanced",
      tags: ["local", "open-weights", "quantisation"],
      objectives: [
        "Decide between hosted APIs and self-hosted inference",
        "Understand quantisation and its quality trade-off",
        "Estimate the true cost of self-hosting",
      ],
      body: [
        { t: "h", text: "When self-hosting is the right answer" },
        {
          t: "compare",
          left: {
            title: "Self-host",
            kind: "good",
            items: [
              "Data genuinely cannot leave your environment",
              "Very high, steady volume on a narrow task",
              "Sub-50ms latency requirement (no network hop)",
              "Offline or air-gapped operation",
              "You need full control over the model version",
            ],
          },
          right: {
            title: "Use the API",
            kind: "bad",
            items: [
              "Variable or low volume",
              "You need frontier capability",
              "You have no ML-ops capacity",
              "Time to market matters",
              "You want provider features: caching, schema modes, tools",
            ],
          },
        },
        {
          t: "note",
          kind: "pitfall",
          title: "Self-hosting is rarely cheaper than it looks",
          text: "A GPU instance costs the same whether it's saturated or idle, so your break-even depends entirely on utilisation. At 10% utilisation you're paying ten times the effective per-token rate. Add engineering time for serving, monitoring, batching, upgrades, and on-call — that's typically the dominant cost and the one omitted from comparisons.",
        },

        { t: "h", text: "Quantisation" },
        {
          t: "p",
          text: "Model weights are normally 16-bit floats. Quantisation stores them at lower precision — 8-bit, 4-bit, or lower — cutting memory and increasing throughput at some quality cost.",
        },
        {
          t: "table",
          head: ["Precision", "Memory for a 70B model", "Quality"],
          rows: [
            ["FP16 / BF16", "~140 GB", "Baseline"],
            ["INT8", "~70 GB", "Nearly indistinguishable on most tasks"],
            [
              "INT4 (Q4_K_M)",
              "~40 GB",
              "Small measurable degradation; usually acceptable",
            ],
            [
              "INT3 and below",
              "~28 GB",
              "Noticeable degradation, especially on reasoning",
            ],
          ],
        },
        {
          t: "note",
          kind: "insight",
          title: "The rule of thumb worth remembering",
          text: "A 4-bit quantisation of a larger model generally beats full precision of a much smaller one at the same memory budget. If you have 40GB of VRAM, a 4-bit 70B model usually outperforms a 16-bit 13B model. Prefer more parameters at lower precision over fewer at higher precision — up to about 4 bits, below which quality falls off sharply.",
        },

        { t: "h", text: "The serving stack" },
        {
          t: "table",
          head: ["Tool", "For"],
          rows: [
            [
              "**Ollama**",
              "Local development and single-user use. Trivial setup.",
            ],
            [
              "**llama.cpp**",
              "CPU and Apple Silicon inference; heavily quantised models; edge deployment.",
            ],
            [
              "**vLLM**",
              "Production serving. Continuous batching and PagedAttention give large throughput gains.",
            ],
            [
              "**SGLang**",
              "Production serving with strong structured-output and prefix-caching support.",
            ],
            [
              "**TGI**",
              "Hugging Face's production server; well integrated with their ecosystem.",
            ],
          ],
        },
        {
          t: "note",
          kind: "pro",
          title: "Continuous batching is the whole game for throughput",
          text: "Naive serving processes one request at a time and leaves the GPU mostly idle. Continuous batching interleaves requests at the token level, so new requests join a batch already in flight. This is often a 5–20× throughput improvement over naive serving, and it's the single reason to use vLLM or SGLang rather than a simple inference loop.",
        },

        { t: "h", text: "Where small models genuinely win" },
        {
          t: "list",
          items: [
            "**Classification and routing.** A small model at temperature 0 matches a frontier model on a well-defined label set, at a fraction of the cost.",
            "**Extraction from clean text.** Structured output from well-formed input is not a capability-limited task.",
            "**Moderation and PII detection.** High volume, narrow task, latency-sensitive — the ideal profile.",
            "**Reranking.** Cross-encoders are small by design and this is exactly their job.",
            "**Embeddings.** Self-hosting embedding models removes per-query cost entirely and they're small enough to be genuinely cheap.",
            "**Distilled specialists.** A small model fine-tuned on a proven task, per the previous chapter.",
          ],
        },
        {
          t: "code",
          lang: "python",
          caption: "A hybrid architecture that gets the best of both",
          code: `# The pattern most mature systems land on: local models for the
# high-volume mechanical work, hosted frontier for the hard tail.

async def handle(req):
    # Local, ~10ms, zero marginal cost
    intent = await local_classify(req.text)
    if intent == "spam":
        return reject()

    # Local embeddings - no per-query API cost, no network hop
    qvec = await local_embed(req.text)
    candidates = await vector_search(qvec, req.tenant, k=50)

    # Local reranker - small cross-encoder, fast
    chunks = await local_rerank(req.text, candidates)[:5]

    # Hosted frontier model only for generation, where capability
    # actually matters and volume is one call per request.
    return await hosted_llm.generate(req.text, chunks)

# Result: three of four model calls never leave your infrastructure,
# and you still get frontier quality where it counts.`,
        },

        {
          t: "check",
          key: "lm-1",
          q: "You have 48GB of VRAM. Which gives better quality?",
          options: [
            "A 13B model at FP16",
            "A 70B model at 4-bit quantisation",
            "Two 7B models ensembled",
            "A 34B model at 8-bit",
          ],
          answer: 1,
          why: "At a fixed memory budget, more parameters at lower precision generally beats fewer at higher precision — down to about 4 bits, where quality degrades gracefully. A 4-bit 70B model fits in roughly 40GB and typically outperforms a 16-bit 13B model clearly. The 8-bit 34B option is a reasonable second choice; ensembling small models adds latency without matching a larger model's capability.",
        },
      ],
      takeaways: [
        "Self-host for hard data-residency requirements, very high steady volume, or offline operation.",
        "GPU cost is fixed regardless of utilisation — low utilisation destroys the economics.",
        "At a fixed memory budget, prefer more parameters at 4-bit over fewer at 16-bit.",
        "Continuous batching (vLLM, SGLang) is a 5–20× throughput win over naive serving.",
        "The mature pattern is hybrid: local classification, embeddings, and reranking; hosted frontier for generation.",
      ],
      quiz: [
        {
          q: "At a fixed VRAM budget, what's the general rule?",
          options: [
            "Always use the highest precision available",
            "More parameters at lower precision beats fewer at higher precision, down to about 4 bits",
            "Model size doesn't matter with quantisation",
            "Always use the smallest model that fits",
          ],
          answer: 1,
          why: "Quantisation to 4 bits degrades quality modestly, while halving parameter count degrades it substantially. So a 4-bit 70B generally beats a 16-bit 13B in the same memory. Below roughly 3 bits the trade-off reverses as degradation accelerates.",
        },
        {
          q: "Why is continuous batching so important for self-hosted serving?",
          options: [
            "It reduces memory usage",
            "It interleaves requests at the token level, giving 5–20× throughput over naive one-at-a-time serving",
            "It improves output quality",
            "It enables quantisation",
          ],
          answer: 1,
          why: "Naive serving leaves the GPU idle between requests. Continuous batching lets new requests join an in-flight batch at token granularity, keeping the GPU saturated. It's the primary reason to run vLLM or SGLang rather than a simple inference loop.",
        },
        {
          q: "What's the most commonly omitted cost when comparing self-hosting to APIs?",
          options: [
            "Electricity",
            "Engineering time for serving, monitoring, batching, upgrades, and on-call",
            "Model download bandwidth",
            "Storage",
          ],
          answer: 1,
          why: "Comparisons usually pit GPU rental against per-token pricing and stop there. The operational engineering — a serving stack, monitoring, capacity planning, model upgrades, and someone on call — is typically the dominant cost and is what makes self-hosting uneconomical at moderate volume.",
        },
      ],
      cards: [
        {
          f: "When does self-hosting make sense?",
          b: "Hard data-residency requirements, very high steady volume on a narrow task, sub-50ms latency needs, offline/air-gapped operation, or strict model-version control. Not for variable volume or frontier capability.",
        },
        {
          f: "Quantisation quality trade-offs?",
          b: "INT8 ≈ indistinguishable. INT4 (Q4_K_M) = small measurable degradation, usually acceptable. INT3 and below = noticeable, especially on reasoning. Rule: more params at 4-bit beats fewer at 16-bit.",
        },
        {
          f: "What is continuous batching worth?",
          b: "5–20× throughput over naive serving. It interleaves requests at token level so new requests join an in-flight batch, keeping the GPU saturated. The reason to use vLLM or SGLang.",
        },
        {
          f: "What's the mature hybrid architecture?",
          b: "Local models for classification, embeddings, and reranking (high volume, narrow tasks, zero marginal cost); hosted frontier model for generation only. Three of four calls never leave your infrastructure.",
        },
      ],
      resources: [
        { title: "vLLM", url: "https://docs.vllm.ai/", kind: "docs" },
        { title: "Ollama", url: "https://ollama.com/", kind: "tool" },
        {
          title: "llama.cpp",
          url: "https://github.com/ggml-org/llama.cpp",
          kind: "repo",
        },
      ],
    },

    /* ------------------------------------------------------ */
    {
      id: "staying-current",
      phase: "frontier",
      title: "Staying Current & Building a Career",
      subtitle:
        "The field reorganises itself every six months. Here's a system for keeping up without drowning, and what actually gets people hired.",
      minutes: 18,
      difficulty: "beginner",
      tags: ["career", "learning"],
      objectives: [
        "Build a sustainable information diet with a signal filter",
        "Separate durable fundamentals from churn",
        "Assemble a portfolio and interview narrative that hold up",
      ],
      body: [
        { t: "h", text: "What's durable versus what churns" },
        {
          t: "compare",
          left: {
            title: "Durable — invest here",
            kind: "good",
            items: [
              "Evaluation methodology",
              "Retrieval and ranking fundamentals",
              "Context engineering principles",
              "Cost and latency reasoning",
              "Security and the trifecta model",
              "Ordinary distributed-systems skill",
            ],
          },
          right: {
            title: "Churns — learn on demand",
            kind: "bad",
            items: [
              "Specific model names and rankings",
              "Framework APIs and their breaking changes",
              "Exact pricing figures",
              "Benchmark leaderboard positions",
              "This month's prompt-technique acronym",
              "Which vector database is fashionable",
            ],
          },
        },
        {
          t: "note",
          kind: "insight",
          title: "The ratio that matters",
          text: "Someone who deeply understands evals, retrieval, and cost reasoning can pick up any framework in a day. Someone who knows one framework's API deeply and nothing about measurement cannot debug their own system. Spend your time on the left column; the right column is documentation you read when you need it.",
        },

        { t: "h", text: "An information diet that's sustainable" },
        {
          t: "steps",
          items: [
            {
              title: "Primary sources over commentary",
              text: "Provider engineering blogs and documentation, and the actual papers. Most secondary coverage is a lossy restatement with added hype.",
            },
            {
              title: "A small number of high-signal individuals",
              text: "Practitioners who publish specifics with numbers, not takes. Five good ones beat a hundred accounts posting screenshots.",
            },
            {
              title: "One weekly hour, scheduled",
              text: "Not continuous scrolling. A fixed slot to read what accumulated, with permission to skip most of it.",
            },
            {
              title: "Build to learn",
              text: "You'll retain more from one afternoon implementing a reranker than from twenty articles about reranking. Reading feels like learning and mostly isn't.",
            },
            {
              title: "Deliberately let things pass",
              text: "Most announcements won't matter to your work. The ones that do will come up repeatedly, from multiple independent sources, over months. That repetition is your filter.",
            },
          ],
        },
        {
          t: "note",
          kind: "pro",
          title: "The six-month test",
          text: "When something new appears, ask: will this still matter in six months? Most 'breakthrough' techniques won't. The ones that do — retrieval-augmented generation, tool calling, evals as practice, MCP — get discussed continuously and from many angles. Waiting costs you almost nothing and saves enormous time.",
        },

        { t: "h", text: "The portfolio that gets interviews" },
        {
          t: "table",
          head: ["Signal", "Strength"],
          rows: [
            [
              "**A deployed system with real users**, plus a public write-up of what broke",
              "**Strongest.** Very few candidates have this.",
            ],
            [
              "**An eval harness with CI gates**, with the numbers published",
              "**Very strong.** Immediately marks you as senior in thinking.",
            ],
            [
              "A RAG system with measured recall and faithfulness metrics",
              "Strong — shows you measure rather than assert",
            ],
            [
              "A bounded agent with tracing and budgets",
              "Strong — shows production judgement",
            ],
            [
              "A tutorial-following project with no evaluation",
              "Weak. Everyone has these.",
            ],
            ["A list of frameworks in your CV", "Near-zero signal"],
            ["Course certificates", "Near-zero signal"],
          ],
        },
        {
          t: "note",
          kind: "money",
          title: "The write-up matters as much as the code",
          text: "'I built a RAG system' is a claim. 'I built a RAG system, measured recall@5 at 41%, diagnosed it as a ranking problem, added a cross-encoder reranker, got to 78%, and here are the numbers and the traces' is evidence of engineering. Publish the second version. It's also excellent interview preparation, because you'll have already articulated your reasoning.",
        },

        { t: "h", text: "What interviews actually probe" },
        {
          t: "list",
          ordered: true,
          items: [
            "**'How do you know it works?'** The single most discriminating question in the field. Have a specific, numeric answer about your eval methodology.",
            "**'Walk me through debugging a bad answer.'** They want the four-stage RAG diagnostic: ingestion, retrieval, ranking, generation — in order, with the measurement at each step.",
            "**'How would you reduce cost by half?'** Caching, routing, output bounds, better ranking. Show you think in unit economics.",
            "**'What are the security risks?'** Prompt injection and the lethal trifecta. Say clearly that it isn't solvable at the prompt layer.",
            "**'When would you not use an LLM?'** Tests judgement. Regex, SQL, a lookup table, a classifier.",
            "**'Tell me about something that failed.'** Have a real one with a real root cause and a real fix. This is where seniority shows.",
          ],
        },

        { t: "h", text: "Where to go next" },
        {
          t: "table",
          head: ["Direction", "What it looks like"],
          rows: [
            [
              "**Applied AI engineer**",
              "The default and largest market. Product features on top of models.",
            ],
            [
              "**AI infrastructure**",
              "Serving, inference optimisation, orchestration platforms. Deeper systems work.",
            ],
            [
              "**AI evaluation / quality**",
              "An emerging specialism. Scarce and increasingly valued.",
            ],
            [
              "**Agent engineering**",
              "Long-horizon autonomous systems. The current frontier, and the least settled.",
            ],
            [
              "**Domain specialist**",
              "AI in law, medicine, finance. Domain knowledge plus AI engineering is a strong combination.",
            ],
            [
              "**AI security**",
              "Injection, red-teaming, safe architecture. Very scarce, growing quickly.",
            ],
          ],
        },
        {
          t: "note",
          kind: "insight",
          title: "The most valuable thing you can be",
          text: "An engineer who ships reliably and can prove it. The field is full of people who can build a demo and short of people who can tell you whether their system got better last week. Everything in this roadmap points at that: measure, then improve, then measure again. That's the whole discipline.",
        },

        {
          t: "check",
          key: "sc-1",
          q: "In an applied AI interview, which answer to 'how do you know your RAG system works?' is strongest?",
          options: [
            "We tested it thoroughly and users are happy",
            "60-case eval set from production traffic, recall@5 and faithfulness tracked, LLM judge calibrated to kappa 0.71 against human labels, gated in CI with confidence intervals",
            "We use the latest model and a top-rated vector database",
            "We follow best practices from the provider documentation",
          ],
          answer: 1,
          why: "It's specific, numeric, and demonstrates the full measurement stack — real traffic as the data source, stage-isolating metrics, a calibrated judge with a reported agreement statistic, and regression protection that accounts for statistical noise. The others are unfalsifiable claims or tool choices, and every candidate offers those.",
        },
      ],
      takeaways: [
        "Invest in durable skills — evals, retrieval, context engineering, cost, security. Learn frameworks on demand.",
        "One scheduled hour a week of primary sources beats continuous scrolling.",
        "Apply the six-month test: genuinely important developments recur from many sources over months.",
        "The strongest portfolio signal is a deployed system with real users and a public write-up of what broke.",
        "'How do you know it works?' is the most discriminating interview question. Have a numeric answer.",
      ],
      quiz: [
        {
          q: "Which skill is most durable?",
          options: [
            "Knowing the current best model",
            "Evaluation methodology",
            "A specific framework's API",
            "Current pricing tables",
          ],
          answer: 1,
          why: "Models, frameworks, and prices all turn over within months. The methodology for measuring whether a probabilistic system works — building datasets, choosing metrics, calibrating judges, gating regressions — has been stable and will outlast every current model.",
        },
        {
          q: "What's the strongest portfolio signal?",
          options: [
            "Many tutorial projects",
            "A deployed system with real users plus a public write-up of what broke and how you fixed it",
            "Course certificates",
            "A long list of frameworks",
          ],
          answer: 1,
          why: "Real users generate failures you didn't anticipate, and a write-up of diagnosing and fixing them demonstrates engineering judgement no tutorial can. Very few candidates have this, which is precisely why it's the strongest signal.",
        },
        {
          q: "What's the six-month test for new developments?",
          options: [
            "Wait six months before using anything",
            "Ask whether it will still matter in six months — genuinely important developments recur from many independent sources over months",
            "Test each new technique for six months",
            "Review your stack every six months",
          ],
          answer: 1,
          why: "It's a filter, not a delay policy. Most announcements don't survive contact with production. The ones that matter get discussed repeatedly and from multiple angles, so recurrence over months is a reliable signal — and waiting for it costs you almost nothing.",
        },
      ],
      cards: [
        {
          f: "Which AI engineering skills are durable vs churning?",
          b: "Durable: evaluation methodology, retrieval/ranking fundamentals, context engineering, cost reasoning, security models, distributed systems. Churning: model names, framework APIs, pricing, leaderboards, prompt-technique acronyms.",
        },
        {
          f: "What's the six-month test?",
          b: "Ask whether a new development will still matter in six months. Genuinely important ones recur from many independent sources over months — that repetition is your filter, and waiting costs almost nothing.",
        },
        {
          f: "Rank portfolio signals from strongest to weakest.",
          b: "Strongest: deployed system with real users + public write-up of failures. Then: eval harness with CI gates and published numbers. Then: RAG with measured metrics; bounded agent with tracing. Weak: tutorial projects, framework lists, certificates.",
        },
        {
          f: "What's the most discriminating interview question, and how do you answer it?",
          b: "'How do you know it works?' Answer with specifics: eval set size and source, stage-isolating metrics, judge calibration (kappa vs human labels), and CI gating with confidence intervals.",
        },
      ],
      resources: [
        {
          title: "Anthropic engineering blog",
          url: "https://www.anthropic.com/engineering",
          kind: "guide",
        },
        {
          title: "Simon Willison's blog",
          url: "https://simonwillison.net/",
          kind: "article",
        },
        {
          title: "Hamel Husain's blog",
          url: "https://hamel.dev/",
          kind: "article",
        },
      ],
    },
  );
})(window);
