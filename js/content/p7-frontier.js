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
          t: "p",
          text: "Fine-tuning is the most over-requested and least often correct answer in applied AI, usually because it sounds like the serious option. That one rule resolves most cases before you need any of the detail below.",
        },
        {
          t: "p",
          text: "When it is the right call, it is right for a narrow set of reasons — and being precise about them is what stops you spending a month on the wrong thing.",
        },
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
          t: "p",
          text: "Assume it does deliver something you need. The next question is which method, and the practical range is narrower than the literature suggests.",
        },
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
          t: "p",
          text: "Distillation is the case worth understanding properly, because it inverts the usual risk. You aren't hoping a small model can learn the task — you already have a frontier model's validated outputs proving the task is learnable, and you're buying a cheaper way to serve it.",
        },
        {
          t: "p",
          text: "Which leaves the question that decides it. Fine-tuning is a fixed cost that buys a lower marginal cost, so it is an arithmetic problem with a break-even point.",
        },
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
          t: "p",
          text: "If the arithmetic works, a handful of practices separate a fine-tune that helps from one you quietly abandon.",
        },
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
        {
          t: "p",
          text: "Multimodal capability arrived quietly and changed one thing decisively: document parsing, which was a long-standing engineering problem, is now largely a model call. The rest of this chapter is about the two places multimodal surprises people — what it costs, and how it breaks your security assumptions.",
        },
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
          t: "p",
          text: "That parsing result is worth acting on. If you built a PDF pipeline out of layout heuristics, a vision model probably beats it on tables and scanned pages for less engineering than you already spent.",
        },
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
          t: "p",
          text: "Two things about audio are worth knowing before you design around it. Real-time speech-to-speech models removed the latency that made voice interfaces feel broken, and transcription is now cheap enough that recording-and-transcribing is a reasonable default rather than a considered decision.",
        },
        {
          t: "p",
          text: "The cost story generalises to audio, with one difference: audio is billed by duration rather than resolution, which makes it easier to predict and harder to reduce.",
        },
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
          text: "Retrieval over images raises a question text retrieval never posed: what exactly are you indexing? An image has no tokens to embed, so you must choose a representation before you can search at all.",
        },
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
          t: "p",
          text: "Everything else in this chapter is about capability. This last section is about what happens when the capability is used against you, and it is the reason multimodal features deserve a security review rather than a feature flag.",
        },
        {
          t: "p",
          text: "Finally, the part that matters most and gets least attention. Adding an image input adds an untrusted channel that your text-based defences do not inspect.",
        },
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
      minutes: 15,
      difficulty: "advanced",
      tags: ["local", "open-weights", "quantisation"],
      objectives: [
        "Decide between hosted APIs and self-hosted inference",
        "Understand quantisation and its quality trade-off",
        "Estimate the true cost of self-hosting",
      ],
      body: [
        {
          t: "p",
          text: "Self-hosting is the option people reach for on principle and regret on the invoice. It is genuinely correct for a handful of situations, and the honest version of this chapter spends as much time on when not to as on how.",
        },
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
          text: "Suppose one of those reasons applies to you. Everything that follows is about fitting a useful model onto hardware you can afford, and quantisation is the technique that makes it possible.",
        },
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
          t: "p",
          text: "That rule is the single most useful thing in the chapter: given fixed VRAM, a bigger model quantised harder generally beats a smaller model at full precision. Quality tracks parameter count more strongly than it tracks precision.",
        },
        {
          t: "p",
          text: "With the model sized, throughput is a serving-stack decision rather than a model one.",
        },
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
          t: "p",
          text: "Set aside self-hosting for its own sake. Small models have a role in almost every system, including ones that otherwise call a frontier API for everything.",
        },
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
      id: "interview-prep",
      phase: "frontier",
      title: "Interviewing for AI Engineering Roles",
      subtitle:
        "What these loops actually test, in what proportion, and the round that filters most candidates. Read this before you start applying, not after your first rejection.",
      minutes: 22,
      difficulty: "intermediate",
      tags: ["career", "interview"],
      objectives: [
        "Know the rough composition of a 2026 AI engineering loop",
        "Answer the six questions that carry the most weight",
        "Prepare numbers from your own work instead of opinions about models",
      ],
      body: [
        {
          t: "p",
          text: "These loops have converged on a recognisable shape. Reported composition across 2026 hiring processes clusters around **40% retrieval, evaluation and agents; 30% production systems; 20% model internals; 10% behavioural**. Notice what that leaves out: almost no classical machine learning, and almost no leetcode-style algorithms. The job is wiring models into products, and the interview reflects it.",
        },
        {
          t: "note",
          kind: "insight",
          title: "The round that filters most people",
          text: "It is the evaluation round, and specifically the agentic-eval version of it. Candidates arrive able to describe RAG and able to write clean code, then cannot answer how they would evaluate an agent that calls four tools in a loop. Eval literacy is reported as the single strongest signal distinguishing people who have actually built with LLMs from people who have watched videos about it. If you prepare one thing, prepare this.",
        },

        { t: "h", text: "The six questions that carry the weight" },
        {
          t: "p",
          text: "Given that, prepare in proportion. The questions below recur across almost every loop, and the honest way to use this list is to answer each one out loud, from a project you actually built, before you need to.",
        },
        {
          t: "steps",
          items: [
            {
              title: '"How do you know it works?"',
              text: "The highest-signal question in the field. A strong answer names a set size and its provenance (production traffic, not imagination), the metrics and which stage each isolates, how the judge was calibrated against human labels, and how it gates CI with confidence intervals. A weak answer is 'we tested it and users seem happy'.",
            },
            {
              title: '"Walk me through debugging a bad answer."',
              text: "They want a localisation procedure, in order: is it indexed at all → recall@50 → recall@5 → generation with the correct chunk forced in. Naming that sequence tells them you have debugged a real system. Jumping straight to 'I'd improve the prompt' tells them you haven't.",
            },
            {
              title: '"How would you chunk a 200-page PDF?"',
              text: "A concrete favourite. Answer with structure first — parse to Markdown preserving heading hierarchy, split on sections, parent-child so retrieval is precise and generation gets context, contextual enrichment for orphaned chunks, tables kept intact with repeated headers. Then say how you'd *measure* whether it worked, which is the part most candidates omit.",
            },
            {
              title: '"When would you add a reranker?"',
              text: "When recall@50 is high and recall@5 is low. That single sentence demonstrates you think in measurements rather than techniques. Follow with the cost: ~50 candidates is the usual knee point, gains flatten after, and an absolute score floor is what enables abstention.",
            },
            {
              title:
                '"How do you evaluate an agent that calls four tools in a loop?"',
              text: "Golden trajectories with required and forbidden calls, step-level scoring rolled up to the trajectory, deterministic route checks in code, a judge only for final-answer quality, cost and step budgets as pass/fail, and deliberate fault injection to measure recovery. This is the answer that separates the field.",
            },
            {
              title:
                '"Keep p95 under 800ms with a frontier model in the path."',
              text: "A constraint problem, not a trivia question. Talk through: measure the pipeline first because the model often isn't the bottleneck, prompt caching for TTFT, parallelise independent I/O, rerank fewer candidates, route easy traffic to a small model, stream so TTFT is what users feel — and be willing to say that if the budget still can't be met, the budget is the thing to renegotiate.",
            },
          ],
        },

        { t: "h", text: "The system design round" },
        {
          t: "p",
          text: "Six questions, and none of them is a trivia question. Each is asking you to defend a decision with evidence, which is why they are hard to prepare for by reading and easy to prepare for by having built something.",
        },
        {
          t: "p",
          text: "Individual questions test whether you know things. The design round tests whether you can make decisions under constraints, which is a different skill and the one that determines your level.",
        },
        {
          t: "p",
          text: 'Expect a prompt like "design a support assistant over our documentation for 50,000 users." The grading rubric is fairly consistent, and it rewards the same instincts as any backend design round plus the AI-specific concerns.',
        },
        {
          t: "table",
          head: ["They're listening for", "What earns credit"],
          rows: [
            [
              "Requirements first",
              "Latency budget, accuracy bar, cost ceiling per user, data residency, whether abstention is acceptable — before any architecture",
            ],
            [
              "Ingestion as a first-class pipeline",
              "Change detection, structural chunking, enrichment, versioned index, eval before promoting",
            ],
            [
              "Hybrid retrieval",
              "BM25 + dense with RRF, then reranking. Dense-only is a red flag",
            ],
            [
              "Grounding and abstention",
              "Citations verified against supplied IDs, a real 'not in the corpus' path",
            ],
            [
              "Evaluation",
              "Named metrics, a labelled set, CI gates. Unprompted mention scores well",
            ],
            [
              "Cost model",
              "Arithmetic on a napkin: tokens per request, cost per user per month, versus revenue",
            ],
            [
              "Security",
              "Prompt injection, the lethal trifecta, tool authorisation scoped to the session",
            ],
            [
              "Operations",
              "Tracing with chunk IDs and scores, versioned prompts, canary on quality metrics",
            ],
          ],
        },
        {
          t: "note",
          kind: "pro",
          title: "Bring numbers, not preferences",
          text: 'The difference between a mid and senior signal is arithmetic. "I\'d use hybrid search" is a preference. "Recall@5 was 41%, I added a cross-encoder over the top 50, it went to 78% for 95ms of added p95, and cost per request went from $0.021 to $0.023" is evidence. Memorise two or three such numbers from your own projects. Interviewers remember the candidate who quoted a measurement.',
        },

        { t: "h", text: "What gets people rejected" },
        {
          t: "p",
          text: 'Note what that table is asking for throughout: a number and a reason, not a preference. "We chose 400-token chunks because the docs\' sections average 350 and recall@5 dropped 9 points at 800" is a senior answer. "We used 500 with 50 overlap" is a recital.',
        },
        {
          t: "p",
          text: "It is worth being just as clear about the failure modes, because most rejections at this level are not knowledge gaps.",
        },
        {
          t: "compare",
          left: {
            title: "Strong signals",
            kind: "good",
            items: [
              "Talks about failure modes unprompted",
              "Distinguishes faithfulness from correctness",
              "Says 'I'd measure that' and names the metric",
              "Volunteers cost per request",
              "Admits what they don't know cleanly",
              "Prefers a workflow over an agent, and justifies it",
            ],
          },
          right: {
            title: "Rejection signals",
            kind: "bad",
            items: [
              "Names frameworks instead of describing methods",
              "Ranks models by leaderboard position",
              "'We'd add evals once it's stable'",
              "Never mentions cost or latency",
              "Claims prompt injection is solved by sanitising input",
              "Describes an agent where a chain would do",
            ],
          },
        },
        {
          t: "note",
          kind: "pitfall",
          title: "The framework-name trap",
          text: "Answering \"how would you build RAG?\" with a list of libraries is the most common way strong engineers underperform in these loops. The tools change every few months and the interviewer knows it; what they're testing is whether you understand chunking trade-offs, why hybrid beats dense, and how you'd know it worked. Describe the method, then mention the tool you'd reach for.",
        },

        { t: "h", text: "Your portfolio, and how it's actually read" },
        {
          t: "p",
          text: "Interviews are downstream of getting the interview, and for this field a repository does more work than a CV.",
        },
        {
          t: "p",
          text: "Recruiters spend seconds on a CV and engage substantially more with a repository containing runnable code or a live demo. That asymmetry is worth optimising for.",
        },
        {
          t: "table",
          head: ["Artefact", "Signal strength"],
          rows: [
            [
              "Deployed system with real users **plus a write-up of what broke**",
              "Strongest. Very few candidates have this.",
            ],
            [
              "Eval harness with CI gates and published numbers",
              "Very strong — reads as senior immediately",
            ],
            [
              "RAG system with measured recall and faithfulness",
              "Strong: shows you measure rather than assert",
            ],
            [
              "Bounded agent with tracing, budgets, and trajectory evals",
              "Strong, and directly relevant to the filtering round",
            ],
            [
              "Tutorial-following project with no evaluation",
              "Weak. Everyone has these.",
            ],
            ["A list of frameworks on your CV", "Near-zero"],
          ],
        },
        {
          t: "note",
          kind: "money",
          title: "Frame projects around outcomes, not tool lists",
          text: 'A README that opens with "Built with LangChain, Pinecone, and FastAPI" is a shopping list. One that opens with "Answers questions over 4,000 pages of internal policy at 78% recall@5 and $0.002 per query; here\'s the eval harness and here\'s what I got wrong first" is an interview in advance. Lead with the measurement and the failure.',
        },

        { t: "h", text: "Practical preparation" },
        {
          t: "p",
          text: "The pattern across both columns is that strong candidates talk about evidence and weak ones talk about tools. A named framework is not an architecture, and an interviewer asking how you'd build RAG is asking about the decisions, not the dependency list.",
        },
        {
          t: "p",
          text: "Which reduces to a short list of things to do in the weeks before you start applying.",
        },
        {
          t: "list",
          ordered: true,
          items: [
            "**Write the eval harness for one of your projects.** Not a plan for one — an actual harness, with numbers you can quote. This is the single highest-return preparation task.",
            "**Rehearse the RAG debugging procedure out loud.** Four stages, in order, with the metric at each. It should be fluent, not reconstructed.",
            '**Prepare one honest failure story** with a real root cause and a real fix. "We shipped a prompt change that dropped faithfulness 9 points and we found out from a user" followed by what you changed structurally is a senior answer.',
            "**Do the arithmetic on your own project** so cost per request and p95 latency are numbers you know, not numbers you'd have to look up.",
            "**Have a position on agents versus workflows** and be able to defend it. Interviewers increasingly probe whether you reach for autonomy reflexively.",
            "**Read your own traces before the interview.** If you can describe a specific surprising thing your traces revealed, you have credibility that no amount of theory buys.",
          ],
        },
        {
          t: "note",
          kind: "insight",
          title: "The compounding advantage",
          text: "Everything on that list is also just good engineering practice. The preparation that makes you interview well is the same work that makes your systems work — which is unusual, and worth exploiting. Nothing here is interview theatre.",
        },

        {
          t: "check",
          key: "ip-1",
          q: "An interviewer asks how you'd evaluate a support agent that looks up a customer, queries invoices, searches docs, and drafts a reply. What's the strongest opening?",
          options: [
            '"I\'d check whether the final reply is correct on a set of test cases."',
            '"I\'d author 50–100 golden trajectories with required and forbidden calls plus step and cost budgets, score each step deterministically from the trace, and use a judge only for final-answer quality."',
            '"I\'d use an LLM to judge the whole trajectory against a rubric."',
            '"I\'d rely on production monitoring and user feedback."',
          ],
          answer: 1,
          why: "It demonstrates the specific vocabulary and method of agent evaluation — goldens, route versus outcome, deterministic checks over the trace, cost as a pass/fail criterion, and judges confined to where they're actually needed. The first option is outcome-only grading, which misses lucky routes, unsafe routes, and 8× cost differences. The third reaches for a judge where code is more reliable. The fourth defers the problem to production.",
        },
      ],
      takeaways: [
        "The loop is roughly 40% retrieval/evals/agents, 30% production, 20% internals, 10% behavioural.",
        "The evaluation round — especially agent evaluation — is what filters most candidates.",
        "Answer with methods and measurements, never with framework names or leaderboard positions.",
        "Memorise two or three real numbers from your own projects; arithmetic is the senior signal.",
        "The strongest portfolio artefact is a deployed system plus a public write-up of what broke.",
      ],
      quiz: [
        {
          q: "Roughly how is a 2026 AI engineering loop weighted?",
          options: [
            "50% classical ML, 50% coding",
            "~40% RAG/evals/agents, 30% production systems, 20% LLM internals, 10% behavioural",
            "Mostly algorithms and data structures",
            "Mostly model architecture and training",
          ],
          answer: 1,
          why: "The role is wiring models into products, and the loop reflects that: applied retrieval, evaluation, and agent design dominate, with production engineering close behind. Classical ML and algorithm puzzles barely feature.",
        },
        {
          q: '"When would you add a reranker?" — what makes an answer strong?',
          options: [
            '"Always, they improve quality"',
            '"When recall@50 is high but recall@5 is low" — a measurement-driven trigger',
            '"When the corpus exceeds a million documents"',
            '"When using dense retrieval"',
          ],
          answer: 1,
          why: "It shows you diagnose before prescribing. High recall@50 with low recall@5 means the right chunk is found but ranked too low to reach the model — precisely the precision problem a cross-encoder solves. Adding one reflexively is the same instinct the interviewer is testing for.",
        },
        {
          q: "Which portfolio artefact carries the strongest hiring signal?",
          options: [
            "Five tutorial projects across different frameworks",
            "A deployed system with real users plus a write-up of what broke and how you fixed it",
            "A certificate from a well-known course",
            "A CV listing every AI tool you've touched",
          ],
          answer: 1,
          why: "Real users produce failures you didn't anticipate, and a write-up of diagnosing and fixing them demonstrates judgement that no tutorial can. It's also rare, which is exactly why it's the strongest signal.",
        },
        {
          q: 'Why is answering "how would you build RAG?" with a list of libraries a weak response?',
          options: [
            "Interviewers don't know those libraries",
            "Tooling churns and the question is testing whether you understand chunking trade-offs, hybrid retrieval, and how you'd measure success",
            "Libraries are considered unprofessional",
            "It takes too long to explain",
          ],
          answer: 1,
          why: "The stack changes every few months and the interviewer knows it. What they're probing is method: why you'd chunk one way over another, why hybrid beats dense, how you'd detect that retrieval was the bottleneck. Describe the method, then name the tool as an implementation detail.",
        },
      ],
      cards: [
        {
          f: "How is a 2026 AI engineering interview loop weighted?",
          b: "~40% RAG/evals/agents, 30% production systems, 20% LLM internals, 10% behavioural. Almost no classical ML or algorithm puzzles.",
        },
        {
          f: "Which interview round filters the most candidates?",
          b: "Evaluation — especially agent evaluation. Candidates can describe RAG and write clean code but can't say how they'd evaluate an agent calling four tools in a loop.",
        },
        {
          f: "Strong answer to 'when would you add a reranker?'",
          b: "'When recall@50 is high but recall@5 is low.' A measurement-driven trigger, followed by the cost: ~50 candidates is the knee point, and an absolute score floor enables abstention.",
        },
        {
          f: "What's the four-stage RAG debugging answer interviewers want?",
          b: "Is it indexed at all → recall@50 (retrieval) → recall@5 (ranking) → generation with the correct chunk forced in. In that order, with the metric named at each stage.",
        },
        {
          f: "How should a portfolio README open?",
          b: "With the measurement and the failure — 'answers over 4,000 pages at 78% recall@5, $0.002/query, here's the eval harness and what I got wrong first' — not with a list of frameworks.",
        },
      ],
      resources: [
        {
          title: "Hamel Husain — Your AI product needs evals",
          url: "https://hamel.dev/blog/posts/evals/",
          kind: "article",
        },
        {
          title: "Confident AI — LLM agent evaluation guide",
          url: "https://www.confident-ai.com/blog/llm-agent-evaluation-complete-guide",
          kind: "article",
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
        {
          t: "p",
          text: "You have reached the end of a roadmap that took months, in a field that will look different in a year. That is less alarming than it sounds, because the rate of change is very uneven — and this last chapter is about telling the fast-moving surface from the slow-moving substance.",
        },
        { t: "h", text: "What's durable versus what churns" },
        {
          t: "p",
          text: "Sort everything you encounter into one of two piles before deciding whether to study it.",
        },
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
          t: "p",
          text: "That ratio is the practical conclusion of the whole roadmap: depth in a few durable things beats breadth across the churn. The problem is that the churn is louder, which makes a deliberate information diet a real defence rather than a productivity tip.",
        },
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
          t: "p",
          text: "Reading is not the output. What you build is, and a small number of project shapes carry disproportionate signal.",
        },
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
          t: "p",
          text: "Read that table as a set of claims you want to be able to make truthfully. Each project shape exists because it produces a specific piece of evidence about how you work — an eval harness proves you measure, a cost write-up proves you understand the business, a deployed system proves you finish.",
        },
        {
          t: "p",
          text: "The previous chapter covered interviews in detail. The short version is worth repeating here, because it is also a checklist for whether your projects are the right ones.",
        },
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
          t: "p",
          text: "Finally, the specialisations that open up once the fundamentals are in place. None of these are prerequisites for a job in this field — they are directions, to be picked when a problem makes one of them interesting.",
        },
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
    }
  );
})(window);
