/**
 * `search_my_work`: query hygiene, source interleaving, partial failure.
 */

import { describe, expect, it } from 'vitest';
import { describePrState, sanitizeSearchTerms, searchMyWork } from '../src/tools/search.js';
import { createFakeContext, linearHandlerFor, linearIssueNode, searchItem } from './helpers/fakes.js';

describe('sanitizeSearchTerms', () => {
  it('leaves ordinary keywords untouched, preserving AND semantics', () => {
    // Critically NOT quoted: GitHub reads a quoted string as an exact-phrase match, which
    // measured 54 results against 99,339 for the same words unquoted.
    expect(sanitizeSearchTerms('checkout timeout')).toBe('checkout timeout');
  });

  it('defuses an injected qualifier by removing the colon', () => {
    // Without this, the user's text could override whose PRs are searched.
    expect(sanitizeSearchTerms('author:someone-else secret')).toBe('author someone-else secret');
  });

  it('defuses scope-widening qualifiers', () => {
    expect(sanitizeSearchTerms('org:other-company')).not.toContain(':');
    expect(sanitizeSearchTerms('repo:someone/private')).not.toContain(':');
    expect(sanitizeSearchTerms('user:someone-else')).not.toContain(':');
  });

  it('strips quotes and backslashes so a quoted context cannot be reopened', () => {
    expect(sanitizeSearchTerms('say "hi" org:evil')).toBe('say hi org evil');
    expect(sanitizeSearchTerms('a\\"b')).toBe('a b');
  });

  it('collapses whitespace', () => {
    expect(sanitizeSearchTerms('  a   b  ')).toBe('a b');
  });

  it('is idempotent, so applying it twice is safe', () => {
    const once = sanitizeSearchTerms('org:evil "x" retry');
    expect(sanitizeSearchTerms(once)).toBe(once);
  });

  it('reduces qualifier-only input to nothing', () => {
    expect(sanitizeSearchTerms(':::')).toBe('');
  });
});

describe('describePrState', () => {
  it('reports merged when merged_at is set', () => {
    expect(describePrState({ state: 'closed', pull_request: { merged_at: '2026-07-01T00:00:00Z' } })).toBe('merged');
  });

  it('distinguishes closed from merged', () => {
    expect(describePrState({ state: 'closed', pull_request: { merged_at: null } })).toBe('closed');
  });

  it('reports draft for an open draft', () => {
    expect(describePrState({ state: 'open', draft: true })).toBe('draft');
  });

  it('reports open for a plain open PR', () => {
    expect(describePrState({ state: 'open' })).toBe('open');
  });

  it('does not claim a closed PR is a draft', () => {
    // Draft status persists on closed PRs; the closed state is the more important fact.
    expect(describePrState({ state: 'closed', draft: true, pull_request: { merged_at: null } })).toBe('closed');
  });
});

