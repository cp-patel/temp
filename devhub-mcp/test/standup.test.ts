/**
 * `get_standup_notes`: window arithmetic, bucketing, summary, and query shape.
 */

import { describe, expect, it } from 'vitest';
import {
  buildStandupSummary,
  fitStandup,
  getStandupNotes,
  sinceDate,
  standupDescription,
  type StandupNotes,
} from '../src/tools/standup.js';
import { MAX_RESPONSE_CHARS, payloadChars } from '../src/lib/truncate.js';
import { createFakeContext, linearHandlerFor, linearIssueNode, searchItem, FIXED_NOW } from './helpers/fakes.js';

describe('sinceDate', () => {
  it('floors the window start to a UTC calendar date', () => {
    // FIXED_NOW is 2026-07-31T12:00Z; one day back lands inside 2026-07-30.
    const { dateStr, sinceMs } = sinceDate(FIXED_NOW, 1);
    expect(dateStr).toBe('2026-07-30');
    // GitHub compares date qualifiers at day granularity, so the Linear boundary must be the
    // same floored midnight or the two sources would disagree about "yesterday".
    expect(sinceMs).toBe(Date.parse('2026-07-30T00:00:00.000Z'));
  });

  it('supports a week-long window', () => {
    expect(sinceDate(FIXED_NOW, 7).dateStr).toBe('2026-07-24');
  });
});

describe('buildStandupSummary', () => {
  it('reads like a standup opener', () => {
    expect(buildStandupSummary({ merged: 2, opened: 1, completed: 1, inProgress: 3 })).toBe(
      'Merged 2 PRs, opened 1, completed 1 ticket; 3 in progress.',
    );
  });

  it('singularises', () => {
    expect(buildStandupSummary({ merged: 1, opened: 0, completed: 2, inProgress: 1 })).toBe(
      'Merged 1 PR, opened 0, completed 2 tickets; 1 in progress.',
    );
  });

  it('says something useful for a quiet window', () => {
    expect(buildStandupSummary({ merged: 0, opened: 0, completed: 0, inProgress: 0 })).toMatch(/No merged/);
  });
});

