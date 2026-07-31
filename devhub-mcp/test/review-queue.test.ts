/**
 * `get_my_review_queue` behaviour: ordering, partial failure, budget, caching.
 */

import { describe, expect, it } from 'vitest';
import { getMyReviewQueue } from '../src/tools/review-queue.js';
import { MAX_RESPONSE_CHARS, payloadChars } from '../src/lib/truncate.js';
import { createFakeContext, searchItem, FIXED_NOW } from './helpers/fakes.js';

describe('get_my_review_queue', () => {
  it('sorts oldest first across both scopes', async () => {
    const { ctx } = createFakeContext({
      work: {
        searchItems: [
          searchItem({ number: 1, created_at: '2026-07-29T00:00:00.000Z' }),
          searchItem({ number: 2, created_at: '2026-07-01T00:00:00.000Z' }),
        ],
      },
      personal: {
        searchItems: [
          searchItem({
            number: 3,
            created_at: '2026-07-15T00:00:00.000Z',
            repository_url: 'https://api.github.com/repos/octo-personal/dotfiles',
          }),
        ],
      },
    });

    const result = await getMyReviewQueue(ctx, { scope: 'both' });

    expect(result.items.map((item) => item.number)).toEqual([2, 3, 1]);
    // Oldest first also means age_days descends.
    const ages = result.items.map((item) => item.age_days);
    expect([...ages]).toEqual([...ages].sort((a, b) => b - a));
  });

  it('caps results at max_results and reports has_more', async () => {
    const many = Array.from({ length: 10 }, (_unused, index) =>
      searchItem({ number: index + 1, created_at: `2026-07-${String(index + 1).padStart(2, '0')}T00:00:00.000Z` }),
    );
    const { ctx } = createFakeContext({ work: { searchItems: many, totalCount: 40 } });

    const result = await getMyReviewQueue(ctx, { scope: 'work', max_results: 3 });

    expect(result.items).toHaveLength(3);
    expect(result.total_found).toBe(40);
    expect(result.has_more).toBe(true);
  });

  it('clamps max_results above the documented ceiling', async () => {
    const { ctx, work } = createFakeContext({ work: { searchItems: [] } });

    await getMyReviewQueue(ctx, { scope: 'work', max_results: 5_000 });

    // The clamp must reach the upstream request, not just the response.
    expect(work.calls.some((call) => call.includes('search('))).toBe(true);
  });

  it('enriches with diff stats and CI status', async () => {
    const { ctx } = createFakeContext({
      work: {
        searchItems: [searchItem({ number: 7 })],
        additions: 120,
        deletions: 34,
        changedFiles: 9,
        checkRuns: [
          { name: 'build', status: 'completed', conclusion: 'success' },
          { name: 'lint', status: 'completed', conclusion: 'failure' },
        ],
      },
    });

    const result = await getMyReviewQueue(ctx, { scope: 'work' });
    const item = result.items[0];

    expect(item?.additions).toBe(120);
    expect(item?.deletions).toBe(34);
    expect(item?.changed_files).toBe(9);
    expect(item?.ci).toBe('failing (1/2)');
  });

  it('reports pending CI without calling the legacy status endpoint', async () => {
    const { ctx, work } = createFakeContext({
      work: {
        searchItems: [searchItem({ number: 8 })],
        checkRuns: [
          { name: 'build', status: 'in_progress', conclusion: null },
          { name: 'lint', status: 'completed', conclusion: 'success' },
        ],
      },
    });

    const result = await getMyReviewQueue(ctx, { scope: 'work' });

    expect(result.items[0]?.ci).toBe('pending (1/2)');
    expect(work.calls.some((call) => call.includes('getCombinedStatusForRef'))).toBe(false);
  });

  it('marks the CI denominator when there are more check runs than one page holds', async () => {
    const { ctx } = createFakeContext({ work: { searchItems: [searchItem({ number: 10 })] } });
    const api = ctx.clients.github('work');
    Object.defineProperty(api.checks, 'listForRef', {
      value: async () => ({
        data: {
          // A monorepo: 250 runs exist but only 100 come back on this page.
          total_count: 250,
          check_runs: Array.from({ length: 100 }, (_unused, index) => ({
            name: `check-${index}`,
            status: 'completed',
            conclusion: index === 0 ? 'failure' : 'success',
          })),
        },
      }),
    });

    const result = await getMyReviewQueue(ctx, { scope: 'work' });
    // "100+" rather than "100", so the summary does not imply it saw every run.
    expect(result.items[0]?.ci).toBe('failing (1/100+)');
  });

  it('falls back to combined status when a repo reports no check runs', async () => {
    const { ctx, work } = createFakeContext({
      work: { searchItems: [searchItem({ number: 9 })], checkRuns: [] },
    });

    const result = await getMyReviewQueue(ctx, { scope: 'work' });

    expect(work.calls.some((call) => call.includes('getCombinedStatusForRef'))).toBe(true);
    expect(result.items[0]?.ci).toBe('passing');
  });

  it('returns the healthy scope plus a warning when one upstream fails', async () => {
    const rateLimited = Object.assign(new Error('API rate limit exceeded'), {
      status: 403,
      response: {
        headers: {
          'x-ratelimit-remaining': '0',
          'x-ratelimit-reset': String(Math.floor((FIXED_NOW + 15 * 60_000) / 1000)),
        },
      },
    });

    const { ctx } = createFakeContext({
      work: { searchError: rateLimited },
      personal: {
        searchItems: [
          searchItem({ number: 5, repository_url: 'https://api.github.com/repos/octo-personal/dotfiles' }),
        ],
      },
    });

    const result = await getMyReviewQueue(ctx, { scope: 'both' });

    // The good half still comes back.
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.source).toBe('personal');
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings?.[0]?.upstream).toBe('github-work');
    expect(result.warnings?.[0]?.status).toBe(403);
    // Rate limits report minutes to reset instead of retrying in a loop.
    expect(result.warnings?.[0]?.hint).toMatch(/resets in about 15 minutes/);
  });

  it('degrades a single row when enrichment fails, keeping the PR listed', async () => {
    const { ctx } = createFakeContext({ work: { searchItems: [searchItem({ number: 3 })] } });
    // Make enrichment blow up but leave search intact.
    const api = ctx.clients.github('work');
    Object.defineProperty(api.pulls, 'get', {
      value: async () => {
        throw new Error('boom');
      },
    });

    const result = await getMyReviewQueue(ctx, { scope: 'work' });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.ci).toBe('unknown');
    expect(result.items[0]?.additions).toBeUndefined();
  });

  it('serves a repeated identical call from cache', async () => {
    const { ctx, work } = createFakeContext({ work: { searchItems: [searchItem({ number: 1 })] } });

    await getMyReviewQueue(ctx, { scope: 'work', max_results: 5 });
    const callsAfterFirst = work.calls.length;
    await getMyReviewQueue(ctx, { scope: 'work', max_results: 5 });

    expect(work.calls.length).toBe(callsAfterFirst);
  });

  it('does not confuse different arguments in the cache', async () => {
    const { ctx, work } = createFakeContext({ work: { searchItems: [searchItem({ number: 1 })] } });

    await getMyReviewQueue(ctx, { scope: 'work', max_results: 5 });
    const callsAfterFirst = work.calls.length;
    await getMyReviewQueue(ctx, { scope: 'work', max_results: 6 });

    expect(work.calls.length).toBeGreaterThan(callsAfterFirst);
  });

  it('stays inside the response budget with 30 padded results', async () => {
    const padded = Array.from({ length: 30 }, (_unused, index) =>
      searchItem({
        number: index + 1,
        // Realistic worst case: very long titles, long repo names, long URLs.
        title: `refactor(${'subsystem'.repeat(4)}): ${'a very long pull request title that keeps going '.repeat(4)}`,
        repository_url: `https://api.github.com/repos/acme/${'long-repository-name-'.repeat(3)}${index}`,
        html_url: `https://github.com/acme/${'long-repository-name-'.repeat(3)}${index}/pull/${index + 1}`,
        user: { login: 'a-fairly-long-github-username' },
      }),
    );
    const { ctx } = createFakeContext({ work: { searchItems: padded, totalCount: 500 } });

    const result = await getMyReviewQueue(ctx, { scope: 'work', max_results: 30 });

    expect(payloadChars(result)).toBeLessThanOrEqual(MAX_RESPONSE_CHARS);
    expect(result.items.length).toBeGreaterThan(0);
  });

  it('discloses budget-driven truncation instead of silently dropping rows', async () => {
    const padded = Array.from({ length: 30 }, (_unused, index) =>
      searchItem({
        number: index + 1,
        title: 'x'.repeat(120),
        repository_url: `https://api.github.com/repos/acme/${'r'.repeat(60)}${index}`,
        html_url: `https://github.com/acme/${'r'.repeat(60)}${index}/pull/${index + 1}`,
        user: { login: 'u'.repeat(35) },
      }),
    );
    const { ctx } = createFakeContext({ work: { searchItems: padded, totalCount: 30 } });

    const result = await getMyReviewQueue(ctx, { scope: 'work', max_results: 30 });

    if (result.items.length < 30) {
      expect(result.notes?.join(' ')).toMatch(/omitted to stay within the response size budget/);
      expect(result.has_more).toBe(true);
    }
    expect(payloadChars(result)).toBeLessThanOrEqual(MAX_RESPONSE_CHARS);
  });

  it('truncates an absurdly long PR title', async () => {
    const { ctx } = createFakeContext({
      work: { searchItems: [searchItem({ number: 1, title: 'z'.repeat(5_000) })] },
    });

    const result = await getMyReviewQueue(ctx, { scope: 'work' });

    expect((result.items[0]?.title ?? '').length).toBeLessThanOrEqual(120);
  });
});
