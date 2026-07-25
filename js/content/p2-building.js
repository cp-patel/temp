/* ============================================================
   Phase 03 — Building Real Applications
   ============================================================ */
(function (global) {
  "use strict";
  var C = global.Curriculum;

  C.chapters.push(
    /* ------------------------------------------------------ */
    {
      id: "api-surface",
      phase: "building",
      title: "The LLM API Surface",
      subtitle:
        "Every provider exposes roughly the same seven concepts under different names. Learn the shape once and switching providers becomes an afternoon's work.",
      minutes: 18,
      difficulty: "beginner",
      tags: ["api", "sdk"],
      objectives: [
        "Map the common API surface across providers",
        "Handle the full error taxonomy, not just the happy path",
        "Build a thin provider adapter worth having",
      ],
      body: [
        {
          t: "p",
          text: "The first three phases of this roadmap were about what the model does. From here on it's about what *you* do, and that starts with the interface. Almost every production incident in an AI feature traces back to something in this chapter: an unchecked field, a retried request that could never succeed, a cost that grew quadratically because nobody noticed what each call actually sends.",
        },
        {
          t: "p",
          text: "Provider SDKs differ in naming and in the interesting details, but the core is stable: a **messages array** with roles, **sampling parameters**, **tool definitions**, a **stop condition**, a **response format**, and a **usage** block. Learn that shape and the rest is documentation lookup. We'll go request first, then response, then the errors — and the parts that cause outages get the most space.",
        },

        { t: "h", text: "The messages array" },
        {
          t: "p",
          text: "Start with what you send. A request is a list of turns, each tagged with who said it, and the model reads the whole list every time. Read the comments in this example more carefully than the code — each one marks a place where a reasonable assumption is wrong.",
        },
        {
          t: "code",
          lang: "python",
          caption: "The universal structure",
          code: `messages = [
    # System: developer instructions. Highest priority.
    # Some providers take this as a separate top-level parameter
    # rather than a message — a real portability wrinkle.
    {"role": "system", "content": "You are a billing support agent..."},

    {"role": "user", "content": "Why was I charged twice?"},

    # Assistant turns you replay back are how the model "remembers".
    # The API is stateless: you resend the whole history every call.
    {"role": "assistant", "content": "Let me check that for you."},

    # Tool results come back as their own role/blocks.
    {"role": "tool", "tool_call_id": "call_abc", "content": '{"charges": 2}'},
]`,
        },
        {
          t: "note",
          kind: "insight",
          title: "The API is stateless — this surprises people",
          text: "There is no server-side conversation. Every call resends the entire history, and you pay for all of it every time. A 20-turn conversation costs roughly 20× the input tokens of the first turn even if each user message is short. This single fact drives everything in the context-management and caching chapters.",
        },
        {
          t: "p",
          text: "Sit with that one, because it is the difference between a chat feature that costs what you modelled and one that doesn't. Cost per conversation grows with the *square* of its length, not linearly: turn 20 pays for turns 1 through 19 all over again. Every technique in **Conversation State** and **Caching, Retries & Idempotency** exists to blunt that curve.",
        },

        { t: "h", text: "Parameters that matter" },
        {
          t: "p",
          text: "Eight parameters, and you can ignore most of them most of the time. Two you must set on every single call — leaving `temperature` and `max_tokens` at the provider default is how you get non-reproducible output and a runaway bill on the same afternoon.",
        },
        {
          t: "table",
          head: ["Parameter", "What it does", "Sensible default"],
          rows: [
            [
              "`temperature`",
              "Reshapes the token distribution",
              "0 for deterministic tasks; never rely on the provider default",
            ],
            [
              "`max_tokens`",
              "Hard cap on output length",
              "Set it deliberately — it's your truncation risk and your cost ceiling",
            ],
            [
              "`stop` sequences",
              "Halt generation at a marker",
              "Useful for delimited output formats",
            ],
            [
              "`tools`",
              "Typed function declarations",
              "Pass via the parameter, not in the prompt text",
            ],
            [
              "`tool_choice`",
              "Force, forbid, or allow tool use",
              "`auto` normally; force it when you need a specific call",
            ],
            [
              "`response_format`",
              "Schema-enforced output",
              "Use whenever you'll parse the result",
            ],
            [
              "`seed`",
              "Best-effort reproducibility",
              "Helps, doesn't guarantee — see the sampling chapter",
            ],
            [
              "`stream`",
              "Incremental token delivery",
              "True for anything user-facing",
            ],
          ],
        },

        { t: "h", text: "Stop reasons: the field nobody checks" },
        {
          t: "p",
          text: "So much for the request. Now the response — and specifically the field almost nobody reads. Every reply carries a stop reason saying *why* the model stopped talking, and only one of its values means \"this worked\". The others look like success to code that only checks for a 200 and pulls out the text.",
        },
        {
          t: "table",
          head: ["Reason", "Meaning", "Your response"],
          rows: [
            ["`stop` / `end_turn`", "Model finished naturally", "Normal path"],
            [
              "`length` / `max_tokens`",
              "Hit your output cap",
              "**An error.** Never return this to a user as a result.",
            ],
            [
              "`tool_use` / `tool_calls`",
              "Model wants a tool run",
              "Execute, append result, call again",
            ],
            [
              "`content_filter`",
              "Blocked by a safety filter",
              "Surface a clear message; log for review",
            ],
            [
              "`refusal`",
              "Model declined",
              "Distinct from a filter — handle separately",
            ],
          ],
        },

        { t: "h", text: "The error taxonomy" },
        {
          t: "p",
          text: "Notice what those two tables have in common and where they differ. A `length` stop reason is a failure *you* caused, with a 200 status and plausible-looking text — which is exactly why it slips through. The errors below are the ones the provider hands you explicitly. Both need handling; only one announces itself.",
        },
        {
          t: "p",
          text: "The only distinction that matters here is whether trying again could possibly help. Get that wrong in the optimistic direction and you have a retry storm; get it wrong in the pessimistic direction and you fail requests that would have worked on the second attempt.",
        },
        {
          t: "code",
          lang: "python",
          caption: "Retryable vs terminal — the distinction that matters",
          code: `RETRYABLE = {
    429: "rate_limited",       # back off, respect Retry-After
    500: "server_error",
    502: "bad_gateway",
    503: "overloaded",         # very common at peak; expect it
    504: "gateway_timeout",
}

TERMINAL = {
    400: "bad_request",        # your payload is wrong — retrying won't help
    401: "unauthenticated",    # bad key
    403: "forbidden",          # no access to that model
    404: "not_found",          # wrong model name
    413: "payload_too_large",  # prompt exceeds the window
    422: "unprocessable",      # schema or parameter conflict
}

# The one everyone gets wrong: 400 with "context_length_exceeded".
# It is terminal for THIS payload but recoverable for the REQUEST —
# shrink the context and try again. Retrying unchanged burns quota
# and never succeeds.`,
        },
        {
          t: "note",
          kind: "pitfall",
          title: "Blind retry-on-any-exception is a cost incident",
          text: "A retry wrapper that catches every exception will hammer the provider with a malformed 400 request until your quota is gone, and can turn one bad deploy into a very expensive afternoon. Classify errors first: retry the 5xx and 429 family, fail fast on 4xx, and handle context-length overflow by shrinking rather than repeating.",
        },

        { t: "h", text: "A thin adapter worth having" },
        {
          t: "p",
          text: "Everything above is per-provider trivia, and you don't want it scattered through your business logic. The standard answer is an abstraction layer, and the standard mistake is making it too thick — a wrapper that normalises away the differences also normalises away the features you switched providers for.",
        },
        {
          t: "p",
          text: "So aim narrow. Normalise the three things you genuinely need uniform — message shape, error classification, token accounting — and pass everything else through untouched. Watch what this adapter *doesn't* do: it has no opinion about prompts, no retry policy baked in, and no attempt to model every provider's extras.",
        },
        {
          t: "code",
          lang: "python",
          caption: "Normalise the boring parts; expose the good parts",
          code: `from dataclasses import dataclass, field

@dataclass
class Usage:
    input_tokens: int = 0
    output_tokens: int = 0
    cached_input_tokens: int = 0

    @property
    def cost_usd(self) -> float:
        return (
            (self.input_tokens - self.cached_input_tokens) * IN_RATE
            + self.cached_input_tokens * CACHED_RATE
            + self.output_tokens * OUT_RATE
        ) / 1_000_000

@dataclass
class Completion:
    text: str
    usage: Usage
    stop_reason: str
    tool_calls: list = field(default_factory=list)
    raw: dict = field(default_factory=dict)   # keep the escape hatch

class LLM:
    """One interface, provider-specific implementations underneath.
    Normalises messages, errors, and usage accounting. Deliberately
    does NOT hide caching, schema modes, or thinking controls."""

    def complete(self, messages, *, model, temperature=0.0,
                 max_tokens=1024, tools=None, schema=None,
                 cache_prefix=False) -> Completion: ...

    def stream(self, messages, **kw): ...   # yields text deltas`,
        },
        {
          t: "note",
          kind: "pro",
          title: "Always keep the raw response",
          text: "Store the untouched provider payload alongside your normalised object. The first time you need a field your adapter didn't model — a cache-hit count, a safety annotation, a reasoning-token tally — you'll have it without a code change or a re-run. It costs a database column.",
        },

        {
          t: "check",
          key: "api-1",
          q: "A 20-turn conversation with short messages costs far more than you expected. Why?",
          options: [
            "Provider pricing changed",
            "The API is stateless — every call resends the full history, so input tokens grow with every turn",
            "Streaming adds overhead",
            "The system prompt is counted twice",
          ],
          answer: 1,
          why: "There is no server-side conversation state. Turn 20 sends all 19 previous turns plus the system prompt as input. Total input tokens across a conversation grow roughly with the square of the turn count, which is why compaction and prompt caching are cost levers rather than nice-to-haves.",
        },
      ],
      takeaways: [
        "Every provider exposes the same core: messages, sampling params, tools, stop conditions, usage.",
        "The API is stateless. You resend the whole history every call and pay for it every time.",
        "Check `stop_reason` on every response and treat truncation as an error path.",
        "Classify errors before retrying: 5xx/429 retryable, 4xx terminal, context-overflow needs shrinking not repeating.",
        "Build a thin adapter that normalises messages/errors/usage but exposes provider-specific features.",
      ],
      quiz: [
        {
          q: "What should a `finish_reason` of `length` be treated as?",
          options: [
            "A successful completion",
            "An error — the output is truncated and incomplete",
            "A signal to retry identically",
            "A rate limit",
          ],
          answer: 1,
          why: "The model was cut off mid-generation. The text may be missing its conclusion, its closing braces, or the last item of a list. Returning it as a result ships silently corrupted output; treat it as an error and either raise the limit or split the task.",
        },
        {
          q: "Which error is terminal for the current payload but recoverable for the request?",
          options: [
            "401 unauthenticated",
            "400 context_length_exceeded",
            "503 overloaded",
            "404 model not found",
          ],
          answer: 1,
          why: "Retrying the identical payload will always fail — the prompt is too long. But the underlying request is satisfiable: drop retrieved chunks, compact history, or lower max_tokens and it succeeds. Your retry logic needs this as a distinct branch, not lumped with generic 400s.",
        },
        {
          q: "Why keep the raw provider response alongside your normalised object?",
          options: [
            "For legal compliance",
            "So fields your adapter didn't model are available later without a code change or re-run",
            "It's required by SDKs",
            "To reduce latency",
          ],
          answer: 1,
          why: "Providers add fields continuously — cache-hit counts, safety annotations, reasoning-token tallies. If you only stored your normalised subset, recovering that data means re-running requests you already paid for. A raw JSON column is the cheapest insurance in the stack.",
        },
      ],
      cards: [
        {
          f: "Why is 'the API is stateless' the most consequential API fact?",
          b: "Every call resends the entire conversation history and you pay for all of it. Input tokens grow with the square of turn count, which makes compaction and prompt caching cost-critical rather than optional.",
        },
        {
          f: "Which HTTP errors are retryable vs terminal?",
          b: "Retryable: 429, 500, 502, 503, 504. Terminal: 400, 401, 403, 404, 413, 422. Special case: 400 context_length_exceeded — shrink the payload and retry, don't repeat it.",
        },
        {
          f: "What does stop_reason = 'length' mean and how do you handle it?",
          b: "Output was truncated at max_tokens. It's an error path, not a result — raise the limit, shrink the task, or split it. Never return it to a user as a completed answer.",
        },
      ],
      resources: [
        {
          title: "Anthropic Messages API",
          url: "https://docs.anthropic.com/en/api/messages",
          kind: "docs",
        },
        {
          title: "OpenAI API reference",
          url: "https://platform.openai.com/docs/api-reference",
          kind: "docs",
        },
      ],
    },

    /* ------------------------------------------------------ */
    {
      id: "streaming",
      phase: "building",
      title: "Streaming & Perceived Latency",
      subtitle:
        "Streaming makes nothing faster and changes everything. Time-to-first-token is the number users feel; total generation time is the number they tolerate.",
      minutes: 20,
      difficulty: "intermediate",
      tags: ["streaming", "latency", "ux"],
      lab: "latency",
      objectives: [
        "Distinguish TTFT from TPOT and optimise each separately",
        "Implement SSE streaming with correct disconnect handling",
        "Find the real latency bottleneck instead of blaming the model",
      ],
      body: [
        { t: "p", text: "Two numbers define the feel of an LLM interface:" },
        {
          t: "list",
          items: [
            "**TTFT (time to first token)** — how long until *something* appears. Below ~500ms feels instant; above ~2s feels broken.",
            "**TPOT (time per output token)** — the streaming rate. Above roughly 25 tokens/second reads faster than most people, so further gains are largely invisible.",
          ],
        },
        { t: "lab", id: "latency" },
        {
          t: "note",
          kind: "insight",
          title: "The asymmetry to exploit",
          text: "A 400ms TTFT with a 6-second total generation feels dramatically better than a 3-second TTFT with a 4-second total — even though the second is faster overall. Optimise TTFT ruthlessly and treat total time as a secondary concern. This is the highest-return latency work available to you.",
        },

        { t: "h", text: "Where the time actually goes" },
        {
          t: "p",
          text: "Before blaming the model, measure the pipeline. In a typical RAG request the model is often not the bottleneck.",
        },
        {
          t: "table",
          head: ["Stage", "Typical", "How to cut it"],
          rows: [
            [
              "Auth, rate-limit, routing",
              "5–30ms",
              "Usually fine; watch for a slow auth lookup",
            ],
            [
              "Query embedding",
              "20–120ms",
              "Cache repeated queries; batch; use a smaller embedding model",
            ],
            [
              "Vector search",
              "10–150ms",
              "Tune index params; filter before searching, not after",
            ],
            [
              "Reranking (cross-encoder)",
              "80–400ms",
              "Rerank fewer candidates; use a smaller reranker; run in parallel with prompt assembly",
            ],
            ["Prompt assembly", "1–10ms", "Rarely matters"],
            [
              "**Model TTFT**",
              "**200ms–3s**",
              "**Prompt caching, smaller model, shorter prompt**",
            ],
            [
              "Token generation",
              "20–80 tok/s",
              "Smaller model; cap max_tokens; stream",
            ],
          ],
        },
        {
          t: "note",
          kind: "pro",
          title: "Prompt caching is also a latency win",
          text: "Caching is usually sold as a cost optimisation, but skipping recomputation of a large stable prefix routinely cuts TTFT by 30–60% on cache hits. If your TTFT is bad and your system prompt is long, this is the first thing to try — before switching models.",
        },

        { t: "h", text: "Server-sent events, done properly" },
        {
          t: "code",
          lang: "python",
          caption: "FastAPI SSE with disconnect handling and usage accounting",
          code: `import json, asyncio
from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse

router = APIRouter()

@router.post("/chat")
async def chat(req: Request, body: ChatRequest):
    async def gen():
        acc: list[str] = []
        usage = None
        try:
            async with llm.stream(body.messages, model=body.model) as stream:
                async for event in stream:
                    # Client closed the tab / navigated away.
                    # Stop generating: you are still being billed.
                    if await req.is_disconnected():
                        break

                    if event.type == "text":
                        acc.append(event.text)
                        yield f"data: {json.dumps({'delta': event.text})}\\n\\n"

                    elif event.type == "usage":
                        usage = event.usage

            yield f"data: {json.dumps({'done': True})}\\n\\n"

        except asyncio.CancelledError:
            raise                              # let the framework unwind

        except Exception as exc:
            log.exception("stream failed", extra={"req_id": body.id})
            # Errors mid-stream cannot use an HTTP status — headers are sent.
            # Emit an error event the client knows how to render.
            yield f"data: {json.dumps({'error': 'generation_failed'})}\\n\\n"

        finally:
            # Persist whatever was produced, even on disconnect —
            # otherwise the user's next turn has no history.
            await save_turn(body.conversation_id, "".join(acc), usage)

    return StreamingResponse(
        gen(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",   # stops nginx buffering the stream
        },
    )`,
        },
        {
          t: "note",
          kind: "pitfall",
          title: "Three things that silently break streaming",
          text: "**Proxy buffering** — nginx and many CDNs buffer responses by default, so the client gets everything at once; `X-Accel-Buffering: no` and disabling proxy buffering fix it. **No disconnect check** — you keep generating and paying after the user leaves. **Losing partial output** — if you only save on clean completion, a disconnect loses the turn and corrupts the next one.",
        },

        {
          t: "h",
          text: "Perceived-latency techniques that don't touch the model",
        },
        {
          t: "steps",
          items: [
            {
              title: "Acknowledge instantly",
              text: "Render the user's own message and a typing indicator the moment they hit send. Zero backend work, large perceived improvement.",
            },
            {
              title: "Stream your pipeline stages",
              text: "Send 'Searching documentation…' then 'Found 4 sources…' then the answer. The wait becomes legible instead of blank.",
            },
            {
              title: "Show retrieved sources first",
              text: "Citations are available before generation starts. Render them immediately — users start reading while the answer streams.",
            },
            {
              title: "Speculative prefetch",
              text: "Start embedding and retrieval on debounced input before the user finishes typing. Wasted work is cheap; latency is not.",
            },
            {
              title: "Smooth the render",
              text: "Buffer deltas to a steady ~30–40 characters/second rather than rendering raw chunk arrivals. Jittery bursts read as slower than a constant flow.",
            },
          ],
        },

        { t: "h", text: "Measure percentiles, never averages" },
        {
          t: "code",
          lang: "python",
          caption: "The metrics you need on day one",
          code: `# Averages hide the experience that generates support tickets.
# p50 is the typical user. p95 is the angry one. p99 is the tweet.

metrics.histogram("llm.ttft_ms", ttft_ms,
                  tags=[f"model:{model}", f"cached:{cache_hit}"])
metrics.histogram("llm.total_ms", total_ms, tags=[f"model:{model}"])
metrics.histogram("llm.output_tokens", out_tokens)
metrics.gauge("llm.tokens_per_sec", out_tokens / max(gen_s, 0.001))

# Alert on p95 TTFT, not on the mean. A mean of 900ms is perfectly
# compatible with 5% of users waiting 8 seconds.`,
        },

        {
          t: "check",
          key: "st-1",
          q: "Your streaming endpoint works locally but the browser receives the whole response at once in production. Most likely cause?",
          options: [
            "The model doesn't support streaming",
            "A reverse proxy or CDN is buffering the response",
            "The client library is wrong",
            "TTFT is too high",
          ],
          answer: 1,
          why: "This is the classic production-only streaming bug. nginx, many CDNs, and some load balancers buffer responses by default, so chunks accumulate and flush together. Set `X-Accel-Buffering: no`, disable proxy buffering for the route, and confirm your CDN doesn't buffer `text/event-stream`.",
        },
      ],
      takeaways: [
        "TTFT is what users feel; TPOT above ~25 tok/s is effectively invisible. Optimise TTFT first.",
        "Measure the whole pipeline — embedding, search, and reranking often outweigh model time.",
        "Prompt caching cuts TTFT by 30–60% on hits, not just cost.",
        "Handle client disconnect (stop generating, you're still billed) and always persist partial output.",
        "Proxy buffering is the most common reason streaming works locally and fails in production.",
      ],
      quiz: [
        {
          q: "Which feels faster to a user?",
          options: [
            "3s TTFT, 4s total",
            "400ms TTFT, 6s total",
            "They feel the same",
            "Depends on the model",
          ],
          answer: 1,
          why: "Perceived responsiveness is dominated by the wait before anything appears. Once text is flowing, users read along and the remaining generation time is largely absorbed. The slower-overall option with a fast first token wins decisively.",
        },
        {
          q: "In a RAG request with 1.4s total latency, where is the bottleneck most often found?",
          options: [
            "Always the model",
            "Frequently in reranking or vector search — measure before assuming",
            "Prompt assembly",
            "Network transport",
          ],
          answer: 1,
          why: "A cross-encoder reranking 100 candidates can take 400ms on its own, and an untuned vector index with post-filtering can take just as long. Engineers habitually blame the model and switch to a smaller one for no gain. Instrument each stage first.",
        },
        {
          q: "Why must you check for client disconnect during streaming?",
          options: [
            "To free memory",
            "Because generation continues and you keep paying for tokens nobody will read",
            "It's an API requirement",
            "To avoid rate limits",
          ],
          answer: 1,
          why: "Without a disconnect check the provider keeps generating to completion and bills you for the full output. On a high-traffic endpoint where users frequently navigate away mid-answer, this is a measurable and entirely avoidable line item.",
        },
        {
          q: "Why alert on p95 TTFT rather than the mean?",
          options: [
            "p95 is easier to compute",
            "A healthy mean is fully compatible with a meaningful fraction of users waiting many seconds",
            "Means are unavailable in most tools",
            "p95 is the industry standard",
          ],
          answer: 1,
          why: "Averages are dominated by the bulk of fast requests and conceal the tail. A 900ms mean can hide 5% of users at 8 seconds — and those are precisely the users who complain, churn, or post screenshots. Percentiles surface the experience that actually matters.",
        },
      ],
      cards: [
        {
          f: "TTFT vs TPOT — which matters more and why?",
          b: "TTFT. Below ~500ms feels instant, above ~2s feels broken. TPOT above ~25 tok/s exceeds reading speed and further gains are invisible. Optimise TTFT first.",
        },
        {
          f: "Three things that silently break SSE streaming in production?",
          b: "Reverse-proxy/CDN buffering (fix with X-Accel-Buffering: no), missing client-disconnect checks (you keep paying), and not persisting partial output on disconnect (corrupts the next turn).",
        },
        {
          f: "Name three perceived-latency wins that don't touch the model.",
          b: "Instant acknowledgement + typing indicator; streaming pipeline stage updates ('Searching…', 'Found 4 sources'); rendering retrieved citations before generation starts; speculative prefetch on debounced input.",
        },
      ],
      resources: [
        {
          title: "MDN — Server-sent events",
          url: "https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events",
          kind: "docs",
        },
      ],
    },

    /* ------------------------------------------------------ */
    {
      id: "resilience",
      phase: "building",
      title: "Caching, Retries & Idempotency",
      subtitle:
        "LLM APIs fail more than you'd like and cost more than you'd like. The same three patterns fix both, and they're all ordinary backend engineering.",
      minutes: 22,
      difficulty: "intermediate",
      tags: ["reliability", "caching", "cost"],
      objectives: [
        "Implement prompt caching for maximum hit rate",
        "Build retry logic that doesn't amplify an outage",
        "Make LLM calls with side effects safely repeatable",
      ],
      body: [
        {
          t: "h",
          text: "Prompt caching: the highest-ROI optimisation available",
        },
        {
          t: "p",
          text: "Providers cache the computed attention state (the KV cache) for a stable prompt prefix. A cache hit skips recomputing that prefix — typically **75–90% cheaper** on those tokens and **30–60% faster** to first token. It requires only that your prefix be byte-identical.",
        },
        {
          t: "code",
          lang: "python",
          caption: "Layout is everything",
          code: `# ---- WRONG: cache is destroyed on every request ----
system = f"""You are a support agent.
Current time: {datetime.now()}          # <-- changes every call
User: {user.name} (id={user.id})        # <-- changes every user
{LONG_POLICY_DOCUMENT}                  # 8,000 tokens, never reused
"""

# ---- RIGHT: stable prefix first, volatile content last ----
system = f"""You are a support agent.
{LONG_POLICY_DOCUMENT}                  # 8,000 tokens, cached
{TOOL_GUIDANCE}                         # stable
"""                                     # <-- cache breakpoint here

user_turn = f"""<session>
time: {datetime.now()}
user: {user.name} (id={user.id})
</session>

<docs>{retrieved}</docs>

{question}"""

# Anthropic: mark the breakpoint explicitly.
messages = [{
    "role": "system",
    "content": [{
        "type": "text",
        "text": system,
        "cache_control": {"type": "ephemeral"},   # <-- cache up to here
    }],
}]`,
        },
        {
          t: "table",
          head: ["Rule", "Why"],
          rows: [
            [
              "Stable content first, volatile last",
              "Cache matches on prefix. One early variable char invalidates everything after it.",
            ],
            [
              "Never interpolate time, IDs, or randoms into the prefix",
              "The single most common cause of a 0% hit rate.",
            ],
            [
              "Sort any dict you serialise into the prompt",
              "Python dict ordering is stable but JSON from elsewhere may not be. Non-deterministic key order silently kills the cache.",
            ],
            [
              "Keep tool definitions stable and ordered",
              "Tools are part of the prefix. Reordering them per request breaks the cache.",
            ],
            [
              "Watch the minimum cacheable length",
              "Providers set a floor (often ~1k tokens). Short prefixes aren't cached at all.",
            ],
            [
              "Track cache-hit rate as a first-class metric",
              "If it drops, something changed in your prompt assembly. You want to know within the hour.",
            ],
          ],
        },
        {
          t: "note",
          kind: "money",
          title: "What this is worth",
          text: "A support bot with an 8,000-token stable prefix serving 100k requests/day: at full price that prefix alone costs roughly $2,400/month. At an 85% hit rate with a 90% discount on hits, it's around $560. Same behaviour, same model, one layout decision.",
        },

        { t: "h", text: "Semantic caching, and why to be careful" },
        {
          t: "p",
          text: "Exact-match response caching is safe and useful for repeated identical queries — FAQ traffic, retried requests, popular questions. Semantic caching goes further: embed the query and serve a cached answer for anything above a similarity threshold.",
        },
        {
          t: "compare",
          left: {
            title: "Exact-match cache",
            kind: "good",
            items: [
              "Key on hash(model + prompt + params)",
              "Zero risk of a wrong answer",
              "Hit rates of 10–40% on real traffic",
              "Trivial to implement and reason about",
            ],
          },
          right: {
            title: "Semantic cache",
            kind: "bad",
            items: [
              "Higher hit rate, real correctness risk",
              "'Refund policy for Pro?' ≈ 'for Enterprise?' — near-identical embeddings, different answers",
              "Needs a high threshold (≥0.95) and namespacing",
              "Never cache across users or tenants",
            ],
          },
        },
        {
          t: "note",
          kind: "warn",
          title: "The semantic caching failure that ships to production",
          text: "Two queries differing only in a critical entity — a plan name, a date, an account — can sit above 0.95 cosine similarity while having completely different correct answers. If you use semantic caching, namespace the key by every entity that changes the answer, and never share a cache across tenants.",
        },

        { t: "h", text: "Retries that don't amplify an outage" },
        {
          t: "code",
          lang: "python",
          caption: "Exponential backoff with full jitter",
          code: `import random, asyncio

async def with_retry(fn, *, max_attempts=4, base=0.5, cap=8.0):
    last = None
    for attempt in range(max_attempts):
        try:
            return await fn()

        except ContextLengthExceeded:
            raise                       # caller must shrink; retry is futile

        except (BadRequest, Unauthenticated, Forbidden, NotFound):
            raise                       # terminal: fail fast, loudly

        except RateLimited as e:
            last = e
            # Respect the provider's own guidance when present.
            delay = e.retry_after or min(cap, base * 2 ** attempt)
            delay += random.uniform(0, delay)          # FULL jitter

        except (ServerError, Overloaded, Timeout) as e:
            last = e
            delay = min(cap, base * 2 ** attempt)
            delay += random.uniform(0, delay)

        if attempt < max_attempts - 1:
            metrics.incr("llm.retry", tags=[f"attempt:{attempt}"])
            await asyncio.sleep(delay)

    raise last`,
        },
        {
          t: "note",
          kind: "pitfall",
          title: "Jitter is not optional",
          text: "Without jitter, every client that failed at the same moment retries at the same moment. You've built a synchronised load generator aimed at a service that's already struggling — the thundering herd. Full jitter (a uniform random delay between 0 and the computed backoff) spreads the retries and is two lines of code.",
        },
        {
          t: "p",
          text: "Above the retry layer you also want a **circuit breaker**: after N consecutive failures, stop calling for a cooldown period and fail fast. Retrying into a dead provider adds latency to every request and delays your fallback.",
        },

        { t: "h", text: "Idempotency, once calls have effects" },
        {
          t: "p",
          text: "A timeout doesn't tell you whether the work happened. If your LLM call sends an email, creates a ticket, or issues a refund, a naive retry does it twice.",
        },
        {
          t: "code",
          lang: "python",
          caption: "Client-supplied key, server-side dedupe",
          code: `import hashlib, json

def idem_key(user_id: str, conversation_id: str, message: str) -> str:
    payload = json.dumps(
        {"u": user_id, "c": conversation_id, "m": message},
        sort_keys=True,                        # deterministic
    )
    return hashlib.sha256(payload.encode()).hexdigest()[:32]

async def handle(req) -> Result:
    key = idem_key(req.user_id, req.conversation_id, req.message)

    # Atomic claim: only one concurrent attempt proceeds.
    claimed = await redis.set(f"idem:{key}", "in_progress",
                              nx=True, ex=300)
    if not claimed:
        existing = await redis.get(f"idem:{key}")
        if existing == "in_progress":
            raise InProgress(retry_after=2)     # 409, tell client to wait
        return Result.model_validate_json(existing)

    try:
        result = await do_expensive_work(req)
        await redis.set(f"idem:{key}", result.model_dump_json(), ex=86_400)
        return result
    except Exception:
        await redis.delete(f"idem:{key}")        # allow a genuine retry
        raise`,
        },
        {
          t: "note",
          kind: "pro",
          title: "Idempotency also stops double-billing yourself",
          text: "Beyond preventing duplicate side effects, this pattern means a user who double-clicks 'send' doesn't trigger two expensive generations. On any endpoint doing agentic work costing cents per call, that's a real saving and a better user experience at the same time.",
        },

        {
          t: "check",
          key: "res-1",
          q: "Your prompt cache hit rate is 0% despite a 6,000-token stable system prompt. First thing to check?",
          options: [
            "Whether the model supports caching",
            "Whether anything volatile — a timestamp, user ID, or unsorted dict — is being interpolated into the prefix",
            "Whether the prompt is long enough",
            "Whether temperature is 0",
          ],
          answer: 1,
          why: "Caching keys on a byte-identical prefix. A single interpolated timestamp, session ID, or JSON object with non-deterministic key ordering makes every request unique and produces exactly 0%. Log the rendered prefix hash per request — if it varies, you've found it in seconds.",
        },
      ],
      takeaways: [
        "Prompt caching cuts prefix cost 75–90% and TTFT 30–60%. It only requires a byte-stable prefix.",
        "Never interpolate timestamps, user IDs, or unsorted structures into a cached prefix.",
        "Exact-match response caching is safe; semantic caching needs high thresholds, entity namespacing, and per-tenant isolation.",
        "Retry only 429/5xx, use full jitter, and add a circuit breaker above the retry layer.",
        "Any LLM call with side effects needs an idempotency key with an atomic claim.",
      ],
      quiz: [
        {
          q: "What single change most often takes a cache hit rate from 0% to 80%+?",
          options: [
            "Enabling caching in the SDK",
            "Moving volatile values out of the prompt prefix into the user turn",
            "Increasing prompt length",
            "Lowering temperature",
          ],
          answer: 1,
          why: "A 0% hit rate almost always means the prefix isn't stable. Relocating the timestamp, user ID, or session data below the cache breakpoint makes the prefix identical across requests, and the hit rate jumps immediately with no other change.",
        },
        {
          q: "Why is full jitter essential in retry backoff?",
          options: [
            "It reduces total retry count",
            "Without it, all clients that failed simultaneously retry simultaneously — a thundering herd on an already-degraded service",
            "Providers require it",
            "It improves cache hits",
          ],
          answer: 1,
          why: "Deterministic backoff synchronises every failed client onto the same retry schedule, so the recovering service is hit by a coordinated spike. Adding a uniform random component spreads the load out and materially improves recovery time for everyone.",
        },
        {
          q: "When is semantic caching genuinely dangerous?",
          options: [
            "When queries are long",
            "When two near-identical queries differ only in an entity that changes the correct answer",
            "When the cache is large",
            "When using a small embedding model",
          ],
          answer: 1,
          why: "'What's the refund policy for Pro?' and '...for Enterprise?' can exceed 0.95 cosine similarity while having entirely different correct answers. Serving one for the other is a confidently wrong response — worse than a cache miss. Namespace by every answer-determining entity.",
        },
        {
          q: "Why does an idempotency key need an atomic claim rather than a simple get-then-set?",
          options: [
            "For performance",
            "Two concurrent requests with the same key could both see 'not cached' and both execute",
            "Redis requires it",
            "To support expiry",
          ],
          answer: 1,
          why: "Get-then-set has a race window. Two simultaneous requests both read 'absent', both proceed, and both perform the side effect — exactly what the key was meant to prevent. `SET NX` claims the key atomically so only one attempt can proceed.",
        },
      ],
      cards: [
        {
          f: "What does prompt caching save, and what does it require?",
          b: "75–90% off cached input tokens and 30–60% off TTFT. Requires a byte-identical prompt prefix — no interpolated timestamps, IDs, or unsorted structures before the cache breakpoint.",
        },
        {
          f: "What must a retry policy never retry?",
          b: "400 (malformed), 401/403 (auth), 404 (bad model), and context_length_exceeded. Retrying these burns quota and can never succeed. Retry 429 and 5xx with full jitter.",
        },
        {
          f: "Why is full jitter required in backoff?",
          b: "Deterministic backoff synchronises all failed clients into a coordinated retry spike (thundering herd) against an already-degraded service. Uniform random delay spreads the load.",
        },
        {
          f: "Why does idempotency need SET NX rather than get-then-set?",
          b: "Get-then-set has a race window where two concurrent requests both see 'absent' and both execute the side effect. An atomic claim guarantees only one proceeds.",
        },
      ],
      resources: [
        {
          title: "Anthropic — Prompt caching",
          url: "https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching",
          kind: "docs",
        },
        {
          title: "AWS — Exponential backoff and jitter",
          url: "https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/",
          kind: "article",
        },
      ],
    },

    /* ------------------------------------------------------ */
    {
      id: "conversation-state",
      phase: "building",
      title: "Multi-Turn State & Memory",
      subtitle:
        "The API is stateless, so conversation memory is entirely your design problem. Get the layering right and long conversations stay coherent and affordable.",
      minutes: 20,
      difficulty: "intermediate",
      tags: ["state", "memory"],
      objectives: [
        "Design the three-layer memory model",
        "Implement compaction that survives long sessions",
        "Avoid the security and correctness traps in client-supplied history",
      ],
      body: [
        {
          t: "p",
          text: "Because there's no server-side conversation, 'memory' means: what do I put in the next request? Mature systems layer three kinds.",
        },
        {
          t: "table",
          head: ["Layer", "Lifetime", "Contents", "Storage"],
          rows: [
            [
              "**Working memory**",
              "Current turn",
              "Recent messages verbatim, retrieved docs, tool results",
              "In the request",
            ],
            [
              "**Session memory**",
              "This conversation",
              "Compacted brief: goal, constraints, decisions, open questions",
              "Database row, rebuilt on compaction",
            ],
            [
              "**Long-term memory**",
              "Across conversations",
              "Stable user facts, preferences, prior outcomes",
              "Database or vector store, retrieved selectively",
            ],
          ],
        },
        {
          t: "note",
          kind: "pitfall",
          title: "Never trust client-supplied history",
          text: "If the browser sends the conversation array, a user can rewrite the assistant's previous turns — including inserting a fake turn where the assistant agreed to give them a refund, or where it revealed a system instruction. Store history server-side, keyed by an authenticated conversation ID, and accept only the new user message from the client. This is an authorisation bug, not a nitpick.",
        },

        { t: "h", text: "Working memory: the sliding window with a brief" },
        {
          t: "code",
          lang: "python",
          caption: "Assemble under an enforced budget",
          code: `KEEP_VERBATIM = 6          # recent turns kept word-for-word
COMPACT_THRESHOLD = 0.70   # of the input budget

async def build_messages(conv_id: str, new_msg: str, budget: int):
    conv = await db.get_conversation(conv_id)     # server-side truth

    parts = [{"role": "system", "content": SYSTEM}]   # stable, cached

    # Long-term: retrieve only what's relevant to THIS message,
    # never the user's whole history.
    facts = await memory.search(conv.user_id, new_msg, k=3)
    if facts:
        parts.append({
            "role": "user",
            "content": "<known_user_facts>\\n"
                       + "\\n".join(f"- {f.text}" for f in facts)
                       + "\\n</known_user_facts>",
        })

    # Session: the compacted brief, if one exists.
    if conv.brief:
        parts.append({"role": "user",
                      "content": f"<brief>\\n{conv.brief}\\n</brief>"})
        parts.append({"role": "assistant",
                      "content": "Understood, continuing."})

    # Working: recent turns verbatim.
    parts += conv.messages[-KEEP_VERBATIM:]
    parts.append({"role": "user", "content": new_msg})

    # Hard budget enforcement — trim verbatim turns before overflowing.
    while count_tokens(parts) > budget and len(parts) > 4:
        del parts[3]        # drop the oldest verbatim turn

    if count_tokens(parts) > budget * COMPACT_THRESHOLD:
        asyncio.create_task(compact_later(conv_id))   # off the hot path

    return parts`,
        },
        {
          t: "note",
          kind: "pro",
          title: "Compact off the request path",
          text: "Compaction is another LLM call — adding it inline to a user request adds a second or more of latency. Trigger it as a background task after responding, so the *next* turn benefits. Users never wait for housekeeping.",
        },

        { t: "h", text: "Long-term memory: extract, don't dump" },
        {
          t: "p",
          text: "The naive version stores every conversation and retrieves similar past ones. That fills the context with noise. The better version extracts durable **facts** and retrieves only those relevant to the current message.",
        },
        {
          t: "code",
          lang: "python",
          caption: "Fact extraction with a conflict policy",
          code: `class UserFact(BaseModel):
    kind: Literal["preference", "constraint", "identity",
                  "history", "goal"]
    text: str = Field(max_length=200)
    confidence: float = Field(ge=0, le=1)
    supersedes: Optional[str] = Field(
        default=None,
        description="ID of a fact this one replaces, if it contradicts one.",
    )

EXTRACT = """Extract durable facts about this user from the conversation.

Include only what will still be true next month:
preferences, constraints, role, stated goals, decided outcomes.

Exclude: transient state ("looking at invoice #42"), anything
already in <existing_facts>, and anything you inferred rather than
were told. If a new fact contradicts an existing one, set
\`supersedes\` to that fact's id."""

# Run this once at the END of a conversation, not per turn.
# Per-turn extraction is expensive and produces near-duplicate facts.`,
        },
        {
          t: "note",
          kind: "warn",
          title: "Memory needs a delete path — and a visible one",
          text: "Users will ask you to forget things, and in many jurisdictions they have a legal right to. Design for it from the start: facts must be individually addressable, deletable, and ideally viewable by the user. Retrofitting deletion onto embeddings buried in a vector index is genuinely painful. A stale or wrong 'memory' that the user cannot correct is also a trust problem well before it's a legal one.",
        },

        { t: "h", text: "Branching and editing" },
        {
          t: "p",
          text: "Users edit a message and expect the conversation to fork. If you store messages as a flat list, editing corrupts history. Store a tree.",
        },
        {
          t: "code",
          lang: "python",
          caption: "Messages as a tree, conversation as a path",
          code: `class Message(BaseModel):
    id: str
    conversation_id: str
    parent_id: Optional[str]        # <- makes it a tree
    role: str
    content: str
    created_at: datetime

# The "current conversation" is a path from root to an active leaf.
def path_to(leaf_id: str) -> list[Message]:
    out, node = [], get(leaf_id)
    while node:
        out.append(node)
        node = get(node.parent_id) if node.parent_id else None
    return list(reversed(out))

# Editing = new sibling under the same parent, then switch the
# active leaf. Nothing is destroyed; the old branch stays browsable.`,
        },

        {
          t: "check",
          key: "cs-1",
          q: "Your client sends the full message array with each request, and the server passes it straight to the model. What's the most serious problem?",
          options: [
            "Wasted bandwidth",
            "A user can forge assistant turns — e.g. inserting a fabricated turn where the assistant approved a refund",
            "Messages might arrive out of order",
            "It breaks streaming",
          ],
          answer: 1,
          why: "The model treats prior assistant turns as its own established statements. If the client controls them, a user can manufacture consent, extract behaviour your rules forbid, or plant false facts. Store history server-side keyed by an authenticated conversation ID and accept only the new user message from the client.",
        },
      ],
      takeaways: [
        "Layer memory: working (verbatim recent), session (compacted brief), long-term (extracted facts).",
        "Never trust client-supplied conversation history — it's an authorisation vulnerability.",
        "Run compaction as a background task after responding, never inline in the request.",
        "Extract durable facts rather than storing whole conversations; retrieve only what's relevant now.",
        "Store messages as a tree so editing forks rather than destroys history.",
      ],
      quiz: [
        {
          q: "Why store conversation history server-side rather than accepting it from the client?",
          options: [
            "To save bandwidth",
            "Because a client-controlled history lets users forge assistant turns and manipulate model behaviour",
            "Because clients can't store enough data",
            "To enable streaming",
          ],
          answer: 1,
          why: "The model treats previous assistant messages as things it said and will stay consistent with them. A user who can edit those turns can fabricate approvals, extract restricted behaviour, or plant false context. It's an authorisation boundary, and bandwidth is beside the point.",
        },
        {
          q: "Why run compaction as a background task?",
          options: [
            "It's more reliable",
            "Compaction is an extra LLM call; inline it adds a second or more to the user's wait",
            "Background tasks are cheaper",
            "It avoids rate limits",
          ],
          answer: 1,
          why: "Summarising history requires its own model call. Doing it inline means the user waits for housekeeping before getting their answer. Triggering it after the response means the next turn benefits and nobody waits.",
        },
        {
          q: "What's the advantage of extracting facts over storing whole past conversations?",
          options: [
            "It uses less storage",
            "Retrieved facts are dense and relevant; whole conversations fill the context with noise",
            "Facts are more accurate",
            "It's required for compliance",
          ],
          answer: 1,
          why: "A retrieved past conversation is mostly irrelevant to the current message, and it consumes budget that retrieval and recent turns need. Extracted facts are one line each, individually relevant, individually deletable, and individually correctable.",
        },
        {
          q: "Why store messages as a tree rather than a list?",
          options: [
            "Better query performance",
            "So editing a message forks the conversation instead of destroying history",
            "To support multiple users",
            "For compression",
          ],
          answer: 1,
          why: "Users edit messages and expect a branch, with the ability to go back. A flat list forces you to overwrite or delete. A parent pointer per message makes each conversation a path to a leaf; an edit becomes a new sibling and nothing is lost.",
        },
      ],
      cards: [
        {
          f: "Describe the three memory layers.",
          b: "Working: recent turns verbatim + retrieved docs, in the request. Session: compacted brief (goal/constraints/decisions/open questions), in a DB row. Long-term: extracted durable user facts, retrieved selectively.",
        },
        {
          f: "Why is client-supplied conversation history a security bug?",
          b: "The model treats prior assistant turns as its own statements. A user who controls them can forge approvals, extract restricted behaviour, or plant false facts. Store server-side, keyed by authenticated conversation ID.",
        },
        {
          f: "When should you extract long-term facts?",
          b: "Once at the end of a conversation, not per turn. Per-turn extraction is expensive and generates near-duplicate facts. Include a `supersedes` field so contradictions resolve cleanly.",
        },
      ],
      resources: [
        {
          title: "Anthropic — Building effective agents (memory patterns)",
          url: "https://www.anthropic.com/engineering/building-effective-agents",
          kind: "guide",
        },
      ],
    },

    /* ------------------------------------------------------ */
    {
      id: "cost-latency",
      phase: "building",
      title: "Cost & Latency Engineering",
      subtitle:
        "Unit economics decide whether your feature is a product or a demo. Here's how to model them, and the levers that actually move the numbers.",
      minutes: 20,
      difficulty: "intermediate",
      tags: ["cost", "latency", "economics"],
      objectives: [
        "Build a unit-economics model for an AI feature",
        "Apply the cost levers in order of return",
        "Set and defend a latency budget",
      ],
      body: [
        { t: "h", text: "Unit economics, from the top" },
        {
          t: "p",
          text: "The number that matters is **cost per active user per month**, compared against what that user is worth. Everything else is a means to that end.",
        },
        {
          t: "code",
          lang: "text",
          caption: "The model you should be able to write from memory",
          code: `Per request
  input tokens  x input rate
+ output tokens x output rate
+ embedding cost (if retrieving)
+ reranker cost (if reranking)
+ infra (compute, vector DB, cache)
= cost per request

Per user per month
  requests/user/month x cost per request
= cost per user

Margin check
  revenue per user  -  cost per user  =  contribution
  If contribution <= 0, you have a science project.

Worked example: RAG support bot on a $29/mo plan
  40 requests/user/month
  $0.021 per request (measured, not guessed)
  -> $0.84/user/month  ->  2.9% of revenue. Healthy.

Same feature, agentic, 12 model calls per request
  $0.19 per request  ->  $7.60/user/month  ->  26% of revenue.
  Viable, but it now needs a product decision, not just an eng one.`,
        },
        {
          t: "note",
          kind: "money",
          title: "The trap: heavy users",
          text: "Costs are usually distributed with a long tail — the top 5% of users can consume 40%+ of your inference spend. An average that looks fine can hide a handful of accounts costing more than they pay. Model the p95 user, not the mean, and put in rate limits before you need them.",
        },

        { t: "h", text: "Cost levers, ordered by return" },
        {
          t: "steps",
          items: [
            {
              title: "1. Prompt caching — 40–70% off input, zero quality cost",
              text: "Stable prefix, volatile content last. Nothing else in this list is as close to free.",
            },
            {
              title:
                "2. Model routing — 30–60% off total, no measurable quality loss",
              text: "Send the easy majority to a small model, keep the frontier model for the hard tail.",
            },
            {
              title: "3. Bound output length — output is 3–5× input rate",
              text: "Set max_tokens deliberately and instruct for brevity. The cheapest lever nobody uses.",
            },
            {
              title: "4. Retrieve less, rank better — 20–40% off input",
              text: "Five reranked chunks beat twenty unranked ones on quality *and* cost. Reranking pays for itself.",
            },
            {
              title: "5. Compact history — controls growth over long sessions",
              text: "Without it, per-turn cost grows without bound in long conversations.",
            },
            {
              title: "6. Exact-match response cache — 10–40% of traffic",
              text: "Real traffic is more repetitive than you expect, particularly FAQ-shaped queries.",
            },
            {
              title: "7. Batch APIs — ~50% off, for anything not user-facing",
              text: "Backfills, evals, bulk classification, nightly jobs. Free money if you can tolerate the delay.",
            },
            {
              title:
                "8. Fine-tune a small model — large savings, large upfront cost",
              text: "Last resort. Justify it with measured volume at a stable task; see Phase 08.",
            },
          ],
        },

        { t: "h", text: "Latency budgets" },
        {
          t: "p",
          text: "Set a p95 budget per interaction type and allocate it across stages. Without an explicit budget you get whatever the sum of unexamined choices produces.",
        },
        {
          t: "table",
          head: ["Interaction", "p95 budget", "Implication"],
          rows: [
            [
              "Inline autocomplete",
              "< 300ms TTFT",
              "Small model, no retrieval, aggressive caching",
            ],
            [
              "Chat reply",
              "< 1s TTFT, < 8s total",
              "Retrieval fine, one reranker pass, streaming required",
            ],
            [
              "Search with synthesis",
              "< 2s TTFT",
              "Parallelise embedding and filtering; show sources first",
            ],
            [
              "Agentic task",
              "< 30s, with progress",
              "Stream step updates; users tolerate waiting if they can see work",
            ],
            [
              "Batch / offline",
              "Minutes to hours",
              "Use batch APIs and the cheapest adequate model",
            ],
          ],
        },
        {
          t: "note",
          kind: "pro",
          title: "Parallelise everything independent",
          text: "Query embedding, metadata filtering, user-profile lookup, and permission checks usually have no dependencies on each other. Running them concurrently rather than sequentially frequently removes 200–400ms from a request for the cost of one `asyncio.gather`. Do this before considering a smaller model.",
        },
        {
          t: "code",
          lang: "python",
          caption: "Sequential vs concurrent",
          code: `# ---- 380ms: everything waits its turn ----
q_vec   = await embed(query)          # 90ms
docs    = await vsearch(q_vec)        # 120ms
profile = await get_profile(user_id)  # 60ms
perms   = await get_perms(user_id)    # 110ms

# ---- 210ms: only the real dependency is serialised ----
q_vec, profile, perms = await asyncio.gather(
    embed(query),          # 90ms
    get_profile(user_id),  # 60ms   } concurrent
    get_perms(user_id),    # 110ms  }
)
docs = await vsearch(q_vec, allowed=perms)   # 120ms

# 170ms saved. No model change, no quality change.`,
        },

        { t: "h", text: "What to instrument on day one" },
        {
          t: "list",
          items: [
            "Per request: model, input tokens, output tokens, cached tokens, cost, TTFT, total latency, cache hit, retry count, stop reason.",
            "Per user per day: request count, total cost. This is how you find the expensive tail.",
            "Per feature: cost per invocation, so you can kill features that don't earn their keep.",
            "Alerts on: daily spend versus budget, p95 TTFT, cache-hit-rate drops, error-rate spikes, and escalation rate from your router.",
          ],
        },
        {
          t: "note",
          kind: "warn",
          title: "The bill arrives a month later",
          text: "Provider dashboards lag, and by the time a spend anomaly appears there you've been paying for it for weeks. Compute cost per request from token counts in your own telemetry and alert on it in real time. A runaway agent loop can spend a month's budget in an afternoon, and the only thing standing between you and that is your own instrumentation.",
        },

        {
          t: "check",
          key: "cl-1",
          q: "Your AI feature costs $12/user/month on a $29/month plan. Which lever should you reach for first?",
          options: [
            "Switch every call to the cheapest model",
            "Measure where the tokens go, then apply caching and routing to the dominant contributor",
            "Add a usage cap immediately",
            "Fine-tune a small model",
          ],
          answer: 1,
          why: "You cannot optimise what you haven't measured. Instrument first: it might be a 12k-token uncached system prompt, unbounded output, twenty retrieved chunks where five would do, or history that never compacts. Caching and routing typically deliver 50–70% together once you know which one dominates. Blanket downgrades hurt quality, caps hurt users, and fine-tuning is weeks of work for a problem you haven't diagnosed.",
        },
      ],
      takeaways: [
        "The number that matters is cost per active user per month versus revenue per user.",
        "Model the p95 user, not the mean — the top 5% often consume 40%+ of inference spend.",
        "Lever order: caching, routing, output bounds, better ranking, compaction, response cache, batch APIs, fine-tuning last.",
        "Set explicit p95 latency budgets per interaction type and allocate them across pipeline stages.",
        "Compute cost from your own token telemetry in real time — the provider bill arrives far too late.",
      ],
      quiz: [
        {
          q: "Which cost lever has the best return-to-effort ratio and no quality cost?",
          options: [
            "Fine-tuning a small model",
            "Prompt caching with a stable prefix",
            "Reducing max_tokens to 200",
            "Switching to the cheapest model",
          ],
          answer: 1,
          why: "Caching cuts 40–70% of input cost, improves TTFT, and produces byte-identical behaviour because the model sees the same prompt. Nothing else on the list combines a large saving with zero quality impact — the others all trade quality or require weeks of work.",
        },
        {
          q: "Why model the p95 user rather than the average?",
          options: [
            "p95 is easier to compute",
            "Cost is long-tailed — a small fraction of users can consume a large share of spend and cost more than they pay",
            "Averages are unavailable",
            "It's an accounting requirement",
          ],
          answer: 1,
          why: "Usage distributions are heavily skewed. A healthy average can conceal accounts whose individual cost exceeds their subscription. Modelling the p95 user tells you whether you need rate limits, tiering, or usage-based pricing — before those accounts appear.",
        },
        {
          q: "Four independent lookups take 90, 120, 60 and 110ms sequentially. Best fix?",
          options: [
            "Cache all four",
            "Run the independent ones concurrently with asyncio.gather",
            "Move them to a background job",
            "Use a faster database",
          ],
          answer: 1,
          why: "Sequentially that's 380ms; concurrently the independent set costs only as long as its slowest member. This is usually a one-line change that removes 150–250ms with no quality or cost implications — do it before evaluating smaller models.",
        },
        {
          q: "Why compute cost from your own telemetry rather than the provider dashboard?",
          options: [
            "Dashboards are inaccurate",
            "They lag by hours to days — a runaway loop can burn a month's budget before it appears",
            "They don't show token counts",
            "For audit compliance",
          ],
          answer: 1,
          why: "Provider billing views are delayed by design. Real-time cost derived from your own token counts lets you alert within minutes of an anomaly. Given how quickly an agent loop or a broken cache can escalate spend, that lag is the difference between a small incident and a large invoice.",
        },
      ],
      cards: [
        {
          f: "What's the unit-economics number that matters?",
          b: "Cost per active user per month versus revenue per user. Model the p95 user, not the mean — the top 5% often consume 40%+ of inference spend.",
        },
        {
          f: "List the cost levers in order of return.",
          b: "1) Prompt caching 2) Model routing 3) Bound output length 4) Retrieve less, rank better 5) Compact history 6) Exact-match response cache 7) Batch APIs 8) Fine-tune a small model (last).",
        },
        {
          f: "Typical p95 latency budgets?",
          b: "Autocomplete <300ms TTFT. Chat <1s TTFT, <8s total. Search+synthesis <2s TTFT. Agentic <30s with streamed progress. Batch: minutes to hours.",
        },
        {
          f: "Why alert on cost from your own telemetry?",
          b: "Provider dashboards lag hours to days. A runaway agent loop or broken cache can spend a month's budget in an afternoon — only real-time token-derived cost catches it in time.",
        },
      ],
      resources: [
        {
          title: "OpenAI — Batch API",
          url: "https://platform.openai.com/docs/guides/batch",
          kind: "docs",
        },
      ],
    }
  );
})(window);
