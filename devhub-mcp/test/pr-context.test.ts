/**
 * `get_pr_context`: single-PR bundle, section-level degradation, and the no-raw-diff rule.
 */

import { describe, expect, it } from 'vitest';
import { fitPrContext, getPrContext, prContextDescription, type PrContext } from '../src/tools/pr-context.js';
import { MAX_RESPONSE_CHARS, payloadChars } from '../src/lib/truncate.js';
import { createFakeContext } from './helpers/fakes.js';

function isContext(value: unknown): value is PrContext {
  return typeof value === 'object' && value !== null && 'repo' in value;
}

describe('get_pr_context', () => {
  it('assembles a bundle from one call', async () => {
    const { ctx } = createFakeContext();
    const result = await getPrContext(ctx, { scope: 'work', repo: 'acme/web', number: 7 });

    expect(isContext(result)).toBe(true);
    if (!isContext(result)) return;
    expect(result.repo).toBe('acme/web');
    expect(result.number).toBe(7);
    expect(result.changed_files).toBe(3);
    expect(result.ci).toEqual([{ name: 'build', conclusion: 'success' }]);
  });

  it('rejects a malformed repo without calling GitHub', async () => {
    const { ctx, work } = createFakeContext();
    const result = await getPrContext(ctx, { scope: 'work', repo: 'not-a-repo', number: 1 });

    expect(isContext(result)).toBe(false);
    expect(work.calls).toEqual([]);
  });

  it('never touches the personal client for a work-scoped PR', async () => {
    const { ctx, personal } = createFakeContext();
    await getPrContext(ctx, { scope: 'work', repo: 'acme/web', number: 7 });
    expect(personal.calls).toEqual([]);
  });

  it('suggests the other scope on a 404', async () => {
    const { ctx } = createFakeContext();
    const api = ctx.clients.github('work');
    Object.defineProperty(api.pulls, 'get', {
      value: async () => {
        throw Object.assign(new Error('Not Found'), { status: 404 });
      },
    });

    const result = await getPrContext(ctx, { scope: 'work', repo: 'acme/web', number: 7 });
    expect(isContext(result)).toBe(false);
    if (isContext(result)) return;
    const text = (result.content[0] as { text: string }).text;
    expect(result.isError).toBe(true);
    expect(text).toMatch(/retry with the other scope/);
  });

  it('keeps the other sections when one sub-request fails', async () => {
    const { ctx } = createFakeContext();
    const api = ctx.clients.github('work');
    Object.defineProperty(api.pulls, 'listReviewComments', {
      value: async () => {
        throw Object.assign(new Error('boom'), { status: 500 });
      },
    });

    const result = await getPrContext(ctx, { scope: 'work', repo: 'acme/web', number: 7 });
    expect(isContext(result)).toBe(true);
    if (!isContext(result)) return;

    // Comments are gone, but title/CI/files survived and the loss is disclosed.
    expect(result.recent_review_comments).toEqual([]);
    expect(result.notes?.join(' ')).toMatch(/Review comments unavailable/);
    expect(result.warnings?.[0]?.status).toBe(500);
    expect(result.title).toBe('Fix the thing');
  });

  it('skips the files request when diff stats are not wanted', async () => {
    const { ctx, work } = createFakeContext();
    await getPrContext(ctx, { scope: 'work', repo: 'acme/web', number: 7, include_diff_stats: false });
    expect(work.calls.some((call) => call.includes('listFiles'))).toBe(false);
  });

  it('requests files by default', async () => {
    const { ctx, work } = createFakeContext();
    await getPrContext(ctx, { scope: 'work', repo: 'acme/web', number: 7 });
    expect(work.calls.some((call) => call.includes('listFiles'))).toBe(true);
  });

  it('caps files at 25 and reports how many were omitted', async () => {
    const { ctx } = createFakeContext();
    const api = ctx.clients.github('work');
    Object.defineProperty(api.pulls, 'listFiles', {
      value: async () => ({
        data: Array.from({ length: 60 }, (_unused, index) => ({
          filename: `src/file-${index}.ts`,
          additions: index,
          deletions: 1,
        })),
      }),
    });
    Object.defineProperty(api.pulls, 'get', {
      value: async () => ({
        data: {
          title: 't',
          body: null,
          state: 'open',
          additions: 100,
          deletions: 60,
          changed_files: 60,
          created_at: '2026-07-20T00:00:00.000Z',
          updated_at: '2026-07-28T00:00:00.000Z',
          html_url: 'https://github.com/acme/web/pull/7',
          user: { login: 'me' },
          head: { sha: 'abc' },
          requested_reviewers: [],
        },
      }),
    });

    const result = await getPrContext(ctx, { scope: 'work', repo: 'acme/web', number: 7 });
    expect(isContext(result)).toBe(true);
    if (!isContext(result)) return;

    expect(result.files?.length).toBeLessThanOrEqual(25);
    expect(result.files_omitted).toBeGreaterThan(0);
    // Biggest changes are kept, since that is where review attention goes.
    expect(result.files?.[0]?.additions).toBe(59);
  });

  it('truncates the body to 1,500 characters', async () => {
    const { ctx } = createFakeContext();
    const api = ctx.clients.github('work');
    Object.defineProperty(api.pulls, 'get', {
      value: async () => ({
        data: {
          title: 't',
          body: 'b'.repeat(9_000),
          state: 'open',
          additions: 1,
          deletions: 1,
          changed_files: 1,
          created_at: '2026-07-20T00:00:00.000Z',
          updated_at: '2026-07-28T00:00:00.000Z',
          html_url: 'https://github.com/acme/web/pull/7',
          user: { login: 'me' },
          head: { sha: 'abc' },
          requested_reviewers: [],
        },
      }),
    });

    const result = await getPrContext(ctx, { scope: 'work', repo: 'acme/web', number: 7 });
    if (!isContext(result)) throw new Error('expected a context');
    expect(result.body.length).toBeLessThanOrEqual(1_500);
  });

  it('serves a repeated call from cache', async () => {
    const { ctx, work } = createFakeContext();
    await getPrContext(ctx, { scope: 'work', repo: 'acme/web', number: 7 });
    const after = work.calls.length;
    await getPrContext(ctx, { scope: 'work', repo: 'acme/web', number: 7 });
    expect(work.calls.length).toBe(after);
  });

  it('tells the caller in its description that raw diffs are not available', () => {
    // The contract matters as much as the code: an LLM must not keep hunting for a diff tool.
    expect(prContextDescription).toMatch(/NEVER returns the raw diff/);
    expect(prContextDescription).toMatch(/browser/);
  });
});