describe('search_my_work', () => {
  it('searches GitHub and Linear together', async () => {
    const { ctx } = createFakeContext({
      work: { searchItems: [searchItem({ number: 3, title: 'Fix checkout timeout' })] },
      personal: { searchItems: [] },
      linearHandler: linearHandlerFor({ search: [linearIssueNode({ identifier: 'ENG-5' })] }),
    });

    const result = await searchMyWork(ctx, { query: 'checkout' });
    const types = result.items.map((item) => item.type).sort();

    expect(types).toEqual(['issue', 'pr']);
    expect(result.items.find((item) => item.type === 'pr')).toMatchObject({ repo: 'acme/web', number: 3 });
    expect(result.items.find((item) => item.type === 'issue')).toMatchObject({
      identifier: 'ENG-5',
      source: 'linear',
    });
  });

  it('applies the scope qualifier and never crosses clients', async () => {
    const { ctx, work, personal } = createFakeContext({
      work: { searchItems: [] },
      linearHandler: linearHandlerFor({ search: [] }),
    });

    await searchMyWork(ctx, { query: 'retry logic', scope: 'work' });

    expect(personal.calls).toEqual([]);
    expect(work.calls.find((call) => call.includes('search('))).toContain('org:acme');
  });

  it('still searches Linear when scoped to one GitHub account', async () => {
    const { ctx, linear } = createFakeContext({
      work: { searchItems: [] },
      linearHandler: linearHandlerFor({ search: [] }),
    });

    await searchMyWork(ctx, { query: 'retry', scope: 'work' });
    // Linear has no work/personal split, so it is always included.
    expect(linear.calls.length).toBe(1);
  });

  it('interleaves sources so one prolific upstream cannot crowd out the others', async () => {
    const { ctx } = createFakeContext({
      work: {
        searchItems: Array.from({ length: 20 }, (_unused, index) => searchItem({ number: index })),
        totalCount: 20,
      },
      personal: { searchItems: [] },
      linearHandler: linearHandlerFor({
        search: [linearIssueNode({ identifier: 'ENG-1' }), linearIssueNode({ identifier: 'ENG-2' })],
        searchTotal: 2,
      }),
    });

    const result = await searchMyWork(ctx, { query: 'x', max_results: 4 });

    expect(result.items).toHaveLength(4);
    // Linear results survive despite GitHub returning ten times as many.
    expect(result.items.some((item) => item.source === 'linear')).toBe(true);
  });

  it('sums totals across every upstream', async () => {
    const { ctx } = createFakeContext({
      work: { searchItems: [searchItem()], totalCount: 30 },
      personal: { searchItems: [searchItem()], totalCount: 12 },
      linearHandler: linearHandlerFor({ search: [linearIssueNode()], searchTotal: 5 }),
    });

    const result = await searchMyWork(ctx, { query: 'x', max_results: 2 });

    expect(result.total_found).toBe(47);
    expect(result.has_more).toBe(true);
  });

  it('returns GitHub results with a warning when Linear fails', async () => {
    const { ctx } = createFakeContext({
      work: { searchItems: [searchItem({ number: 9 })] },
      personal: { searchItems: [] },
      linearHandler: linearHandlerFor({ rejectAll: Object.assign(new Error('down'), { status: 503 }) }),
    });

    const result = await searchMyWork(ctx, { query: 'x' });

    expect(result.items.length).toBeGreaterThan(0);
    expect(result.warnings?.some((warning) => warning.upstream === 'linear')).toBe(true);
  });

  it('returns Linear results with a warning when GitHub fails', async () => {
    const { ctx } = createFakeContext({
      work: { searchError: Object.assign(new Error('nope'), { status: 401 }) },
      personal: { searchError: Object.assign(new Error('nope'), { status: 401 }) },
      linearHandler: linearHandlerFor({ search: [linearIssueNode({ identifier: 'ENG-8' })] }),
    });

    const result = await searchMyWork(ctx, { query: 'x' });

    expect(result.items.map((item) => item.identifier)).toEqual(['ENG-8']);
    expect(result.warnings).toHaveLength(2);
  });

  it('marks a draft PR as draft rather than open', async () => {
    const { ctx } = createFakeContext({
      work: { searchItems: [searchItem({ number: 1, draft: true, state: 'open' })] },
      personal: { searchItems: [] },
      linearHandler: linearHandlerFor({ search: [] }),
    });

    const result = await searchMyWork(ctx, { query: 'x' });
    expect(result.items[0]?.state).toBe('draft');
  });

  it('reports merged and closed PRs accurately, since it does not pin is:open', async () => {
    const { ctx } = createFakeContext({
      work: {
        searchItems: [
          searchItem({ number: 1, state: 'closed', pull_request: { merged_at: '2026-07-01T00:00:00Z' } }),
          searchItem({ number: 2, state: 'closed', pull_request: { merged_at: null } }),
        ],
      },
      personal: { searchItems: [] },
      linearHandler: linearHandlerFor({ search: [] }),
    });

    const result = await searchMyWork(ctx, { query: 'x' });
    const byNumber = new Map(result.items.map((item) => [item.number, item.state]));

    expect(byNumber.get(1)).toBe('merged');
    expect(byNumber.get(2)).toBe('closed');
  });

  it('refuses a query that is nothing but qualifier syntax', async () => {
    const { ctx, work, linear } = createFakeContext({
      work: { searchItems: [searchItem()] },
      linearHandler: linearHandlerFor({ search: [linearIssueNode()] }),
    });

    const result = await searchMyWork(ctx, { query: ':::' });

    // Searching an empty term would fall through to bare qualifiers and match everything.
    expect(result.items).toEqual([]);
    expect(result.notes?.join(' ')).toMatch(/no searchable terms/);
    expect(work.calls).toEqual([]);
    expect(linear.calls).toEqual([]);
  });

  it('does not send a colon to GitHub even when the user typed one', async () => {
    const { ctx, work } = createFakeContext({
      work: { searchItems: [] },
      linearHandler: linearHandlerFor({ search: [] }),
    });

    await searchMyWork(ctx, { query: 'org:other-company secrets', scope: 'work' });
    const query = work.calls.find((call) => call.includes('search(')) ?? '';
    // Isolate just the user-supplied terms: everything between "search(" and our own qualifiers.
    const userPortion = query.slice(query.indexOf('search(') + 'search('.length, query.indexOf('is:pr'));

    expect(userPortion).toBe('org other-company secrets ');
    expect(userPortion).not.toContain(':');
    // Our scope qualifier is still the authoritative one.
    expect(query).toContain('org:acme');
  });

  it('does not restrict results to PRs the user authored by default', async () => {
    const { ctx, work } = createFakeContext({
      work: { searchItems: [] },
      linearHandler: linearHandlerFor({ search: [] }),
    });

    await searchMyWork(ctx, { query: 'x', scope: 'work' });
    const query = work.calls.find((call) => call.includes('search(')) ?? '';

    // This is the escape hatch: topic search across everything visible, not just "mine".
    expect(query).not.toContain('author:');
    expect(query).not.toContain('review-requested:');
  });

  it('narrows to authored PRs and assigned issues with only_mine', async () => {
    const captured: { variables?: Record<string, unknown> | undefined }[] = [];
    const { ctx, work } = createFakeContext({
      work: { searchItems: [] },
      personal: { searchItems: [] },
      linearHandler: (query, variables) => {
        captured.push({ variables });
        return { searchIssues: { totalCount: 0, nodes: [] } };
      },
    });

    await searchMyWork(ctx, { query: 'retry', scope: 'work', only_mine: true });

    // GitHub side: the author qualifier uses this scope's own login.
    expect(work.calls.find((call) => call.includes('search('))).toContain('author:work-login');
    // Linear side: the filter narrows to the configured assignee email.
    expect(captured[0]?.variables?.filter).toEqual({ assignee: { email: { eq: 'me@example.com' } } });
  });

  it('caches only_mine and unrestricted searches separately', async () => {
    const { ctx, work } = createFakeContext({
      work: { searchItems: [] },
      personal: { searchItems: [] },
      linearHandler: linearHandlerFor({ search: [] }),
    });

    await searchMyWork(ctx, { query: 'retry', scope: 'work' });
    const after = work.calls.length;
    await searchMyWork(ctx, { query: 'retry', scope: 'work', only_mine: true });

    // Same query text, different meaning — must not share a cache entry.
    expect(work.calls.length).toBeGreaterThan(after);
  });
});
