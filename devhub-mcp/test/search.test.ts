/**
 * `search_my_work`: query hygiene, source interleaving, partial failure.
 */

import { describe, expect, it } from 'vitest';
import { quoteSearchTerms, searchMyWork } from '../src/tools/search.js';
import { createFakeContext, linearHandlerFor, linearIssueNode, searchItem } from './helpers/fakes.js';

describe('quoteSearchTerms', () => {
  it('quotes the phrase so it cannot be read as qualifiers', () => {
    expect(quoteSearchTerms('checkout timeout')).toBe('"checkout timeout"');
  });

  it('neutralises an injected qualifier', () => {
    // Without quoting, this would silently change whose PRs are searched.
    const quoted = quoteSearchTerms('author:someone-else secret');
    expect(quoted).toBe('"author:someone-else secret"');
    expect(quoted.startsWith('"')).toBe(true);
  });

  it('strips embedded quotes and backslashes that would break out', () => {
    expect(quoteSearchTerms('say "hi" org:evil')).toBe('"say hi org:evil"');
    expect(quoteSearchTerms('a\\"b')).toBe('"a b"');
  });

  it('collapses whitespace', () => {
    expect(quoteSearchTerms('  a   b  ')).toBe('"a b"');
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
      work: { searchItems: [searchItem({ number: 1, draft: true })] },
      personal: { searchItems: [] },
      linearHandler: linearHandlerFor({ search: [] }),
    });

    const result = await searchMyWork(ctx, { query: 'x' });
    expect(result.items[0]?.state).toBe('draft');
  });

  it('does not restrict results to PRs the user authored', async () => {
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
});