describe('fitPrContext', () => {
  /**
   * A genuine worst case, padded to every documented cap: 120-char title, 1,500-char body,
   * 25 files and 5 comment paths at the 80-char label cap, 20 check runs, 15 reviewers.
   * Measured at ~10.5k characters, i.e. comfortably over budget — this is what makes
   * fitPrContext load-bearing rather than decorative.
   */
  const pad = (index: number): string => 'p'.repeat(78) + String(index).padStart(2, '0');
  const base: PrContext = {
    repo: 'a'.repeat(60),
    number: 999_999,
    title: 't'.repeat(120),
    author: 'u'.repeat(39),
    state: 'open',
    draft: false,
    age_days: 365,
    url: `https://github.com/${'r'.repeat(90)}/pull/999999`,
    body: 'b'.repeat(1_500),
    additions: 99_999,
    deletions: 99_999,
    changed_files: 999,
    ci: Array.from({ length: 20 }, (_unused, index) => ({
      name: 'c'.repeat(78) + String(index),
      conclusion: 'action_required',
    })),
    checks_omitted: 120,
    reviews: Array.from({ length: 15 }, (_unused, index) => ({
      reviewer: `reviewer-name-${index}`,
      state: 'changes_requested',
    })),
    approvals: 3,
    changes_requested: true,
    awaiting: Array.from({ length: 5 }, (_unused, index) => `awaiting-reviewer-${index}`),
    recent_review_comments: Array.from({ length: 5 }, (_unused, index) => ({
      author: `commenter-${index}`,
      path: pad(index),
      body: 'm'.repeat(240),
    })),
    files: Array.from({ length: 25 }, (_unused, index) => ({
      path: pad(index),
      additions: 9_999,
      deletions: 9_999,
    })),
  };

  it('brings a worst-case bundle under the budget', () => {
    // The section caps alone exceed 8,000 characters, so this is a live constraint.
    expect(payloadChars(base)).toBeGreaterThan(MAX_RESPONSE_CHARS);
    const fitted = fitPrContext(base);
    expect(payloadChars(fitted)).toBeLessThanOrEqual(MAX_RESPONSE_CHARS);
  });

  it('discloses that it shortened sections', () => {
    expect(fitPrContext(base).notes?.join(' ')).toMatch(/shortened to stay within the response size budget/);
  });

  it('keeps every section represented rather than dropping one wholesale', () => {
    const fitted = fitPrContext(base);
    expect(fitted.ci.length).toBeGreaterThan(0);
    expect(fitted.recent_review_comments.length).toBeGreaterThan(0);
    expect(fitted.files?.length).toBeGreaterThan(0);
    expect(fitted.body.length).toBeGreaterThan(0);
  });

  it('leaves a bundle that already fits untouched', () => {
    const small: PrContext = { ...base, body: 'short', ci: [], reviews: [], recent_review_comments: [], files: [] };
    expect(fitPrContext(small)).toBe(small);
  });

  it('accumulates files_omitted on top of any pre-existing count', () => {
    // The API already reported 15 files beyond the cap; budget trimming must add to that,
    // not overwrite it, or the caller under-counts what it cannot see.
    const fitted = fitPrContext({ ...base, files_omitted: 15 });
    expect(fitted.files_omitted ?? 0).toBeGreaterThan(15);
  });
});
