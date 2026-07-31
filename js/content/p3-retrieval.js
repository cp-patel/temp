/* ============================================================
   Phase 04 — Retrieval & Knowledge Systems
   ============================================================ */
(function (global) {
  "use strict";
  var C = global.Curriculum;

  C.chapters.push(
    /* ------------------------------------------------------ */
    {
      id: "embeddings",
      phase: "retrieval",
      title: "Embeddings: Vectors & Semantic Space",
      subtitle:
        "Embeddings turn text into geometry, so 'related' becomes 'nearby'. Understanding what they do and don't encode prevents most RAG mistakes.",
      minutes: 20,
      difficulty: "intermediate",
      tags: ["embeddings", "vectors"],
      lab: "embeddings",
      objectives: [
        "Explain what an embedding encodes and what it discards",
        "Choose a distance metric and an embedding model deliberately",
        "Predict the queries where pure vector search will fail",
      ],
      body: [
        {
          t: "p",
          text: "An embedding model maps text to a fixed-length vector — commonly 384 to 3,072 dimensions — arranged so that texts with similar meaning land near each other. Retrieval becomes a nearest-neighbour search in that space.",
        },
        { t: "lab", id: "embeddings" },

        { t: "h", text: "Distance metrics" },
        {
          t: "p",
          text: "This phase is where AI engineering stops resembling prompt work and starts resembling search engineering — and search engineering is where most RAG systems are lost. Retrieval quality caps answer quality absolutely: no prompt can recover information the retriever never fetched.",
        },
        {
          t: "p",
          text: "Everything starts with a number that says how similar two vectors are. Three metrics are in common use and, for the embeddings you'll actually encounter, two of them are the same thing.",
        },
        {
          t: "table",
          head: ["Metric", "Formula", "When"],
          rows: [
            [
              "**Cosine similarity**",
              "dot(a,b) / (|a||b|)",
              "The default. Measures angle, ignores magnitude. Range -1 to 1.",
            ],
            [
              "**Dot product**",
              "dot(a,b)",
              "Identical ranking to cosine *if* vectors are normalised — and most modern models return normalised vectors. Faster.",
            ],
            [
              "**Euclidean (L2)**",
              "sqrt(sum (a-b)^2)",
              "Equivalent ranking to cosine on normalised vectors. Use when your index requires it.",
            ],
          ],
        },
        {
          t: "note",
          kind: "insight",
          title: "The practical upshot",
          text: "For normalised embeddings — which almost all current models produce — cosine, dot product, and L2 all give the *same ranking*. Pick whichever your vector database implements most efficiently and stop worrying about it. The metric matters far less than the model, the chunking, and whether you rerank.",
        },

        { t: "h", text: "What embeddings encode — and what they don't" },
        {
          t: "p",
          text: "Knowing how to compare vectors is not the same as knowing what they contain, and this is where intuition misleads people. Embeddings are excellent at topic and terrible at some things that look like topic.",
        },
        {
          t: "compare",
          left: {
            title: "Captured well",
            kind: "good",
            items: [
              "Topical similarity — 'car' near 'automobile'",
              "Paraphrase — different words, same meaning",
              "Domain and register",
              "Cross-lingual meaning, with multilingual models",
            ],
          },
          right: {
            title: "Not captured",
            kind: "bad",
            items: [
              "Negation — 'is safe' vs 'is not safe' sit very close",
              "Numbers and comparatives — 'over $500' vs 'under $500'",
              "Recency and authority — a 2019 draft ranks like a 2026 policy",
              "Exact identifiers — error codes, SKUs, function names",
            ],
          },
        },
        {
          t: "note",
          kind: "pitfall",
          title: "The negation problem is serious",
          text: "'The API supports batch requests' and 'The API does not support batch requests' have cosine similarity above 0.9. Vector search cannot reliably distinguish them, so a question about what is *not* supported may retrieve the exact opposite. Mitigate with hybrid search, a reranker (cross-encoders handle negation far better), and by requiring the model to quote the supporting sentence.",
        },

        {
          t: "p",
          text: 'That negation failure deserves emphasis because it is not an edge case. Retrieval that cannot distinguish "supports batch requests" from "does not support batch requests" will confidently ground an answer in a document that says the opposite of what the user needs — and the generation step has no way to notice.',
        },
        { t: "h", text: "Choosing an embedding model" },
        {
          t: "list",
          items: [
            "**Dimensions.** More isn't automatically better. 768–1536 is the sweet spot for most work; higher dimensions cost storage, memory, and search time. Several modern models support *truncation* (Matryoshka representation), letting you cut dimensions with graceful quality loss.",
            "**Max input length.** If the model truncates at 512 tokens and your chunks are 800, you're silently discarding a third of every chunk. Check this — it's a common silent failure.",
            "**Asymmetric support.** Many models expect a prefix distinguishing queries from documents ('query: ' vs 'passage: '). Omitting it degrades retrieval measurably.",
            "**Domain fit.** General models underperform on code, legal, medical, and heavily jargon-laden corpora. Test on your data.",
            "**Cost and hosting.** Embedding is cheap per token but you embed the whole corpus, then every query forever. Local models (via sentence-transformers) are viable and remove per-query cost.",
          ],
        },
        {
          t: "note",
          kind: "warn",
          title: "You cannot mix embedding models",
          text: "Vectors from different models live in incompatible spaces — comparing them produces meaningless similarity scores. Changing your embedding model means re-embedding the entire corpus. Store the model name and version alongside every vector so this is detectable rather than a mystery. Plan re-embedding as a migration, with a dual-write window if you can't take downtime.",
        },

        { t: "h", text: "Implementation notes that matter" },
        {
          t: "p",
          text: "Model chosen, the remaining decisions are unglamorous and each one is a bug people hit once. Prefixes, batching and caching are the three that matter.",
        },
        {
          t: "code",
          lang: "python",
          caption: "Batching, prefixes, and caching",
          code: `from openai import OpenAI
client = OpenAI()

MODEL = "text-embedding-3-small"
DIMS = 1536

def embed_documents(texts: list[str]) -> list[list[float]]:
    out = []
    # Batch aggressively: one request per 100-200 items is far
    # cheaper and faster than one request per item.
    for i in range(0, len(texts), 128):
        batch = texts[i:i + 128]
        resp = client.embeddings.create(
            model=MODEL,
            input=batch,
            dimensions=DIMS,
        )
        out.extend(d.embedding for d in resp.data)
    return out

# Some models need an explicit asymmetric prefix. Check the model card:
# omitting it can cost several points of recall.
def embed_query(q: str) -> list[float]:
    return client.embeddings.create(
        model=MODEL, input=[q], dimensions=DIMS,
    ).data[0].embedding

# Cache query embeddings: real traffic repeats far more than you expect,
# and this removes 50-100ms plus a network call from the hot path.
@lru_cache(maxsize=10_000)
def embed_query_cached(q: str) -> tuple:
    return tuple(embed_query(q.strip().lower()))`,
        },

        { t: "h", text: "The three-way choice you're actually making" },
        {
          t: "p",
          text: "Which brings us to the thing this whole chapter has been circling. Dense embeddings are one retrieval strategy, not the retrieval strategy, and choosing between the three is the subject of **Hybrid Search & Reranking** two chapters from here.",
        },
        {
          t: "flow",
          nodes: [
            { b: "Lexical", s: "BM25 — exact terms", c: "amber" },
            { b: "Dense", s: "embeddings — meaning", c: "cyan" },
            { b: "Hybrid + rerank", s: "both, then precision", c: "emerald" },
          ],
          cap: "Dense retrieval alone is the weakest of the three in production. Hybrid plus reranking is the default you should start from.",
        },

        {
          t: "check",
          key: "emb-1",
          q: "A user searches for error code `ERR_TLS_CERT_ALTNAME_INVALID`. Pure vector search returns general TLS articles but not the exact troubleshooting page. Why?",
          options: [
            "The embedding model is too small",
            "Rare exact identifiers have no learned semantic neighbourhood, so dense retrieval matches on general topic instead of the specific string",
            "The page wasn't indexed",
            "Cosine similarity is the wrong metric",
          ],
          answer: 1,
          why: "Embeddings encode learned semantic structure. A rare error code appears too infrequently in training for a meaningful representation, so the model embeds it roughly as 'something about TLS certificates' — retrieving topically related pages instead of the exact match. This is precisely the gap BM25 fills: exact term matching handles rare identifiers perfectly. It's the single strongest argument for hybrid search.",
        },
      ],
      takeaways: [
        "Embeddings map text to geometry so semantic similarity becomes proximity.",
        "For normalised vectors, cosine, dot product, and L2 give identical rankings — the metric is not your problem.",
        "Embeddings miss negation, numeric comparisons, recency, authority, and exact identifiers.",
        "Check max input length and whether the model needs query/document prefixes.",
        "You cannot mix embedding models. Store the model version with every vector and treat changes as migrations.",
      ],
      quiz: [
        {
          q: "Why do cosine similarity and dot product give the same ranking for most modern embedding models?",
          options: [
            "They're mathematically identical",
            "Because the models return normalised vectors, making magnitude constant",
            "Vector databases convert between them",
            "Cosine is implemented as dot product internally",
          ],
          answer: 1,
          why: "Cosine divides the dot product by the vector magnitudes. When all vectors have unit length, that divisor is 1, so cosine reduces to the dot product exactly. Since most current models emit normalised vectors, the two rank identically and dot product is simply faster.",
        },
        {
          q: "'The API supports webhooks' vs 'The API does not support webhooks' — what's their approximate cosine similarity?",
          options: ["Around 0.1", "Around 0.5", "Above 0.9", "Exactly 0"],
          answer: 2,
          why: "They share nearly all their tokens and their entire topic; only one short negation differs. Embeddings encode topical content, not logical polarity, so they land very close together. This is why negation-sensitive questions need a reranker, hybrid retrieval, and a verbatim-quote requirement.",
        },
        {
          q: "You switch embedding models to improve quality. What must you do?",
          options: [
            "Nothing — vectors are compatible",
            "Re-embed the entire corpus; vectors from different models are not comparable",
            "Only re-embed new documents",
            "Adjust the similarity threshold",
          ],
          answer: 1,
          why: "Different models produce vectors in unrelated coordinate spaces. Comparing across them yields similarity scores that look plausible and mean nothing. A model change is a full corpus re-embedding — plan it as a migration and store the model version with each vector so mismatches are detectable.",
        },
        {
          q: "Your chunks are 800 tokens but the embedding model's max input is 512. What happens?",
          options: [
            "An error is raised",
            "The text is silently truncated and you lose a third of every chunk's content",
            "The model automatically summarises",
            "Quality is unaffected",
          ],
          answer: 1,
          why: "Most embedding APIs truncate silently rather than erroring. Everything past the limit contributes nothing to the vector, so a third of each chunk becomes unretrievable while appearing indexed. Always check max input length against your chunk size.",
        },
      ],
      cards: [
        {
          f: "What do embeddings fail to capture?",
          b: "Negation ('is'/'is not' are >0.9 similar), numeric comparisons, recency, authority/trustworthiness, and rare exact identifiers like error codes and SKUs.",
        },
        {
          f: "Cosine vs dot product vs L2 — which to use?",
          b: "For normalised vectors (most modern models) all three give identical rankings. Pick whichever your vector DB implements fastest; the metric matters far less than chunking and reranking.",
        },
        {
          f: "What happens if you change embedding models?",
          b: "You must re-embed the entire corpus — vectors from different models occupy incompatible spaces and cross-model similarity is meaningless. Store the model version with every vector.",
        },
        {
          f: "What is asymmetric embedding?",
          b: "Models that expect distinct prefixes for queries vs documents (e.g. 'query: ' / 'passage: '). Omitting the prefix measurably degrades recall. Check the model card.",
        },
      ],
      resources: [
        {
          title: "MTEB — embedding benchmark leaderboard",
          url: "https://huggingface.co/spaces/mteb/leaderboard",
          kind: "tool",
        },
        {
          title: "Matryoshka Representation Learning",
          url: "https://arxiv.org/abs/2205.13147",
          kind: "paper",
        },
      ],
    },

    /* ------------------------------------------------------ */
    {
      id: "chunking",
      phase: "retrieval",
      title: "Chunking Strategies That Work",
      subtitle:
        "The most under-appreciated decision in RAG. Chunking determines the ceiling on your retrieval quality, and no amount of reranking recovers information a bad split destroyed.",
      minutes: 24,
      difficulty: "intermediate",
      tags: ["chunking", "ingestion"],
      lab: "chunking",
      objectives: [
        "Choose a chunking strategy from document structure",
        "Apply contextual enrichment to fix orphaned chunks",
        "Size chunks and overlap with a rationale rather than a default",
      ],
      body: [
        {
          t: "p",
          text: "A chunk is the unit you retrieve. Two competing pressures set its size: it must be **small enough to be precise** (so a match is genuinely about the query) and **large enough to be self-contained** (so the model can actually use it).",
        },
        { t: "lab", id: "chunking" },

        { t: "h", text: "The strategies, worst to best" },
        {
          t: "p",
          text: 'Chunking is the highest-leverage decision in a RAG pipeline and the one teams spend least time on. It is also the most commonly cargo-culted: "500 tokens with 50 overlap" is repeated everywhere and is rarely the right answer for a specific corpus.',
        },
        {
          t: "table",
          head: ["Strategy", "How", "Verdict"],
          rows: [
            [
              "**Fixed characters**",
              "Split every N characters",
              "Cuts mid-sentence and mid-word. Only acceptable as a fallback.",
            ],
            [
              "**Recursive character**",
              "Split on paragraph, then sentence, then word, until under the limit",
              "The reasonable default. What most libraries give you.",
            ],
            [
              "**Structural**",
              "Split on the document's own boundaries — headings, sections, list items, functions, table rows",
              "**Best for structured documents.** Respects authorial intent.",
            ],
            [
              "**Semantic**",
              "Split where embedding similarity between consecutive sentences drops",
              "Sounds compelling, inconsistent in practice. Benchmark before adopting.",
            ],
            [
              "**Late chunking**",
              "Embed the whole document, then pool embeddings per chunk",
              "Each chunk vector carries whole-document context. Promising, needs a long-context embedding model.",
            ],
            [
              "**Parent-child**",
              "Index small chunks, return their larger parent to the model",
              "**Excellent.** Precision on retrieval, context on generation.",
            ],
          ],
        },
        {
          t: "note",
          kind: "insight",
          title: "Parent-child is the pattern to reach for first",
          text: "Embed and index small precise chunks (say 200–300 tokens) so matching is accurate, but when one hits, hand the model its surrounding parent section (1,000–2,000 tokens). You get precise retrieval and complete context without compromising either. It's a small amount of extra plumbing for a large quality gain, and it works on almost any corpus.",
        },

        { t: "h", text: "Sizing, with reasons" },
        {
          t: "p",
          text: "Strategy settled, size is the next question, and it has a real answer rather than a folk one. Work back from what the chunk has to contain to be self-sufficient.",
        },
        {
          t: "table",
          head: ["Content", "Chunk size", "Overlap", "Split on"],
          rows: [
            [
              "Technical docs, wikis",
              "400–800 tok",
              "10–15%",
              "Headings (H2/H3)",
            ],
            [
              "Code",
              "One function or class",
              "0 — use imports as metadata",
              "AST nodes, never line counts",
            ],
            [
              "Legal contracts",
              "One clause or subsection",
              "0 — clauses are atomic",
              "Numbered clause boundaries",
            ],
            [
              "Support tickets, chat logs",
              "One full thread",
              "0",
              "Conversation boundaries",
            ],
            [
              "Research papers",
              "One section, subsplit if long",
              "10%",
              "Section headers",
            ],
            [
              "Tables and spreadsheets",
              "Row groups + repeated header",
              "Header on every chunk",
              "Row boundaries",
            ],
            ["Narrative prose, books", "600–1,000 tok", "15–20%", "Paragraphs"],
          ],
        },
        {
          t: "note",
          kind: "pitfall",
          title: "Never chunk code by line count",
          text: "Splitting a file every 50 lines cuts functions in half, separates a signature from its body, and orphans class methods from their class. Use an AST parser (tree-sitter handles most languages) and chunk at function or class boundaries, attaching the file path and imports as metadata. This one change transforms code retrieval quality.",
        },

        {
          t: "p",
          text: "Notice the shape of both tables: every good option is one that respects the document's own structure, and every bad one imposes a structure the document doesn't have. That is the whole principle — chunk along the seams the author already put there.",
        },
        { t: "h", text: "Contextual enrichment: the highest-impact upgrade" },
        {
          t: "p",
          text: "Consider a chunk reading: *'This is not supported in the free tier.'* Retrieved in isolation it is worthless — what isn't supported? Contextual enrichment prepends a short generated description of where the chunk sits before embedding it.",
        },
        {
          t: "code",
          lang: "python",
          caption: "Contextual retrieval, in practice",
          code: `CONTEXT_PROMPT = """<document>
{document}
</document>

Here is a chunk from that document:
<chunk>
{chunk}
</chunk>

Write 1-2 sentences situating this chunk within the document: what
section it belongs to, what it is about, and which entities it
refers to. This will be prepended to the chunk to improve search.
Answer with the context only, nothing else."""

def enrich(document: str, chunk: str) -> str:
    # The document is a stable prefix -> cache it, and this becomes
    # cheap enough to run over an entire corpus.
    context = call_model(
        CONTEXT_PROMPT.format(document=document, chunk=chunk),
        cache_prefix=True,
        max_tokens=100,
    )
    return f"{context}\\n\\n{chunk}"

# Before: "This is not supported in the free tier."
# After:  "From the Webhooks section of the Acme API reference,
#          describing tier availability for outbound webhooks.
#
#          This is not supported in the free tier."`,
        },
        {
          t: "note",
          kind: "pro",
          title: "Why this is worth the ingestion cost",
          text: "Published results on contextual retrieval report substantial reductions in retrieval failure rate — and combining it with BM25 and reranking compounds further. Ingestion is a one-time cost per document, amortised over every future query. With prompt caching on the document prefix it's affordable even on large corpora. If your RAG is mediocre and you can only do one thing, do this.",
        },

        { t: "h", text: "Metadata: the free precision win" },
        {
          t: "p",
          text: "Enrichment fixes what a chunk means. Metadata fixes which chunks are even eligible, and it is the cheapest precision improvement available because it doesn't involve the model at all.",
        },
        {
          t: "p",
          text: "Every chunk should carry metadata, both for filtering and for citation. Filtering before vector search shrinks the candidate space and improves both precision and speed.",
        },
        {
          t: "code",
          lang: "python",
          caption: "A chunk record worth storing",
          code: `{
    "id": "acme-api-ref#webhooks#3",
    "text": "<enriched chunk text>",
    "embedding": [...],

    # --- for filtering ---
    "source": "acme-api-reference.md",
    "section": "Webhooks",
    "section_path": ["API Reference", "Events", "Webhooks"],
    "doc_type": "reference",
    "product": "acme-cloud",
    "version": "v4",
    "updated_at": "2026-03-11",
    "visibility": "public",       # never leak internal docs
    "tenant_id": "acme",          # hard multi-tenant boundary

    # --- for citation and UX ---
    "title": "Webhooks - tier availability",
    "url": "https://docs.acme.dev/api/webhooks#tiers",
    "parent_id": "acme-api-ref#webhooks",   # parent-child retrieval

    # --- for lexical search ---
    "keywords": ["webhook", "free tier", "outbound", "events"],
}`,
        },
        {
          t: "note",
          kind: "warn",
          title: "Filter before you search, not after",
          text: "Retrieving the top 20 and then dropping the ones the user can't see leaves you with three results, or none. Push tenant and permission filters into the vector query itself so the top 20 are 20 results the user is entitled to see. Most vector databases support pre-filtering — post-filtering is both a quality bug and a potential data-leak path.",
        },

        { t: "h", text: "Document parsing: the step before chunking" },
        {
          t: "p",
          text: "All of the above assumes you have clean text to chunk. Frequently you don't, and the quality of what comes out of a PDF sets a ceiling on everything downstream.",
        },
        {
          t: "list",
          items: [
            "**PDFs are hostile.** Multi-column layouts, headers/footers, and tables all corrupt naive text extraction. Use a layout-aware parser; for scanned documents you need OCR, and for complex tables a vision model often beats a parser.",
            "**Convert to Markdown first.** It preserves heading hierarchy, lists, and tables in a form that chunks cleanly and that models read well.",
            "**Keep tables intact.** A table split across chunks is unusable. Serialise each table as Markdown and repeat its header on every chunk if it must be split.",
            "**Strip boilerplate.** Navigation, cookie banners, and repeated footers pollute embeddings and waste tokens on every retrieval.",
            "**Preserve heading paths.** A chunk that knows it lives under 'Billing > Refunds > Enterprise' is far more useful than one that doesn't.",
          ],
        },

        {
          t: "check",
          key: "ch-1",
          q: "Your corpus is API reference docs with clear H2/H3 sections. Which chunking approach should you start with?",
          options: [
            "Fixed 512-token chunks with 50-token overlap",
            "Structural splitting on headings, with parent-child retrieval and contextual enrichment",
            "Semantic chunking with an embedding similarity threshold",
            "One chunk per document",
          ],
          answer: 1,
          why: "The document already tells you where the meaningful boundaries are — headings were written precisely to delimit topics. Structural splitting respects that, parent-child gives you precise matching with complete context, and contextual enrichment fixes chunks whose meaning depends on their section. Fixed-size splitting discards structural information you were handed for free.",
        },
      ],
      takeaways: [
        "Chunking sets the ceiling on retrieval quality; reranking cannot recover destroyed information.",
        "Split on the document's own structure — headings, clauses, AST nodes — before falling back to sizes.",
        "Parent-child retrieval (index small, return large) gives precision and context simultaneously.",
        "Contextual enrichment substantially reduces retrieval failures and is affordable with prompt caching.",
        "Filter by tenant and permission *inside* the vector query, never after retrieval.",
      ],
      quiz: [
        {
          q: "What is parent-child retrieval?",
          options: [
            "Chunking documents hierarchically by heading level",
            "Indexing small chunks for precise matching but passing their larger parent section to the model",
            "Retrieving from multiple databases",
            "Splitting chunks recursively until they fit",
          ],
          answer: 1,
          why: "It resolves the size tension directly. Small chunks give sharp similarity matching; the parent section gives the model enough surrounding context to answer well. You get both instead of compromising between them, at the cost of one extra lookup.",
        },
        {
          q: "Why is chunking code by line count a mistake?",
          options: [
            "Lines vary in length",
            "It splits functions mid-body and separates signatures from implementations, making chunks unusable",
            "Code shouldn't be chunked",
            "It's too slow",
          ],
          answer: 1,
          why: "Code's meaningful units are functions, classes, and modules — not arbitrary line spans. A chunk containing half a function body with no signature is unusable in a retrieval result. Use an AST parser like tree-sitter and split on syntactic boundaries.",
        },
        {
          q: "What problem does contextual enrichment solve?",
          options: [
            "Chunks being too long",
            "Chunks whose meaning depends on surrounding context they no longer have",
            "Slow embedding",
            "Duplicate chunks",
          ],
          answer: 1,
          why: "A chunk reading 'This is not supported in the free tier' is meaningless alone. Prepending a generated sentence naming its section and subject makes it both retrievable and interpretable. It's a one-time ingestion cost amortised across every future query.",
        },
        {
          q: "Why must permission filtering happen inside the vector query rather than after?",
          options: [
            "It's faster",
            "Post-filtering can leave you with almost no results, and risks leaking data if a filter is missed",
            "Vector databases require it",
            "It improves embedding quality",
          ],
          answer: 1,
          why: "Retrieve 20 then filter and you may be left with two — a silent quality collapse. Worse, any code path that forgets the filter leaks documents the user shouldn't see. Pre-filtering makes the entitlement boundary structural rather than a post-processing step you have to remember.",
        },
      ],
      cards: [
        {
          f: "Rank chunking strategies for a structured document corpus.",
          b: "Best: structural (split on headings/AST/clauses) + parent-child + contextual enrichment. Reasonable default: recursive character. Fallback only: fixed size. Semantic chunking: benchmark before trusting.",
        },
        {
          f: "What is contextual enrichment and why does it work?",
          b: "Prepend a generated 1–2 sentence description of where a chunk sits in its document before embedding. It makes context-dependent chunks both retrievable and interpretable, substantially cutting retrieval failures.",
        },
        {
          f: "Chunk size and overlap for technical docs vs code vs contracts?",
          b: "Docs: 400–800 tok, 10–15% overlap, split on headings. Code: one function/class, no overlap, AST boundaries. Contracts: one clause, no overlap — clauses are atomic.",
        },
        {
          f: "Why filter before vector search rather than after?",
          b: "Post-filtering collapses your result count (top-20 becomes 2) and any path that skips the filter leaks unauthorised documents. Pre-filtering makes entitlement structural.",
        },
      ],
      resources: [
        {
          title: "Anthropic — Contextual Retrieval",
          url: "https://www.anthropic.com/news/contextual-retrieval",
          kind: "research",
        },
        {
          title: "tree-sitter (AST parsing for code chunking)",
          url: "https://tree-sitter.github.io/tree-sitter/",
          kind: "tool",
        },
        {
          title: "Jina — Late chunking",
          url: "https://jina.ai/news/late-chunking-in-long-context-embedding-models/",
          kind: "article",
        },
      ],
    },

    /* ------------------------------------------------------ */
    {
      id: "vector-db",
      phase: "retrieval",
      title: "Vector Databases & Indexes",
      subtitle:
        "How approximate nearest-neighbour search actually works, which index to pick, and why Postgres is probably enough for what you're building.",
      minutes: 20,
      difficulty: "intermediate",
      tags: ["vectordb", "indexes", "infra"],
      objectives: [
        "Explain HNSW and IVF and their tuning parameters",
        "Choose between Postgres and a specialist store with a real threshold",
        "Avoid the operational traps in vector search at scale",
      ],
      body: [
        {
          t: "p",
          text: "Exact nearest-neighbour search compares your query against every vector — fine at 10,000 documents, impossible at 10 million. **Approximate** nearest-neighbour (ANN) indexes trade a small amount of recall for orders of magnitude in speed.",
        },

        { t: "h", text: "HNSW — the default" },
        {
          t: "p",
          text: "Two index families cover essentially all production use, and the choice between them is a memory-versus-latency trade rather than a quality one. Both are approximate: you are trading a small amount of recall for orders of magnitude of speed, and the tuning knobs control exactly how much.",
        },
        {
          t: "p",
          text: "Hierarchical Navigable Small World builds a layered proximity graph. Upper layers are sparse and let you traverse long distances quickly; lower layers are dense and refine locally. Search descends greedily from the top.",
        },
        {
          t: "table",
          head: ["Parameter", "Effect", "Sensible range"],
          rows: [
            [
              "`m`",
              "Edges per node. Higher = better recall, more memory",
              "16–48 (16 default, 32 for high recall)",
            ],
            [
              "`ef_construction`",
              "Candidate list size during build. Higher = better graph, slower build",
              "100–400",
            ],
            [
              "`ef_search`",
              "Candidate list size at query time. **The runtime recall/latency knob**",
              "40–200; tune against your eval set",
            ],
          ],
        },
        {
          t: "note",
          kind: "pro",
          title: "ef_search is your one live tuning knob",
          text: "It's adjustable per query without rebuilding the index. Raise it when recall matters (a user-facing search), lower it when latency matters (an autocomplete path). Measure recall@k against an exact brute-force search on a sample of a few thousand vectors — that's the only way to know what you're actually losing.",
        },

        {
          t: "p",
          text: "The row worth remembering is `ef_search`, because it is the only parameter you can change without rebuilding. Recall is tunable at query time, which means you can trade latency for quality per request rather than per deployment.",
        },
        { t: "h", text: "IVF — when memory is the constraint" },
        {
          t: "p",
          text: "Inverted File indexes cluster vectors with k-means, then search only the `nprobe` nearest clusters. Lower memory than HNSW and faster to build, but needs a training step and generally gives worse recall at the same latency.",
        },
        {
          t: "table",
          head: ["Index", "Recall", "Memory", "Build", "Use when"],
          rows: [
            [
              "**HNSW**",
              "Excellent",
              "High",
              "Slow",
              "Under ~10M vectors. The default.",
            ],
            [
              "**IVF-Flat**",
              "Good",
              "Medium",
              "Fast",
              "Memory-constrained, larger corpora",
            ],
            [
              "**IVF-PQ**",
              "Moderate",
              "Very low",
              "Fast",
              "100M+ vectors; quantisation loses precision",
            ],
            [
              "**Flat (brute force)**",
              "Perfect",
              "Low",
              "None",
              "Under ~50k vectors. Genuinely fine — don't over-engineer.",
            ],
          ],
        },
        {
          t: "note",
          kind: "insight",
          title: "Under 50,000 vectors, skip the index entirely",
          text: "A brute-force scan over 50k × 1536-dimension float32 vectors is a few hundred milliseconds of straightforward numpy, with perfect recall and zero tuning. Plenty of production systems are this size. Adding an ANN index at this scale buys latency you don't need in exchange for recall loss and operational complexity you didn't want.",
        },

        {
          t: "check",
          key: "vdb-mid",
          q: "You have 30,000 chunks and answer latency is fine. Which index should you build?",
          options: [
            "HNSW, since it is the production default",
            "IVF, to keep memory down at this scale",
            "None — a brute-force scan over 30,000 vectors is fast enough",
          ],
          answer: 2,
          why: "Approximate indexes trade recall for speed, and below roughly 50,000 vectors there is no speed problem to solve: a full scan finishes in single-digit milliseconds. Building an index there costs you recall and adds a rebuild step in exchange for nothing. Add one when a measurement says you need it.",
        },
        { t: "h", text: "Postgres + pgvector versus a specialist store" },
        {
          t: "p",
          text: "Index chosen, the bigger question is where it lives — and this is where teams over-engineer most reliably. A dedicated vector database is a new datastore to operate, back up, and keep consistent with the system of record.",
        },
        {
          t: "compare",
          left: {
            title: "Postgres + pgvector",
            kind: "good",
            items: [
              "Vectors, metadata, and relational data in one place",
              "Real transactions, real joins, real backups",
              "Pre-filtering by SQL WHERE — a major practical advantage",
              "One system your team already operates",
              "Comfortable to ~5–10M vectors",
            ],
          },
          right: {
            title: "Specialist (Qdrant, Weaviate, Milvus, Pinecone)",
            kind: "bad",
            items: [
              "Faster at very high vector counts and QPS",
              "Built-in hybrid search and sometimes reranking",
              "Better horizontal scaling and sharding",
              "Another system to run, monitor, and back up",
              "Data now lives in two places, with sync to maintain",
            ],
          },
        },
        {
          t: "note",
          kind: "pro",
          title: "The honest default",
          text: "Start with Postgres and pgvector. You almost certainly already run Postgres, transactional consistency between chunks and their metadata is genuinely valuable, and SQL pre-filtering is better than what most specialist stores offer. Migrate when you have a measured problem — usually past 5–10M vectors or when you need sustained high QPS. 'We might scale' is not a measured problem.",
        },
        {
          t: "p",
          text: "Two details in the query below are the ones that matter in practice: the filter runs inside the same statement rather than after the search, and the small chunk you matched on is not the text you hand to the model. Both are awkward with a bolt-on vector store and trivial in a relational database.",
        },
        {
          t: "code",
          lang: "python",
          caption: "pgvector with pre-filtering and parent-child",
          code: `CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE chunks (
    id           text PRIMARY KEY,
    parent_id    text REFERENCES parents(id),
    tenant_id    text NOT NULL,
    doc_type     text NOT NULL,
    visibility   text NOT NULL,
    updated_at   timestamptz NOT NULL,
    content      text NOT NULL,
    embedding    vector(1536) NOT NULL,
    tsv          tsvector GENERATED ALWAYS AS
                 (to_tsvector('english', content)) STORED
);

-- Vector index. Cosine here; use vector_ip_ops for dot product.
CREATE INDEX chunks_embedding_idx ON chunks
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 200);

-- Lexical index for the BM25-ish half of hybrid search.
CREATE INDEX chunks_tsv_idx ON chunks USING gin (tsv);

-- Filter columns MUST be indexed or pre-filtering scans the table.
CREATE INDEX chunks_tenant_idx ON chunks (tenant_id, visibility);

-- Query: filters applied by the planner, not after retrieval.
SET LOCAL hnsw.ef_search = 100;

SELECT id, parent_id, content,
       1 - (embedding <=> $1) AS similarity
FROM chunks
WHERE tenant_id = $2
  AND visibility = 'public'
  AND updated_at > now() - interval '2 years'
ORDER BY embedding <=> $1
LIMIT 20;`,
        },
        {
          t: "note",
          kind: "warn",
          title: "The pre-filter performance cliff",
          text: "A highly selective filter can make an ANN index counterproductive: the graph traversal keeps finding neighbours that fail the filter, so it walks a long way to fill the result set. If your filter cuts the corpus to under a few percent, a filtered brute-force scan is often faster. Test both — and index every column you filter on, or Postgres will sequentially scan and you'll blame the vector index.",
        },

        { t: "h", text: "Operational realities" },
        {
          t: "p",
          text: "Whichever you pick, a few facts about running one of these in production only become obvious after they've hurt. These are the ones worth knowing in advance.",
        },
        {
          t: "list",
          items: [
            "**Re-embedding is a migration.** Model changes invalidate every vector. Design for a dual-write window: new column, backfill, verify recall, cut over, drop the old column.",
            "**Deletes and updates matter.** HNSW handles deletion by tombstoning; heavy churn degrades the graph until you rebuild. Schedule rebuilds if your corpus turns over frequently.",
            "**Memory sizing.** Roughly: vectors × dimensions × 4 bytes, plus 30–100% for the HNSW graph. One million 1536-d vectors is ~6GB of raw floats before graph overhead.",
            "**Backups must include vectors.** Rebuilding from source means re-embedding the corpus, which costs real money and hours. Back up the embeddings.",
            "**Monitor recall, not just latency.** A misconfigured index gets fast and quietly bad. Run a recall check against brute force on a fixed sample, on a schedule.",
          ],
        },

        {
          t: "check",
          key: "vdb-1",
          q: "You have 80,000 chunks, one Postgres instance, and a team of three. Which setup?",
          options: [
            "A managed specialist vector database for future scale",
            "Postgres with pgvector and an HNSW index",
            "Self-hosted Milvus with sharding",
            "In-memory FAISS rebuilt on deploy",
          ],
          answer: 1,
          why: "80k vectors is comfortably within pgvector's range, you already operate Postgres, and keeping chunks with their metadata gives you transactional consistency plus SQL pre-filtering. A specialist store adds a second system to run for capacity you don't need; sharded Milvus is wildly disproportionate; FAISS rebuilt on deploy loses updates between deploys and has no durability story.",
        },
      ],
      takeaways: [
        "HNSW is the default under ~10M vectors; `ef_search` is your live recall/latency knob.",
        "Under ~50k vectors, brute force is genuinely fine — perfect recall, no tuning.",
        "Start with Postgres + pgvector. Migrate on a measured problem, not on anticipated scale.",
        "Index every column you filter on, and watch for the highly-selective-filter cliff.",
        "Monitor recall against brute force on a schedule — a bad index gets fast and quietly wrong.",
      ],
      quiz: [
        {
          q: "What does `ef_search` control in HNSW?",
          options: [
            "The number of edges per node",
            "Query-time candidate list size — the runtime recall vs latency tradeoff",
            "How many vectors are indexed",
            "The embedding dimension",
          ],
          answer: 1,
          why: "It sets how many candidates the search keeps while traversing the graph. Higher means better recall and more latency, and crucially it's adjustable per query without a rebuild — the one knob you can tune live per code path.",
        },
        {
          q: "When is brute-force search the right choice?",
          options: [
            "Never in production",
            "Under roughly 50,000 vectors, where a scan is fast enough and recall is perfect",
            "Only for testing",
            "When memory is unlimited",
          ],
          answer: 1,
          why: "A numpy scan over 50k × 1536-d float32 vectors takes a few hundred milliseconds with exact recall and zero tuning. Many real systems are this size. An ANN index here trades recall and operational complexity for latency you don't need.",
        },
        {
          q: "Why can a highly selective metadata filter make ANN search slower?",
          options: [
            "Filters aren't supported",
            "Graph traversal keeps finding neighbours that fail the filter, so it must walk much further to fill the result set",
            "Filters invalidate the index",
            "It forces re-embedding",
          ],
          answer: 1,
          why: "The HNSW graph is built on vector proximity and knows nothing about your filter. If only 1% of vectors qualify, the search discards nearly everything it finds and keeps walking. Below a few percent selectivity, a filtered brute-force scan often wins — test both.",
        },
        {
          q: "What's the strongest practical argument for pgvector over a specialist store?",
          options: [
            "It's faster",
            "Vectors, metadata, and relational data coexist transactionally with SQL pre-filtering, in a system you already run",
            "It supports more index types",
            "It has better hybrid search",
          ],
          answer: 1,
          why: "The win is operational and correctness-related, not performance. One system, real transactions between chunks and metadata, and SQL WHERE clauses the planner can apply before the vector scan. Specialist stores are faster at high scale — that's a reason to migrate later, on evidence.",
        },
      ],
      cards: [
        {
          f: "HNSW parameters and what each controls?",
          b: "m: edges per node (16–48), recall vs memory. ef_construction: build candidate list (100–400), graph quality vs build time. ef_search: query candidate list (40–200) — the live recall/latency knob, tunable per query.",
        },
        {
          f: "When should you skip an ANN index entirely?",
          b: "Under ~50,000 vectors. Brute-force numpy scan is a few hundred ms with perfect recall and zero tuning. An index here buys unneeded latency at the cost of recall and complexity.",
        },
        {
          f: "pgvector vs specialist vector DB — the decision rule?",
          b: "Start with pgvector: one system, transactional consistency, SQL pre-filtering. Migrate on measured need — typically past 5–10M vectors or sustained high QPS. Anticipated scale isn't a reason.",
        },
        {
          f: "Why can a selective filter slow down ANN search?",
          b: "The HNSW graph is built on proximity, not your filter. If few vectors qualify, traversal discards nearly everything it finds and walks much further. Below a few percent selectivity, filtered brute force often wins.",
        },
      ],
      resources: [
        {
          title: "pgvector",
          url: "https://github.com/pgvector/pgvector",
          kind: "repo",
        },
        {
          title: "HNSW paper",
          url: "https://arxiv.org/abs/1603.09320",
          kind: "paper",
        },
        {
          title: "Qdrant — filtering and vector search",
          url: "https://qdrant.tech/articles/vector-search-filtering/",
          kind: "article",
        },
      ],
    },

    /* ------------------------------------------------------ */
    {
      id: "hybrid-rerank",
      phase: "retrieval",
      title: "Hybrid Search & Reranking",
      subtitle:
        "Two additions turn a mediocre RAG system into a good one. Neither is glamorous and both should be in your first version, not your third.",
      minutes: 22,
      difficulty: "intermediate",
      tags: ["hybrid", "bm25", "reranking"],
      objectives: [
        "Implement BM25 + dense fusion with Reciprocal Rank Fusion",
        "Add a cross-encoder reranker in the right place",
        "Size candidate sets against a latency budget",
      ],
      body: [
        {
          t: "p",
          text: "This is the chapter that turns a demo RAG system into a working one, and it is largely about giving up on a single retriever. The two chapters before this each described a retrieval method with a specific blind spot. The fix is not a better method — it is running both and combining them.",
        },
        { t: "h", text: "Why dense retrieval alone underperforms" },
        {
          t: "p",
          text: "Embeddings capture meaning and miss exact strings. BM25 captures exact strings and misses paraphrase. Their failure modes are almost complementary, which is why combining them beats either — reliably, across corpora.",
        },
        {
          t: "table",
          head: ["Query", "BM25", "Dense", "Why"],
          rows: [
            [
              "`ERR_CERT_INVALID`",
              "Excellent",
              "Poor",
              "Rare exact token with no learned neighbourhood",
            ],
            [
              "'how do I cancel my plan'",
              "Poor",
              "Excellent",
              "Docs say 'terminate subscription' — no shared terms",
            ],
            [
              "'Acme Pro webhook limits'",
              "Good",
              "Good",
              "Both work; fusion improves ranking confidence",
            ],
            [
              "'what is not supported'",
              "Moderate",
              "Poor",
              "Negation defeats embeddings; a reranker is the real fix",
            ],
            [
              "`get_user_by_email`",
              "Excellent",
              "Moderate",
              "Identifier matching is lexical by nature",
            ],
          ],
        },

        { t: "h", text: "Reciprocal Rank Fusion" },
        {
          t: "p",
          text: "So you run both retrievers. That leaves the question of how to merge two ranked lists whose scores mean entirely different things, and the standard answer is deliberately simple.",
        },
        {
          t: "p",
          text: "The problem with combining two ranked lists is that their scores aren't comparable — BM25 returns unbounded relevance scores, cosine returns -1 to 1. RRF sidesteps normalisation entirely by using only **rank position**.",
        },
        {
          t: "code",
          lang: "python",
          caption: "RRF — twelve lines that reliably beat either list alone",
          code: `def rrf(rankings: list[list[str]], k: int = 60,
        weights: list[float] | None = None) -> list[tuple[str, float]]:
    """Fuse ranked ID lists. k dampens the influence of top ranks;
    60 is the value from the original paper and works well."""
    weights = weights or [1.0] * len(rankings)
    scores: dict[str, float] = {}

    for ranking, w in zip(rankings, weights):
        for rank, doc_id in enumerate(ranking, start=1):
            scores[doc_id] = scores.get(doc_id, 0.0) + w / (k + rank)

    return sorted(scores.items(), key=lambda kv: -kv[1])


# Usage: run both retrievers concurrently, then fuse.
async def hybrid_search(query: str, tenant: str, n: int = 50):
    dense_ids, lexical_ids = await asyncio.gather(
        vector_search(query, tenant, limit=n),
        bm25_search(query, tenant, limit=n),
    )
    # Weight dense slightly higher for natural-language corpora;
    # weight lexical higher for code and identifier-heavy corpora.
    return rrf([dense_ids, lexical_ids], weights=[1.0, 0.8])`,
        },
        {
          t: "note",
          kind: "insight",
          title: "Why RRF instead of weighted score blending",
          text: "Score blending requires normalising two distributions whose shapes differ per query, and the normalisation is where the bugs live. RRF only needs ordering, so it's robust, has one hyperparameter, and needs no per-query calibration. It's boring and it works — start here and only reach for learned fusion if you can measure a gain.",
        },

        {
          t: "check",
          key: "hr-mid",
          q: "A user searches for the exact error string `ERR_TLS_CERT_ALTNAME_INVALID`. Pure dense retrieval returns nothing useful. Why?",
          options: [
            "The string is too long for the embedding model's context",
            "A rare identifier has no learned semantic representation to match on",
            "Dense retrieval requires lowercase input",
          ],
          answer: 1,
          why: 'Embeddings encode meaning learned from training data, and a specific error constant carries almost none — there is no "nearby" concept for it to sit next to in vector space. BM25 handles this trivially because it matches the literal term. This asymmetry, not a tuning problem, is the whole case for running both retrievers and fusing them.',
        },
        { t: "h", text: "Reranking: precision where it counts" },
        {
          t: "p",
          text: "Fusion gets the right documents into your candidate set. It does not put them at the top, and for a generation step that only reads the first five, ordering is what matters.",
        },
        {
          t: "p",
          text: "A **cross-encoder** reads the query and a candidate document *together* and outputs a relevance score. Because it can attend across both, it handles negation, numeric qualifiers, and subtle intent that bi-encoders miss. It's also far too slow to run over a whole corpus — hence the two-stage design.",
        },
        {
          t: "flow",
          nodes: [
            { b: "Query", s: "", c: "accent" },
            { b: "Hybrid retrieve", s: "top 50–100", c: "cyan" },
            { b: "Cross-encode", s: "rerank all 50", c: "amber" },
            { b: "Top 5", s: "to the model", c: "emerald" },
          ],
          cap: "Retrieve broadly and cheaply for recall; rerank narrowly and expensively for precision.",
        },
        {
          t: "code",
          lang: "python",
          caption: "The full retrieval path",
          code: `async def retrieve(query: str, tenant: str,
                   final_k: int = 5) -> list[Chunk]:
    # Stage 1 — recall. Cast wide; cheap per candidate.
    fused = await hybrid_search(query, tenant, n=50)
    candidate_ids = [doc_id for doc_id, _ in fused[:50]]
    candidates = await load_chunks(candidate_ids)

    # Stage 2 — precision. Expensive per candidate, so few candidates.
    scores = await reranker.score(
        query=query,
        documents=[c.content for c in candidates],
    )
    ranked = sorted(zip(candidates, scores), key=lambda p: -p[1])

    # Stage 3 — cut on absolute score, not just position.
    # This is what gives you a real "no answer in corpus" path.
    kept = [c for c, s in ranked[:final_k] if s > RELEVANCE_FLOOR]

    # Stage 4 — parent-child expansion for generation context.
    return await expand_to_parents(kept)`,
        },
        {
          t: "note",
          kind: "pro",
          title: "The absolute-score cutoff is the underrated part",
          text: "Reranker scores are calibrated enough to threshold. Applying a floor means that when nothing relevant exists, you return *nothing* — and your generation prompt can then correctly say 'not documented' instead of confidently answering from the least-irrelevant chunk. Without this, top-k always returns k results and your system can never abstain. Calibrate the floor on your eval set.",
        },

        { t: "h", text: "Sizing against a latency budget" },
        {
          t: "p",
          text: "Rerankers are the most expensive stage in the pipeline, so the number of candidates you send is a direct latency decision. Work back from the budget you set in **Cost & Latency Engineering**.",
        },
        {
          t: "table",
          head: [
            "Candidates reranked",
            "Added latency",
            "Recall@5 gain",
            "Verdict",
          ],
          rows: [
            ["10", "~40ms", "Small", "Barely worth the call"],
            ["25", "~90ms", "Good", "Solid default for tight budgets"],
            ["50", "~180ms", "Strong", "**The usual sweet spot**"],
            [
              "100",
              "~350ms",
              "Marginal over 50",
              "Only if recall genuinely matters",
            ],
            ["200+", "~700ms+", "Negligible", "You're paying for nothing"],
          ],
        },
        {
          t: "note",
          kind: "warn",
          title: "These numbers are illustrative — measure yours",
          text: "Actual latency depends on the reranker, batch size, hardware, and document length. The shape holds though: gains flatten well before 100 candidates while latency keeps climbing linearly. Find your own knee point on your own eval set rather than adopting someone else's number.",
        },

        {
          t: "p",
          text: "One last lever, and it acts on the query rather than the corpus. Everything so far has assumed the user's question is a good search query. In multi-turn conversation it very often isn't.",
        },
        { t: "h", text: "Query transformation, when it earns its place" },
        {
          t: "list",
          items: [
            "**Query rewriting.** Turn 'what about the second one?' into a standalone query using conversation history. Essential for multi-turn RAG — without it, follow-up questions retrieve nothing.",
            "**Multi-query expansion.** Generate 3–4 paraphrases, retrieve for each, fuse with RRF. Improves recall on vague queries at the cost of extra retrieval round trips.",
            "**HyDE.** Generate a hypothetical answer and retrieve using *its* embedding. Helps when short queries must match verbose documents.",
            "**Decomposition.** Split a compound question ('compare X and Y on price and latency') into sub-queries and retrieve for each. Often the difference between a partial and a complete answer.",
          ],
        },
        {
          t: "note",
          kind: "pitfall",
          title: "Query rewriting is not optional in multi-turn RAG",
          text: "This is the single most common bug in chat-based RAG. The user asks 'and for the Enterprise plan?' — you embed that fragment, retrieve nothing useful, and the model answers from thin air. Always resolve pronouns and elisions against conversation history before retrieving. It's one cheap small-model call and it fixes a large class of failures.",
        },

        {
          t: "check",
          key: "hr-1",
          q: "Recall@20 is 94% but answer quality is poor. What's the highest-leverage fix?",
          options: [
            "Improve the embedding model",
            "Add a reranker to promote the genuinely relevant chunks into the top 5",
            "Increase the number of chunks sent to the model",
            "Improve the generation prompt",
          ],
          answer: 1,
          why: "Recall@20 of 94% means the right chunk is almost always retrieved — it's just ranked too low to reach the model. That's precisely the precision problem a cross-encoder reranker solves. Sending more chunks would work but costs tokens, adds latency, and invites context rot. The embedding model is already doing its job, and no prompt can use information it wasn't given.",
        },
      ],
      takeaways: [
        "BM25 and dense retrieval have complementary failure modes — hybrid beats either, reliably.",
        "Use RRF to fuse ranked lists: rank-based, no score normalisation, one hyperparameter.",
        "Retrieve ~50 candidates broadly, then cross-encode for precision. Gains flatten past 50.",
        "Apply an absolute reranker score floor so your system can genuinely return 'nothing relevant'.",
        "Query rewriting against conversation history is mandatory for multi-turn RAG, not an enhancement.",
      ],
      quiz: [
        {
          q: "Why does RRF use rank position instead of relevance scores?",
          options: [
            "It's faster to compute",
            "BM25 and cosine scores are on incomparable scales, and per-query normalisation is fragile",
            "Ranks are more accurate",
            "It's required by vector databases",
          ],
          answer: 1,
          why: "BM25 returns unbounded scores whose distribution varies per query; cosine returns a bounded range. Normalising them to be comparable is where the bugs and the per-query calibration live. Rank position is scale-free, so RRF works robustly with a single hyperparameter.",
        },
        {
          q: "Why can't you rerank the whole corpus with a cross-encoder?",
          options: [
            "Cross-encoders have a document limit",
            "It requires a forward pass per query-document pair, so cost scales linearly with corpus size",
            "They only work on short text",
            "The scores aren't comparable",
          ],
          answer: 1,
          why: "A bi-encoder embeds documents once, offline, and search is a cheap vector comparison. A cross-encoder must run the model on every query-document pair at query time. Over a million documents that's a million forward passes per query — hence retrieve-then-rerank.",
        },
        {
          q: "What does an absolute reranker score floor give you?",
          options: [
            "Faster retrieval",
            "The ability to return zero results when nothing relevant exists, enabling honest abstention",
            "Better recall",
            "Lower token cost",
          ],
          answer: 1,
          why: "Top-k always returns k results, however irrelevant. Thresholding on absolute score means an off-corpus question yields nothing, and your generation prompt can correctly say 'not documented' instead of answering confidently from the least-irrelevant chunk.",
        },
        {
          q: "A user asks 'and what about Enterprise?' as a follow-up. Retrieval returns nothing useful. Why?",
          options: [
            "The corpus lacks Enterprise documentation",
            "The fragment was embedded without resolving it against conversation history",
            "The reranker threshold is too high",
            "The embedding model is too small",
          ],
          answer: 1,
          why: "'and what about Enterprise?' carries almost no retrievable signal on its own. Query rewriting must expand it against history into something like 'What are the webhook rate limits for the Enterprise plan?' before embedding. Skipping this step is the most common bug in multi-turn RAG.",
        },
      ],
      cards: [
        {
          f: "Why is hybrid search better than dense alone?",
          b: "Their failure modes are complementary. BM25 nails exact identifiers and rare terms; dense handles paraphrase and synonyms. Fusing them beats either reliably across corpora.",
        },
        {
          f: "What is RRF and why use it?",
          b: "Reciprocal Rank Fusion: score = sum of w/(k + rank) across lists, k≈60. Uses only rank position so it needs no score normalisation between incomparable scales. One hyperparameter, robust, boringly effective.",
        },
        {
          f: "Why retrieve 50 then rerank rather than reranking everything?",
          b: "Cross-encoders need a forward pass per query-document pair — linear in corpus size. Retrieve broadly and cheaply with a bi-encoder for recall; rerank a small candidate set for precision. Gains flatten past ~50 candidates.",
        },
        {
          f: "What does a reranker score floor enable?",
          b: "Genuine abstention. Top-k always returns k results however irrelevant; an absolute threshold returns nothing when nothing is relevant, letting generation honestly say 'not documented'.",
        },
      ],
      resources: [
        {
          title: "Reciprocal Rank Fusion paper",
          url: "https://plg.uwaterloo.ca/~gvcormac/cormacksigir09-rrf.pdf",
          kind: "paper",
        },
        {
          title: "Cohere Rerank",
          url: "https://docs.cohere.com/docs/rerank-overview",
          kind: "docs",
        },
        {
          title: "BM25 explained",
          url: "https://en.wikipedia.org/wiki/Okapi_BM25",
          kind: "article",
        },
      ],
    },

    /* ------------------------------------------------------ */
    {
      id: "rag-architecture",
      phase: "retrieval",
      title: "RAG End to End",
      subtitle:
        "The full pipeline assembled: ingestion, retrieval, generation, and citation — plus the design decisions at each stage that determine whether it works.",
      minutes: 26,
      difficulty: "intermediate",
      tags: ["rag", "architecture"],
      lab: "ragpipeline",
      objectives: [
        "Assemble a complete RAG pipeline with each stage justified",
        "Enforce grounding with verifiable citations",
        "Build an honest 'not in the corpus' path",
      ],
      body: [
        {
          t: "p",
          text: "RAG has two pipelines with very different characteristics: **ingestion**, which runs offline and can be slow and expensive, and **query**, which runs in the request path under a latency budget. Most quality comes from ingestion; most engineering attention goes to query. That imbalance is a mistake.",
        },
        { t: "lab", id: "ragpipeline" },

        { t: "h", text: "Ingestion" },
        {
          t: "p",
          text: "Time to assemble the pieces. The last four chapters each covered one component; this one is the system they belong to, and the first thing to notice is that it isn't one pipeline but two — with different failure modes, different latency budgets, and different people paged when they break.",
        },
        {
          t: "p",
          text: "Ingestion runs offline, which makes it forgiving of slowness and unforgiving of mistakes: an error here is baked into every answer until you reindex.",
        },
        {
          t: "steps",
          items: [
            {
              title: "Fetch and detect change",
              text: "Hash the source content. Skip unchanged documents — re-embedding an unchanged corpus nightly is a pure waste of money.",
            },
            {
              title: "Parse to Markdown",
              text: "Layout-aware for PDFs, structure-preserving for HTML. Keep heading hierarchy and tables intact.",
            },
            {
              title: "Clean",
              text: "Strip navigation, footers, cookie banners. Boilerplate pollutes embeddings and wastes tokens on every retrieval.",
            },
            {
              title: "Chunk structurally",
              text: "Split on the document's own boundaries, with parent-child linkage.",
            },
            {
              title: "Enrich contextually",
              text: "Prepend a generated situating sentence. The highest-return step in the whole pipeline.",
            },
            {
              title: "Embed in batches",
              text: "128–256 per request. Record the model name and version on every vector.",
            },
            {
              title: "Index vectors and text",
              text: "Both the ANN index and the lexical index, in one transaction if your store allows it.",
            },
            {
              title: "Validate",
              text: "Run your eval set against the new index *before* promoting it. Ingestion bugs are silent otherwise.",
            },
          ],
        },
        {
          t: "note",
          kind: "pro",
          title: "Version your index",
          text: "Ingest into a new index or a versioned namespace, run your eval suite against it, and only then flip the read pointer. This makes a bad ingestion instantly reversible instead of a corpus-wide outage. It's the same discipline as blue-green deployment, applied to your knowledge base.",
        },

        { t: "h", text: "Query" },
        {
          t: "p",
          text: "The query path is the opposite — every millisecond is user-visible, and every stage is one you can skip when the budget is tight. Read this against the latency table from **Hybrid Search & Reranking**.",
        },
        {
          t: "code",
          lang: "python",
          caption: "The whole query path",
          code: `async def answer(question: str, history: list, tenant: str) -> Answer:
    # 1. Rewrite against history. Non-optional for multi-turn.
    standalone = await rewrite_query(question, history)

    # 2. Decide whether retrieval is even needed. "Thanks!" and
    #    "summarise what you just said" do not need a corpus hit.
    if not await needs_retrieval(standalone):
        return await direct_answer(question, history)

    # 3. Hybrid retrieve, then rerank, then threshold.
    chunks = await retrieve(standalone, tenant, final_k=5)

    # 4. Honest abstention. This branch is the difference between
    #    a trustworthy system and a plausible one.
    if not chunks:
        return Answer(
            status="insufficient_context",
            text="I couldn't find anything in the documentation about "
                 "that. Would you like me to open a ticket?",
            citations=[],
        )

    # 5. Generate with a grounding contract.
    result = await generate(standalone, chunks, history)

    # 6. Verify citations point at chunks that were actually supplied.
    valid_ids = {c.id for c in chunks}
    if not set(result.citations) <= valid_ids:
        metrics.incr("rag.fabricated_citation")
        result = await regenerate_with_stricter_prompt(
            standalone, chunks, history,
        )

    return result`,
        },

        { t: "h", text: "The generation prompt" },
        {
          t: "p",
          text: "Retrieval hands the model a set of chunks. What you say around them decides whether the model treats them as the source of truth or as suggestions, and this prompt is where grounding is either enforced or quietly optional.",
        },
        {
          t: "code",
          lang: "text",
          caption: "A grounding contract, not a suggestion",
          code: `You answer questions using ONLY the sources in <sources>.

Rules
1. Every factual claim must cite its source id, like [doc-3].
2. If <sources> does not contain the answer, set status to
   "insufficient_context" and say what information would be needed.
   This is a correct outcome. Do not fill the gap from prior knowledge.
3. If sources conflict, say so and cite both. Prefer the one with the
   more recent updated_at, and state that you did.
4. Quote verbatim for definitions, prices, limits, and policy text.
5. Never cite a source id that does not appear in <sources>.

<sources>
  <source id="doc-3" title="Webhook limits" updated="2026-03-11">
    Free tier: 100 webhook deliveries per day. Pro: 10,000/day.
  </source>
  <source id="doc-9" title="Rate limits (deprecated)" updated="2024-08-02">
    Webhook deliveries are capped at 500/day on all plans.
  </source>
</sources>

Question: What is the webhook limit on the free plan?`,
        },
        {
          t: "note",
          kind: "insight",
          title: "Rule 3 handles the case everyone forgets",
          text: "Real corpora contain contradictions — a deprecated page and a current one, a regional exception, a policy that changed. Without explicit conflict-handling instructions and updated_at metadata in the prompt, the model silently picks one, often the wrong one, with no signal to you. Surfacing conflicts also turns your RAG system into a corpus-quality reporting tool.",
        },

        { t: "h", text: "Citations that mean something" },
        {
          t: "p",
          text: "Grounding the answer is half of trustworthiness. The other half is letting the user check it, and most citation implementations are decorative — a link that doesn't point at the span the sentence came from can't be verified, which makes it worse than none.",
        },
        {
          t: "list",
          items: [
            "**Verify every citation** against the supplied chunk IDs. A fabricated citation is worse than none, because it manufactures false confidence.",
            "**Prefer span-level citations.** Quoted text you can locate in the source is verifiable; a document-level citation is a gesture. Some providers offer native citation modes that return character offsets — use them where available.",
            "**Show sources in the UI before the answer streams.** They're available immediately and let users start evaluating credibility while the answer generates.",
            "**Log citation coverage** — the fraction of claims that carry a citation. It's one of the best single health metrics for a RAG system, and it degrades visibly when something upstream breaks.",
          ],
        },

        {
          t: "p",
          text: 'Finally, the judgement call. RAG is the default answer to "make the model use our data", and for a large class of questions it is structurally incapable of being right.',
        },
        { t: "h", text: "When RAG is the wrong tool" },
        {
          t: "table",
          head: ["Requirement", "Better approach"],
          rows: [
            [
              "Aggregate over a whole corpus ('how many tickets mention X?')",
              "SQL or a search index with aggregation. Retrieval samples; it doesn't count.",
            ],
            [
              "Precise numeric or temporal filtering",
              "A structured query. Embeddings cannot compare numbers.",
            ],
            [
              "Small, stable knowledge that fits in the window",
              "Just put it in the prompt and cache it. No retrieval infrastructure needed.",
            ],
            [
              "Consistent tone, format, or domain style",
              "Fine-tuning. RAG injects facts, not behaviour.",
            ],
            [
              "Reasoning across many documents at once",
              "Agentic retrieval with iterative search, or a graph-based approach.",
            ],
            [
              "Truly real-time data (prices, availability)",
              "A tool call to the live API. Never a vector index.",
            ],
          ],
        },
        {
          t: "note",
          kind: "pitfall",
          title: "The aggregation trap",
          text: "'How many customers asked about SSO last quarter?' cannot be answered by retrieving five chunks — retrieval returns a sample, and the model will confidently state a number derived from that sample. Route counting and aggregation questions to SQL. Detecting this class of question and refusing to answer it from retrieval is a genuine design requirement, not an edge case.",
        },

        {
          t: "check",
          key: "ra-1",
          q: "Your RAG system answers a question about a policy that changed last year, using the outdated document. Both versions are indexed. Best fix?",
          options: [
            "Delete the old document",
            "Add updated_at to chunk metadata, include it in the prompt, and instruct the model to prefer recency and surface conflicts",
            "Increase the number of retrieved chunks",
            "Use a larger model",
          ],
          answer: 1,
          why: "Deleting history destroys an audit trail you may need and doesn't generalise to the next conflict. Giving the model timestamps and an explicit recency rule handles the whole class of problem, and requiring it to surface the conflict tells you your corpus needs cleaning. More chunks makes the contradiction more likely, not less.",
        },
      ],
      takeaways: [
        "Most RAG quality comes from ingestion, where engineering attention usually doesn't go.",
        "Version your index: ingest to a new namespace, eval it, then flip the read pointer.",
        "Query rewriting and a needs-retrieval check both belong before retrieval runs.",
        "Verify every citation against supplied chunk IDs; log citation coverage as a health metric.",
        "Include updated_at in the prompt with explicit recency and conflict-surfacing rules.",
      ],
      quiz: [
        {
          q: "Why version your retrieval index?",
          options: [
            "For compliance",
            "So a bad ingestion is reversible by flipping a read pointer instead of becoming a corpus-wide outage",
            "To support multiple embedding models",
            "For faster search",
          ],
          answer: 1,
          why: "Ingestion bugs are silent — a parser change or chunking regression corrupts the corpus without erroring. Ingesting to a new namespace, running evals against it, and only then switching reads gives you the same safety blue-green deployment gives application code.",
        },
        {
          q: "Why check whether retrieval is needed before retrieving?",
          options: [
            "To reduce cost only",
            "Many turns don't need the corpus — retrieval adds latency and can inject irrelevant chunks that degrade the answer",
            "Retrieval always helps",
            "To avoid rate limits",
          ],
          answer: 1,
          why: "'Thanks, that's helpful' or 'summarise what you just told me' need no corpus lookup. Retrieving anyway costs 200ms and injects chunks whose irrelevance can pull the answer off course. The cost saving is real but the quality effect is the stronger reason.",
        },
        {
          q: "A user asks 'how many support tickets mention SSO?'. What should the system do?",
          options: [
            "Retrieve SSO chunks and count them",
            "Recognise this as an aggregation query and route it to SQL, or decline",
            "Retrieve more chunks for a better count",
            "Ask the model to estimate",
          ],
          answer: 1,
          why: "Retrieval returns a relevance-ranked sample, not a complete set. Counting retrieved chunks produces a number that looks authoritative and is arbitrary. Aggregation needs a structured query over the whole dataset. Detecting and routing this question class is a design requirement.",
        },
        {
          q: "Why include `updated_at` in the sources you pass to the model?",
          options: [
            "For citation formatting",
            "So it can prefer recent sources and explicitly surface conflicts between document versions",
            "To reduce token usage",
            "It's required for grounding",
          ],
          answer: 1,
          why: "Real corpora contain deprecated pages alongside current ones. Without timestamps and a recency rule the model picks silently, often wrongly, with no signal to you. With them, it prefers current information and reports the conflict — which also tells you what to clean up.",
        },
      ],
      cards: [
        {
          f: "What are the eight ingestion stages?",
          b: "Fetch + change detection → parse to Markdown → clean boilerplate → chunk structurally with parent-child → contextual enrichment → batch embed with version tag → index vectors + lexical → validate against evals before promoting.",
        },
        {
          f: "What two checks belong before retrieval in the query path?",
          b: "1) Query rewriting against conversation history (mandatory for multi-turn). 2) A needs-retrieval check — many turns don't require a corpus hit and retrieval can inject noise.",
        },
        {
          f: "Name three cases where RAG is the wrong tool.",
          b: "Aggregation/counting (use SQL — retrieval samples, it doesn't count), precise numeric/temporal filtering (structured query), consistent tone or format (fine-tuning — RAG injects facts, not behaviour), real-time data (live API tool call).",
        },
        {
          f: "Why does the generation prompt need a conflict rule?",
          b: "Real corpora contain contradictions (deprecated vs current pages). Without updated_at metadata plus explicit recency and conflict-surfacing instructions, the model picks silently and often wrongly.",
        },
      ],
      resources: [
        {
          title: "Anthropic — Citations",
          url: "https://docs.anthropic.com/en/docs/build-with-claude/citations",
          kind: "docs",
        },
        {
          title: "LlamaIndex — RAG patterns",
          url: "https://docs.llamaindex.ai/en/stable/",
          kind: "docs",
        },
      ],
    },

    /* ------------------------------------------------------ */
    {
      id: "advanced-rag",
      phase: "retrieval",
      title: "Advanced RAG Patterns",
      subtitle:
        "Techniques for when the basic pipeline plateaus. Each buys real quality and costs real latency — adopt them on evidence, one at a time.",
      minutes: 22,
      difficulty: "advanced",
      tags: ["rag", "advanced"],
      objectives: [
        "Match an advanced pattern to the failure it addresses",
        "Weigh each pattern's latency and cost against its gain",
        "Recognise when a corpus needs a graph rather than a vector index",
      ],
      body: [
        {
          t: "p",
          text: "Every technique here addresses a specific failure. Adopting them speculatively produces a slow, expensive pipeline with no measurable improvement. Diagnose first — the next chapter is entirely about that.",
        },

        { t: "h", text: "Query-side patterns" },
        {
          t: "p",
          text: "Read this chapter as a menu rather than a checklist. Each technique fixes a named failure, and each costs latency, money, or both — so the right move is to diagnose first with the previous chapter's procedure and then pick the one technique that addresses what you actually found.",
        },
        {
          t: "p",
          text: "The cheapest interventions act on the query before retrieval runs, because they don't change your index or your pipeline shape.",
        },
        {
          t: "table",
          head: ["Pattern", "Fixes", "Cost"],
          rows: [
            [
              "**Query rewriting**",
              "Follow-ups with pronouns and elisions retrieving nothing",
              "1 small model call — always worth it",
            ],
            [
              "**Multi-query expansion**",
              "Vague queries with low recall",
              "N× retrieval, 1 model call",
            ],
            [
              "**HyDE**",
              "Short queries failing to match verbose documents",
              "1 model call, ~300ms",
            ],
            [
              "**Decomposition**",
              "Compound questions answered only partially",
              "1 call + N retrievals",
            ],
            [
              "**Step-back prompting**",
              "Overly specific queries missing the conceptual source",
              "1 call, fused retrieval",
            ],
            [
              "**Routing**",
              "One corpus queried when several exist",
              "1 small classification call",
            ],
          ],
        },
        {
          t: "code",
          lang: "python",
          caption: "HyDE and decomposition",
          code: `# --- HyDE: retrieve using a hypothetical answer's embedding ---
# Rationale: a generated answer shares vocabulary and register with
# the real documents far more than a terse question does.
async def hyde_retrieve(query: str, tenant: str, k: int = 20):
    hypothetical = await call_model(
        f"Write a short factual paragraph that would answer this "
        f"question, as if excerpted from documentation. Do not "
        f"hedge or say you are unsure.\\n\\nQuestion: {query}",
        max_tokens=180, temperature=0.3,
    )
    # Fuse both signals rather than replacing the original query.
    real, hyp = await asyncio.gather(
        vector_search(query, tenant, k),
        vector_search(hypothetical, tenant, k),
    )
    return rrf([real, hyp], weights=[1.0, 0.9])


# --- Decomposition: compound questions need multiple retrievals ---
class SubQueries(BaseModel):
    needs_decomposition: bool
    sub_queries: list[str] = Field(max_length=4)

async def decompose_retrieve(query: str, tenant: str):
    plan = await call_model_structured(
        "Split this into independent sub-questions ONLY if it asks "
        "about multiple distinct things. Otherwise set "
        "needs_decomposition to false.",
        query, schema=SubQueries,
    )
    if not plan.needs_decomposition:
        return await retrieve(query, tenant)

    results = await asyncio.gather(*[
        retrieve(sq, tenant, final_k=3) for sq in plan.sub_queries
    ])
    return dedupe_by_id([c for group in results for c in group])`,
        },
        {
          t: "note",
          kind: "warn",
          title: "Guard every expansion behind a decision",
          text: "Always-on multi-query or HyDE means every trivial lookup pays for extra model calls and retrievals. Gate them: a cheap classifier decides whether the query is vague, compound, or terse enough to warrant the extra work. Unconditional expansion is how RAG pipelines end up with a 4-second p95 and no measurable quality gain.",
        },

        { t: "h", text: "Agentic RAG" },
        {
          t: "p",
          text: "The patterns above all keep the pipeline fixed and vary the query. The next step is to stop fixing the pipeline — let the model decide how many searches to run and when it has enough.",
        },
        {
          t: "p",
          text: "Instead of a fixed retrieve-then-generate pipeline, give the model a `search` tool and let it decide: whether to search, what to search for, whether the results suffice, and whether to search again. It's the highest-ceiling and highest-cost pattern here.",
        },
        {
          t: "compare",
          left: {
            title: "Worth it when",
            kind: "good",
            items: [
              "Questions genuinely need multi-hop retrieval",
              "One-shot retrieval measurably fails on your eval set",
              "Users tolerate 5–20 seconds with progress shown",
              "The corpus spans multiple stores needing different queries",
            ],
          },
          right: {
            title: "Not worth it when",
            kind: "bad",
            items: [
              "Single-hop retrieval already scores well",
              "Latency budget is under 2 seconds",
              "Cost per query matters (3–10× single-shot)",
              "You haven't measured that one-shot is the bottleneck",
            ],
          },
        },
        {
          t: "note",
          kind: "insight",
          title: "The self-correction step is where the value is",
          text: "The real gain from agentic RAG isn't multi-hop — it's the model evaluating its own retrieval and searching again with a better query when the first attempt fails. You can get most of that benefit far more cheaply with a single non-agentic 'is this sufficient?' check plus one retry, which costs one extra call rather than an unbounded loop.",
        },

        {
          t: "check",
          key: "arag-mid",
          q: 'Your RAG answers single-fact questions well but fails on "compare the free and enterprise tiers on SSO". What is the cheapest thing to try?',
          options: [
            "Build a knowledge graph so the model can traverse tier relationships",
            "Decompose the question into sub-queries and retrieve for each",
            "Increase the number of chunks passed to the model",
          ],
          answer: 1,
          why: "The question needs two separate retrievals — one per tier — and a single embedding of the whole question retrieves a blurry average of both. Decomposition is a prompt and a loop; GraphRAG is an ingestion pipeline, an extraction cost and a new store. Try the cheap structural fix before the expensive one, and only escalate if it genuinely fails.",
        },
        { t: "h", text: "GraphRAG" },
        {
          t: "p",
          text: "Agentic retrieval handles questions needing several searches. It still struggles with questions requiring you to *traverse* relationships — and that is a different data structure, not a different loop.",
        },
        {
          t: "p",
          text: "Build a knowledge graph of entities and relationships during ingestion, then traverse it at query time. It answers questions vector search structurally cannot: 'who else worked on projects with the people who reported this bug?'",
        },
        {
          t: "flow",
          nodes: [
            { b: "Extract", s: "entities + relations", c: "accent" },
            { b: "Build graph", s: "nodes + edges" },
            { b: "Community detect", s: "cluster + summarise", c: "cyan" },
            { b: "Traverse", s: "multi-hop query", c: "emerald" },
          ],
          cap: "GraphRAG excels at relationship and global-summary questions, and costs substantially more to ingest.",
        },
        {
          t: "table",
          head: ["Question type", "Vector RAG", "GraphRAG"],
          rows: [
            ["'What is the refund policy?'", "Excellent", "Overkill"],
            ["'How are A and B connected?'", "Poor", "Excellent"],
            [
              "'Summarise the main themes across all incidents'",
              "Poor — samples only",
              "Excellent — community summaries",
            ],
            ["'Who depends on this deprecated service?'", "Poor", "Excellent"],
            ["Cost to ingest", "Low", "High — entity extraction per chunk"],
          ],
        },
        {
          t: "note",
          kind: "pitfall",
          title: "GraphRAG is expensive and often unnecessary",
          text: "Entity and relationship extraction means one or more model calls per chunk at ingestion, plus graph storage and maintenance. It's genuinely the right answer for relationship-heavy corpora — codebases, org data, incident histories, legal entity networks. For a documentation Q&A bot it's an expensive way to solve a problem you don't have. Confirm the question types you actually receive before building one.",
        },

        { t: "h", text: "Cheaper patterns worth knowing" },
        {
          t: "p",
          text: "Before reaching for any of that, exhaust the boring options. Several of the most effective upgrades in this chapter are a few lines of code and no new infrastructure.",
        },
        {
          t: "list",
          items: [
            "**Corrective RAG.** Grade retrieved chunks for relevance before generating; if they fail, rewrite the query and retry once, or fall back to a web search. Cheap and effective.",
            "**Self-RAG.** The model emits reflection tokens deciding whether to retrieve and whether its output is supported. Powerful, but needs a model trained or prompted for it.",
            "**Sentence-window retrieval.** Index individual sentences for precision, return the surrounding N sentences for context. Parent-child at finer granularity — very good for dense reference material.",
            "**Fusion across sources.** Retrieve from docs, tickets, code, and chat, then fuse with RRF and per-source weights. Often better than picking one source per query.",
            "**Recency-weighted scoring.** Multiply relevance by a time-decay factor. A three-line change that fixes a large share of stale-answer complaints.",
          ],
        },

        {
          t: "check",
          key: "arag-1",
          q: "Your RAG handles single-fact questions well but fails on 'compare the free and enterprise tiers on rate limits, SSO, and support SLA'. Cheapest effective fix?",
          options: [
            "Switch to agentic RAG with an unbounded search loop",
            "Add query decomposition: split into sub-questions, retrieve for each, merge",
            "Build a knowledge graph",
            "Increase top-k to 30",
          ],
          answer: 1,
          why: "This is a compound question, and one embedding of the whole thing retrieves a blurry average of six distinct topics. Decomposition costs one classification call plus parallel retrievals and directly addresses the failure. Agentic RAG would also work at several times the cost and latency; a graph solves a different problem; and raising top-k just adds noise while making context rot worse.",
        },
      ],
      takeaways: [
        "Every advanced pattern fixes a specific failure — diagnose before adopting.",
        "Gate query expansion behind a cheap classifier; unconditional expansion inflates latency for no gain.",
        "Agentic RAG's real value is self-correcting retrieval; a single sufficiency check plus one retry captures most of it.",
        "GraphRAG wins on relationship and global-summary questions and costs far more to ingest.",
        "Recency-weighted scoring is a three-line change that fixes many stale-answer complaints.",
      ],
      quiz: [
        {
          q: "What failure does HyDE address?",
          options: [
            "Slow retrieval",
            "Short terse queries failing to match verbose documents, because a generated answer shares more vocabulary with the corpus",
            "Duplicate chunks",
            "Stale documents",
          ],
          answer: 1,
          why: "A five-word question and a 400-word documentation passage have quite different lexical and stylistic profiles even when topically matched. Embedding a generated hypothetical answer produces a vector much closer to how real documents are written, improving the match.",
        },
        {
          q: "Where does most of agentic RAG's benefit actually come from?",
          options: [
            "Multi-hop reasoning",
            "The model evaluating its own retrieval and searching again with a better query",
            "Parallel search",
            "Larger context windows",
          ],
          answer: 1,
          why: "Self-correction is the high-value behaviour — recognising bad results and reformulating. That's obtainable much more cheaply: one 'is this sufficient?' check plus a single retry, at the cost of one extra call rather than an unbounded loop.",
        },
        {
          q: "Which question type genuinely requires GraphRAG?",
          options: [
            "What is our refund policy?",
            "Which teams depend on services that this deprecated API touches?",
            "How do I reset my password?",
            "What are the rate limits?",
          ],
          answer: 1,
          why: "That's a multi-hop relationship traversal — services touching an API, then teams depending on those services. Vector search retrieves topically similar chunks and cannot follow edges. The others are single-fact lookups where a vector index is both sufficient and far cheaper.",
        },
        {
          q: "Why gate query expansion behind a classifier?",
          options: [
            "Classifiers are more accurate",
            "Unconditional expansion makes every trivial query pay for extra model calls and retrievals",
            "Expansion breaks caching",
            "It's required by RRF",
          ],
          answer: 1,
          why: "Most queries are simple and single-topic. Running HyDE and multi-query on all of them adds hundreds of milliseconds and several model calls per request for zero benefit on the majority. A cheap classifier routes only vague, terse, or compound queries into the expensive path.",
        },
      ],
      cards: [
        {
          f: "Match pattern to failure: query rewriting, HyDE, decomposition.",
          b: "Rewriting → follow-ups with pronouns retrieving nothing (always worth it). HyDE → short queries vs verbose docs. Decomposition → compound questions answered only partially.",
        },
        {
          f: "When is agentic RAG worth 3–10× the cost?",
          b: "When one-shot retrieval measurably fails on your eval set, questions genuinely need multi-hop, and users tolerate 5–20s with visible progress. Otherwise a sufficiency check + one retry captures most of the gain.",
        },
        {
          f: "When does GraphRAG justify its ingestion cost?",
          b: "Relationship traversal ('who depends on X?') and global summarisation across a corpus. Right for codebases, org data, incident histories. Overkill for documentation Q&A.",
        },
        {
          f: "What is corrective RAG?",
          b: "Grade retrieved chunks for relevance before generating; if they fail the bar, rewrite the query and retry once or fall back to another source. Cheap, effective, and non-agentic.",
        },
      ],
      resources: [
        {
          title: "HyDE paper",
          url: "https://arxiv.org/abs/2212.10496",
          kind: "paper",
        },
        {
          title: "Microsoft GraphRAG",
          url: "https://microsoft.github.io/graphrag/",
          kind: "docs",
        },
        {
          title: "Self-RAG paper",
          url: "https://arxiv.org/abs/2310.11511",
          kind: "paper",
        },
      ],
    },

    /* ------------------------------------------------------ */
    {
      id: "rag-debug",
      phase: "retrieval",
      title: "Diagnosing a Broken RAG System",
      subtitle:
        "'The answers are bad' is not a diagnosis. Here is the decision procedure that localises the fault to one stage in about twenty minutes.",
      minutes: 20,
      difficulty: "advanced",
      tags: ["debugging", "rag", "evals"],
      objectives: [
        "Localise a RAG failure to ingestion, retrieval, ranking, or generation",
        "Measure recall@k and use it as your primary diagnostic",
        "Apply the standard fix for each localised failure",
      ],
      body: [
        {
          t: "p",
          text: "A RAG pipeline has four places to fail, and they need completely different fixes. Diagnosing in order saves days.",
        },
        {
          t: "flow",
          nodes: [
            { b: "Ingestion", s: "is it indexed?", c: "accent" },
            { b: "Retrieval", s: "in the top 50?", c: "cyan" },
            { b: "Ranking", s: "in the top 5?", c: "amber" },
            { b: "Generation", s: "used correctly?", c: "emerald" },
          ],
          cap: "Test in this order. Each stage's failure looks identical from the outside — and each has a different fix.",
        },

        { t: "h", text: "The procedure" },
        {
          t: "p",
          text: 'This is the most practically useful chapter in the phase, and the reason is narrow: "RAG isn\'t working" is not a diagnosis, and every fix for one of the four failures is useless against the other three. Teams burn weeks tuning chunk size when their problem was a reranker cutoff.',
        },
        {
          t: "p",
          text: "The procedure below isolates one stage at a time. Run it in order and stop at the first stage that fails — later stages inherit earlier failures, so their numbers mean nothing until the earlier ones are clean.",
        },
        {
          t: "steps",
          items: [
            {
              title: "Step 0 — Build a 30-question set",
              text: "Real questions, with the chunk ID that should answer each one. This is 90 minutes of work and it makes everything below measurable rather than speculative. There is no shortcut.",
            },
            {
              title: "Step 1 — Is the answer even in the index?",
              text: "Search your chunk store for the answer text directly, by keyword, ignoring vectors. If it isn't there, this is an ingestion bug: a parser dropped it, chunking split it, or the document never synced. No amount of retrieval tuning will help.",
            },
            {
              title: "Step 2 — Measure recall@50",
              text: "Does the correct chunk appear anywhere in your top 50? If not, retrieval is the problem — embedding model, chunking, or missing lexical search. If yes, retrieval is fine and you have a ranking problem.",
            },
            {
              title: "Step 3 — Measure recall@5",
              text: "Recall@50 high but recall@5 low is the single most common diagnosis, and the fix is a reranker. This is where most 'RAG doesn't work' complaints actually live.",
            },
            {
              title: "Step 4 — Feed the correct chunk manually",
              text: "Put the right chunk in the prompt by hand. If the answer is still wrong, it's a generation problem — prompt, model, or a conflicting chunk crowding it out. If the answer is now right, everything upstream is your bottleneck.",
            },
          ],
        },
        {
          t: "code",
          lang: "python",
          caption: "The diagnostic script worth writing once",
          code: `import statistics

CASES = [
    {"q": "What is the webhook limit on the free plan?",
     "gold_chunk_ids": ["acme-api#webhooks#3"]},
    # ... 29 more
]

async def diagnose():
    r50, r5, generation_ok = [], [], []

    for case in CASES:
        gold = set(case["gold_chunk_ids"])

        # --- retrieval stage, before reranking ---
        fused = await hybrid_search(case["q"], tenant="acme", n=50)
        ids50 = [doc_id for doc_id, _ in fused]
        r50.append(1.0 if gold & set(ids50) else 0.0)

        # --- ranking stage, after reranking ---
        top5 = await retrieve(case["q"], tenant="acme", final_k=5)
        r5.append(1.0 if gold & {c.id for c in top5} else 0.0)

        # --- generation stage, with retrieval held perfect ---
        forced = await load_chunks(list(gold))
        ans = await generate(case["q"], forced, history=[])
        generation_ok.append(await judge_correct(case["q"], ans))

    print(f"recall@50      {statistics.mean(r50):.0%}")
    print(f"recall@5       {statistics.mean(r5):.0%}")
    print(f"gen w/ perfect {statistics.mean(generation_ok):.0%}")

# Read the output like this:
#   recall@50 low                 -> retrieval / chunking / embeddings
#   recall@50 high, recall@5 low   -> ADD A RERANKER
#   both high, generation low      -> prompt or model
#   all high, users still complain -> your eval set is unrepresentative`,
        },
        {
          t: "note",
          kind: "insight",
          title: "The last line is the one that catches people",
          text: "If every metric looks good and users still complain, your eval set doesn't reflect real usage. Pull 50 actual queries from production logs — especially ones where users rephrased or abandoned — and add them. Eval sets built from imagined questions are systematically easier than reality.",
        },

        {
          t: "p",
          text: "The last assertion in that script is the one people skip, and it is the most informative: feed the generation step perfect context by hand. If the answer is still wrong, no amount of retrieval tuning will help you, and you have a prompting or model-capacity problem wearing a retrieval costume.",
        },
        {
          t: "check",
          key: "rdbg-mid",
          q: "Diagnostics show recall@50 = 96% but recall@5 = 41%. Which stage is broken?",
          options: [
            "Ingestion — the right chunks aren't indexed",
            "Ranking — the right chunks are retrieved but not ranked into the top 5",
            "Generation — the model isn't using the context it was given",
          ],
          answer: 1,
          why: "Recall@50 at 96% proves the relevant chunks are indexed and retrievable, so ingestion is fine. They are just buried below rank 5, which is a pure ordering problem — exactly what a reranker fixes. Note how the two numbers together isolate the stage: neither is informative alone, which is why the procedure measures at several cut-offs.",
        },
        { t: "h", text: "Symptom to cause" },
        {
          t: "p",
          text: "Once you have run the script you'll have numbers. This table maps what you observed to where the problem is, and it is the fastest route from a user complaint to the right stage.",
        },
        {
          t: "table",
          head: ["Symptom", "Likely cause", "Fix"],
          rows: [
            [
              "Answers cite the wrong document confidently",
              "Ranking — right chunk retrieved but not surfaced",
              "Add or tune a reranker",
            ],
            [
              "Answers are vague and hedge constantly",
              "Chunks too small or missing context",
              "Parent-child retrieval, contextual enrichment",
            ],
            [
              "Exact identifiers and error codes never found",
              "No lexical retrieval",
              "Add BM25, fuse with RRF",
            ],
            [
              "Follow-up questions retrieve nothing",
              "No query rewriting",
              "Rewrite against conversation history",
            ],
            [
              "Correct sometimes, wrong on the same question later",
              "Non-deterministic ranking, or contradictory chunks",
              "Pin sampling, deduplicate corpus, add recency weighting",
            ],
            [
              "Confidently answers off-corpus questions",
              "No abstention path, top-k always returns k",
              "Reranker score floor + abstention in the schema",
            ],
            [
              "Stale answers",
              "No recency signal",
              "Add updated_at to metadata and prompt, decay old scores",
            ],
            [
              "Good on short docs, bad on long ones",
              "Chunking ignores structure",
              "Structural splitting with heading paths",
            ],
            [
              "Latency spiked, quality unchanged",
              "Reranking too many candidates, or sequential I/O",
              "Cut candidates to ~50, parallelise independent calls",
            ],
          ],
        },

        { t: "h", text: "The metrics to track continuously" },
        {
          t: "p",
          text: "Diagnosing on demand is reactive. The same measurements tracked continuously turn into a regression alarm, and this is where retrieval work hands off to Phase 06 — these are the metrics your eval suite will gate on.",
        },
        {
          t: "list",
          items: [
            "**Recall@k** (k = 5, 20, 50) against a labelled set. Your primary retrieval health metric.",
            "**MRR / nDCG@10** — rank-sensitive quality. Catches ranking degradation that recall@50 hides.",
            "**Faithfulness** — is every claim supported by the retrieved context? The core RAG generation metric.",
            "**Citation coverage** — fraction of claims carrying a valid citation. Degrades visibly when anything upstream breaks.",
            "**Abstention rate** — should be non-zero. Exactly zero means your system never admits ignorance, which is a bug.",
            "**Retrieval latency p95** per stage, so you know which stage regressed.",
          ],
        },
        {
          t: "note",
          kind: "warn",
          title: "An abstention rate of zero is a red flag",
          text: "Some fraction of real questions cannot be answered from any corpus. If your abstention rate is 0%, your system is answering them anyway — confidently, from the least-irrelevant chunks it found. Track it, and expect something in the 3–15% range depending on how open-ended your traffic is.",
        },

        {
          t: "check",
          key: "rd-1",
          q: "Diagnostics show recall@50 = 96%, recall@5 = 41%, generation with perfect context = 93%. What do you build?",
          options: [
            "A better embedding model",
            "A cross-encoder reranker",
            "A better generation prompt",
            "Larger chunks",
          ],
          answer: 1,
          why: "The numbers localise the fault precisely. Retrieval finds the right chunk 96% of the time, so embeddings and chunking are fine. Generation works 93% of the time when given the right chunk, so the prompt is fine. The gap is entirely between rank 50 and rank 5 — a precision problem, which is exactly what a cross-encoder reranker fixes.",
        },
      ],
      takeaways: [
        "Test in order: ingestion, retrieval (recall@50), ranking (recall@5), generation (with perfect context).",
        "A 30-question labelled set takes 90 minutes and makes every subsequent decision measurable.",
        "High recall@50 with low recall@5 is the most common diagnosis, and a reranker is the fix.",
        "If all metrics look good but users complain, your eval set is unrepresentative — pull real queries.",
        "An abstention rate of exactly zero means your system never admits ignorance. That's a bug.",
      ],
      quiz: [
        {
          q: "Recall@50 is 45%. Where is the problem?",
          options: [
            "Ranking — add a reranker",
            "Retrieval or ingestion — chunking, embeddings, or missing lexical search",
            "Generation prompt",
            "The model is too small",
          ],
          answer: 1,
          why: "If the correct chunk isn't in the top 50, no amount of reranking can promote it — reranking only reorders what retrieval found. Look upstream: is it indexed at all, is chunking destroying it, is the embedding model wrong for the domain, is BM25 missing for identifier queries?",
        },
        {
          q: "How do you isolate a generation problem from a retrieval problem?",
          options: [
            "Compare two models",
            "Manually place the known-correct chunk in the prompt; if the answer is still wrong, generation is at fault",
            "Increase top-k",
            "Check latency",
          ],
          answer: 1,
          why: "Holding retrieval perfect removes it as a variable. A wrong answer given the correct context points at the prompt, the model, or a competing chunk. A right answer proves generation is fine and everything upstream is the bottleneck.",
        },
        {
          q: "Why is an abstention rate of 0% a problem?",
          options: [
            "It's not — it means high coverage",
            "Some real questions aren't answerable from any corpus; 0% means the system answers them confidently anyway",
            "It indicates a caching bug",
            "It means recall is too low",
          ],
          answer: 1,
          why: "Real traffic contains off-corpus and unanswerable questions. A system that never abstains is fabricating answers from the least-irrelevant chunks it happened to retrieve. Expect 3–15% abstention depending on how open-ended your traffic is.",
        },
        {
          q: "All your RAG metrics look good but users still complain. Most likely explanation?",
          options: [
            "The metrics are computed wrongly",
            "The eval set doesn't reflect real usage — imagined questions are systematically easier than real ones",
            "The model changed",
            "Users are wrong",
          ],
          answer: 1,
          why: "Hand-written eval questions tend to be well-formed, single-topic, and phrased using the corpus's own vocabulary. Real queries are terse, ambiguous, compound, and use the user's words. Pull 50 real queries from logs — prioritising ones where users rephrased or gave up — and re-measure.",
        },
      ],
      cards: [
        {
          f: "What's the four-stage RAG diagnostic order?",
          b: "1) Ingestion — is it indexed at all? 2) Retrieval — recall@50. 3) Ranking — recall@5. 4) Generation — feed the correct chunk manually. Each stage looks identical from outside and needs a different fix.",
        },
        {
          f: "recall@50 = 96%, recall@5 = 41% — diagnosis?",
          b: "A ranking problem. Retrieval finds the right chunk; it just isn't surfacing in the top 5. Add a cross-encoder reranker. This is the most common RAG diagnosis.",
        },
        {
          f: "How do you isolate generation from retrieval failures?",
          b: "Manually place the known-correct chunk in the prompt. Still wrong → generation (prompt/model/competing chunk). Now right → everything upstream is the bottleneck.",
        },
        {
          f: "Which six RAG metrics should you track continuously?",
          b: "recall@5/20/50, MRR or nDCG@10, faithfulness, citation coverage, abstention rate (must be non-zero), and per-stage p95 latency.",
        },
      ],
      resources: [
        {
          title: "RAGAS — RAG evaluation framework",
          url: "https://docs.ragas.io/",
          kind: "docs",
        },
        {
          title: "Jason Liu — Systematically improving RAG",
          url: "https://jxnl.co/writing/2024/08/19/rag-flywheel/",
          kind: "article",
        },
      ],
    }
  );
})(window);