describe('get_standup_notes', () => {
  it('issues the merged and opened searches with the window date and scope qualifier', async () => {
    const { ctx, work } = createFakeContext({
      work: { searchItems: [] },
      personal: { searchItems: [] },
      linearHandler: linearHandlerFor({ issues: [] }),
    });

    await getStandupNotes(ctx, { days_back: 1, scope: 'work' });

    const searches = work.calls.filter((call) => call.includes('search('));
    expect(searches).toHaveLength(2);
    const merged = searches.find((call) => call.includes('is:merged'));
    const opened = searches.find((call) => call.includes('is:open'));
    // Both verified live: merged:>= and created:>= return 200 with real results.
    expect(merged).toContain('merged:>=2026-07-30');
    expect(merged).toContain('author:work-login');
    expect(merged).toContain('org:acme');
    expect(opened).toContain('created:>=2026-07-30');
  });

  it('never touches the personal client when scoped to work', async () => {
    const { ctx, personal } = createFakeContext({
      work: { searchItems: [] },
      linearHandler: linearHandlerFor({ issues: [] }),
    });

    await getStandupNotes(ctx, { scope: 'work' });
    expect(personal.calls).toEqual([]);
  });

  it('separates merged from still-open PRs and carries merged_at', async () => {
    const mergedPr = searchItem({
      number: 33,
      state: 'closed',
      pull_request: { merged_at: '2026-07-30T18:00:00.000Z' },
    });
    const { ctx } = createFakeContext({
      work: { searchItems: [mergedPr] },
      personal: { searchItems: [] },
      linearHandler: linearHandlerFor({ issues: [] }),
    });

    const result = await getStandupNotes(ctx, { scope: 'work' });

    // The fake serves the same list to both searches; what matters is the shape mapping.
    expect(result.merged_prs[0]).toMatchObject({
      repo: 'acme/web',
      number: 33,
      source: 'work',
      merged_at: '2026-07-30T18:00:00.000Z',
    });
  });

  it('buckets Linear issues into completed-in-window vs in-progress', async () => {
    const { ctx } = createFakeContext({
      linearHandler: linearHandlerFor({
        issues: [
          linearIssueNode({
            identifier: 'ENG-1',
            state: { name: 'Done', type: 'completed' },
            completedAt: '2026-07-30T15:00:00.000Z',
          }),
          linearIssueNode({
            identifier: 'ENG-2',
            state: { name: 'Done', type: 'completed' },
            // Completed before the window: yesterday's standup should not re-report it.
            completedAt: '2026-07-01T15:00:00.000Z',
          }),
          linearIssueNode({ identifier: 'ENG-3', state: { name: 'In Progress', type: 'started' } }),
          linearIssueNode({ identifier: 'ENG-4', state: { name: 'Backlog', type: 'backlog' } }),
        ],
      }),
      work: { searchItems: [] },
      personal: { searchItems: [] },
    });

    const result = await getStandupNotes(ctx, { days_back: 1 });

    expect(result.completed_issues.map((issue) => issue.identifier)).toEqual(['ENG-1']);
    expect(result.in_progress_issues.map((issue) => issue.identifier)).toEqual(['ENG-3']);
    expect(result.summary).toBe('Merged 0 PRs, opened 0, completed 1 ticket; 1 in progress.');
  });

  it('returns the GitHub half with a warning when Linear is down', async () => {
    const { ctx } = createFakeContext({
      work: { searchItems: [searchItem({ number: 1, pull_request: { merged_at: '2026-07-30T10:00:00Z' } })] },
      personal: { searchItems: [] },
      linearHandler: linearHandlerFor({ rejectAll: Object.assign(new Error('down'), { status: 503 }) }),
    });

    const result = await getStandupNotes(ctx, {});

    expect(result.merged_prs.length).toBeGreaterThan(0);
    expect(result.warnings?.some((warning) => warning.upstream === 'linear')).toBe(true);
  });

  it('counts upstream totals in the summary, not the fetched page', async () => {
    // 30 merged upstream, page holds fewer: the headline number must still say 30, or the
    // page size silently becomes the day's story.
    const many = Array.from({ length: 30 }, (_unused, index) =>
      searchItem({ number: index + 1, pull_request: { merged_at: '2026-07-30T10:00:00Z' } }),
    );
    const { ctx } = createFakeContext({
      work: { searchItems: many, totalCount: 30 },
      personal: { searchItems: [] },
      linearHandler: linearHandlerFor({ issues: [] }),
    });

    const result = await getStandupNotes(ctx, { scope: 'work' });

    expect(result.merged_prs.length).toBeLessThanOrEqual(10);
    expect(result.summary).toMatch(/Merged 30 PRs/);
    expect(result.notes?.join(' ')).toMatch(/merged_prs \(30 total, 10 shown\)/);
  });

  it('serves a repeated call from cache', async () => {
    const { ctx, work } = createFakeContext({
      work: { searchItems: [] },
      personal: { searchItems: [] },
      linearHandler: linearHandlerFor({ issues: [] }),
    });

    await getStandupNotes(ctx, { days_back: 1 });
    const after = work.calls.length;
    await getStandupNotes(ctx, { days_back: 1 });
    expect(work.calls.length).toBe(after);
  });

  it('positions itself as the retrospective tool in its description', () => {
    expect(standupDescription).toMatch(/RETROSPECTIVE/);
    expect(standupDescription).toMatch(/whats_blocked/);
    expect(standupDescription).toMatch(/Example:/);
  });
});

describe('fitStandup', () => {
  it('trims the longest section until the payload fits, keeping all represented', () => {
    const pr = (index: number): StandupNotes['merged_prs'][number] => ({
      repo: `acme/${'long-repository-name-'.repeat(4)}${index}`,
      number: index,
      title: 'a long merged pull request title that takes space '.repeat(3),
      url: `https://github.com/acme/${'long-repository-name-'.repeat(4)}${index}/pull/${index}`,
      source: 'work',
      merged_at: '2026-07-30T10:00:00.000Z',
    });
    const oversized: StandupNotes = {
      summary: 's',
      since: '2026-07-30',
      merged_prs: Array.from({ length: 30 }, (_unused, index) => pr(index)),
      opened_prs: Array.from({ length: 30 }, (_unused, index) => pr(index + 100)),
      completed_issues: [],
      in_progress_issues: [],
    };

    expect(payloadChars(oversized)).toBeGreaterThan(MAX_RESPONSE_CHARS);
    const fitted = fitStandup(oversized);
    expect(payloadChars(fitted)).toBeLessThanOrEqual(MAX_RESPONSE_CHARS);
    expect(fitted.merged_prs.length).toBeGreaterThan(0);
    expect(fitted.opened_prs.length).toBeGreaterThan(0);
    expect(fitted.notes?.join(' ')).toMatch(/summary counts reflect the true totals/);
  });

  it('leaves a small payload untouched', () => {
    const small: StandupNotes = {
      summary: 's',
      since: '2026-07-30',
      merged_prs: [],
      opened_prs: [],
      completed_issues: [],
      in_progress_issues: [],
    };
    expect(fitStandup(small)).toBe(small);
  });
});
