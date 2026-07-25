import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { loadModule } from "../../scripts/lib/load-curriculum.mjs";

const { U } = loadModule("js/core/util.js");

describe("escaping", () => {
  test("escapes HTML metacharacters", () => {
    assert.equal(U.esc('<script>&"'), "&lt;script&gt;&amp;&quot;");
  });

  test("handles null and undefined without throwing", () => {
    assert.equal(U.esc(null), "");
    assert.equal(U.esc(undefined), "");
  });
});

describe("inline markdown", () => {
  test("renders bold, em, code and links", () => {
    assert.match(U.md("**bold**"), /<strong>bold<\/strong>/);
    assert.match(U.md("a *slanted* word"), /<em>slanted<\/em>/);
    assert.match(U.md("`code`"), /<code>code<\/code>/);
    assert.match(
      U.md("[text](https://example.com)"),
      /href="https:\/\/example.com"/
    );
  });

  test("code span contents are not treated as markdown", () => {
    // **kwargs inside a code span must survive verbatim
    const out = U.md("call `f(**kwargs)` now");
    assert.match(out, /<code>f\(\*\*kwargs\)<\/code>/);
    assert.doesNotMatch(out, /<strong>/);
  });

  test("escapes HTML inside markdown text", () => {
    const out = U.md("a <b>tag</b> and **bold**");
    assert.match(out, /&lt;b&gt;/);
    assert.match(out, /<strong>bold<\/strong>/);
  });

  test("rejects javascript: URLs", () => {
    const out = U.md("[x](javascript:alert(1))");
    assert.doesNotMatch(out, /javascript:/);
    assert.match(out, /href="#"/);
  });

  test("opens external links safely", () => {
    const out = U.md("[x](https://example.com)");
    assert.match(out, /rel="noopener noreferrer"/);
  });
});

describe("syntax highlighting", () => {
  test("marks keywords, strings and comments", () => {
    const out = U.highlight('def f():\n    return "hi"  # note');
    assert.match(out, /class="sx-k"/);
    assert.match(out, /class="sx-s"/);
    assert.match(out, /class="sx-c"/);
  });

  test("escapes HTML so code cannot inject markup", () => {
    const out = U.highlight("x = a < b && c > d");
    assert.doesNotMatch(out, /<b>/);
    assert.match(out, /&lt;|&gt;/);
  });

  test("a # inside a string is not treated as a comment", () => {
    const out = U.highlight('x = "#notacomment"');
    // The whole quoted span should be one string token.
    assert.match(out, /class="sx-s"[^>]*>&quot;#notacomment&quot;/);
  });

  test("terminates on pathological input", () => {
    const out = U.highlight("`".repeat(500));
    assert.ok(out.length > 0);
  });
});

describe("tokenizer approximation", () => {
  test("splits prose into more tokens than words", () => {
    const text = "The quick brown fox jumps over the lazy dog";
    const toks = U.tokenize(text);
    assert.ok(toks.length >= text.split(" ").length);
  });

  test("fragments rare identifiers far more than prose", () => {
    const prose = U.tokenize(
      "the model returns a token for each word here now"
    );
    const ids = U.tokenize("ERR_TLS_CERT_ALTNAME_INVALID 3f2a1b4c9e7d4a1f");
    const proseRatio = 46 / prose.length;
    const idRatio = 41 / ids.length;
    assert.ok(
      idRatio < proseRatio,
      `identifiers should have fewer chars per token (${idRatio} vs ${proseRatio})`
    );
  });

  test("preserves newlines as their own tokens", () => {
    assert.ok(U.tokenize("a\nb").includes("\n"));
  });

  test("attaches a single leading space to the following word", () => {
    const toks = U.tokenize("hello world");
    assert.ok(toks.some((t) => t.startsWith(" ")));
  });

  test("handles empty input", () => {
    // Arrays created inside the vm realm have a different prototype, so
    // compare length rather than using cross-realm deep-strict equality.
    assert.equal(U.tokenize("").length, 0);
  });
});

describe("vector helpers", () => {
  test("cosine of identical vectors is 1", () => {
    assert.equal(U.cosine([1, 2, 3], [1, 2, 3]), 1);
  });

  test("cosine of orthogonal vectors is 0", () => {
    assert.equal(U.cosine([1, 0], [0, 1]), 0);
  });

  test("cosine handles a zero vector without NaN", () => {
    assert.equal(U.cosine([0, 0], [1, 1]), 0);
  });

  test("fakeEmbed is deterministic and unit length", () => {
    const a = U.fakeEmbed("hello world", 32);
    const b = U.fakeEmbed("hello world", 32);
    assert.deepEqual(a, b);
    const norm = Math.sqrt(a.reduce((s, x) => s + x * x, 0));
    assert.ok(Math.abs(norm - 1) < 1e-9, `expected unit norm, got ${norm}`);
  });

  test("fakeEmbed scores related text above unrelated", () => {
    const q = U.fakeEmbed("webhook delivery limits");
    const near = U.fakeEmbed("webhook deliveries are capped per day");
    const far = U.fakeEmbed("encryption at rest with AES");
    assert.ok(U.cosine(q, near) > U.cosine(q, far));
  });
});

describe("formatting", () => {
  test("compact abbreviates thousands and millions", () => {
    assert.equal(U.compact(950), "950");
    assert.equal(U.compact(1500), "1.5k");
    assert.equal(U.compact(2400000), "2.4M");
  });

  test("money scales precision to magnitude", () => {
    assert.equal(U.money(0), "$0");
    assert.equal(U.money(0.0001), "$0.0001");
    assert.equal(U.money(12.5), "$12.50");
    assert.equal(U.money(1500), "$1,500");
  });

  test("hours formats minutes readably", () => {
    assert.equal(U.hours(45), "45m");
    assert.equal(U.hours(60), "1h");
    assert.equal(U.hours(135), "2h 15m");
  });

  test("plural agrees with count", () => {
    assert.equal(U.plural(1, "chapter"), "1 chapter");
    assert.equal(U.plural(2, "chapter"), "2 chapters");
  });

  test("slug produces url-safe kebab case", () => {
    assert.equal(
      U.slug("Tokens, Context & the Economics"),
      "tokens-context-the-economics"
    );
  });
});

describe("dates", () => {
  test("daysBetween counts calendar days", () => {
    assert.equal(U.daysBetween("2026-01-01", "2026-01-02"), 1);
    assert.equal(U.daysBetween("2026-02-28", "2026-03-01"), 1); // 2026 is not a leap year
    assert.equal(U.daysBetween("2026-01-10", "2026-01-01"), -9);
  });

  test("shuffle is a permutation and deterministic for a seed", () => {
    const src = [1, 2, 3, 4, 5, 6, 7, 8];
    const a = U.shuffle(src, 42);
    const b = U.shuffle(src, 42);
    assert.deepEqual(a, b);
    assert.deepEqual([...a].sort(), [...src].sort());
    assert.deepEqual(src, [1, 2, 3, 4, 5, 6, 7, 8]); // no mutation
  });
});
