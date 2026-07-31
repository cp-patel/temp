/**
 * `get_my_open_prs`: the review roll-up, plus scope separation for the authored-PR path.
 */

import { describe, expect, it } from 'vitest';
import { getMyOpenPrs, headCommitMs, summarizeReviews } from '../src/tools/my-prs.js';
import { createFakeContext, searchItem } from './helpers/fakes.js';

describe('summarizeReviews', () => {
  it('counts one approval per reviewer, not per review event', () => {
    const summary = summarizeReviews(
      [
        { state: 'APPROVED', submitted_at: '2026-07-20T00:00:00.000Z', user: { login: 'alice' } },
        { state: 'APPROVED', submitted_at: '2026-07-21T00:00:00.000Z', user: { login: 'alice' } },
      ],
      [],
    );
    expect(summary.approvals).toBe(1);
  });

  it("uses each reviewer's latest state, so a later approval supersedes changes requested", () => {
    const summary = summarizeReviews(
      [
        { state: 'CHANGES_REQUESTED', submitted_at: '2026-07-20T00:00:00.000Z', user: { login: 'bob' } },
        { state: 'APPROVED', submitted_at: '2026-07-25T00:00:00.000Z', user: { login: 'bob' } },
      ],
      [],
    );
    expect(summary.approvals).toBe(1);
    expect(summary.changesRequested).toBe(false);
  });

  it('keeps changes_requested when that is the latest state', () => {
    const summary = summarizeReviews(
      [
        { state: 'APPROVED', submitted_at: '2026-07-20T00:00:00.000Z', user: { login: 'bob' } },
        { state: 'CHANGES_REQUESTED', submitted_at: '2026-07-25T00:00:00.000Z', user: { login: 'bob' } },
      ],
      [],
    );
    expect(summary.approvals).toBe(0);
    expect(summary.changesRequested).toBe(true);
  });

  it('does not treat a COMMENTED review as a response', () => {
    const summary = summarizeReviews(
      [{ state: 'COMMENTED', submitted_at: '2026-07-20T00:00:00.000Z', user: { login: 'carol' } }],
      [{ login: 'carol' }],
    );
    expect(summary.approvals).toBe(0);
    // Carol commented but never approved or requested changes, so she still owes a review.
    expect(summary.awaiting).toEqual(['carol']);
  });

  it('still counts a COMMENTED review as activity', () => {
    const summary = summarizeReviews(
      [{ state: 'COMMENTED', submitted_at: '2026-07-20T00:00:00.000Z', user: { login: 'carol' } }],
      [],
    );
    expect(summary.lastActivityMs).toBe(Date.parse('2026-07-20T00:00:00.000Z'));
  });

  it('lists requested reviewers who have not responded', () => {
    const summary = summarizeReviews(
      [{ state: 'APPROVED', submitted_at: '2026-07-20T00:00:00.000Z', user: { login: 'alice' } }],
      [{ login: 'dave' }, { login: 'erin' }],
    );
    expect(summary.awaiting.sort()).toEqual(['dave', 'erin']);
  });

  it('a dismissed review voids an earlier approval', () => {
    const summary = summarizeReviews(
      [
        { state: 'APPROVED', submitted_at: '2026-07-20T00:00:00.000Z', user: { login: 'bob' } },
        { state: 'DISMISSED', submitted_at: '2026-07-25T00:00:00.000Z', user: { login: 'bob' } },
      ],
      [],
    );
    expect(summary.approvals).toBe(0);
  });

  it('still awaits a reviewer whose review was dismissed', () => {
    // Dismissal is the act of voiding a review, and GitHub re-requests the reviewer, so they
    // genuinely still owe one — counting them as "responded" would hide that.
    const summary = summarizeReviews(
      [
        { state: 'APPROVED', submitted_at: '2026-07-20T00:00:00.000Z', user: { login: 'bob' } },
        { state: 'DISMISSED', submitted_at: '2026-07-25T00:00:00.000Z', user: { login: 'bob' } },
      ],
      [{ login: 'bob' }],
    );
    expect(summary.awaiting).toEqual(['bob']);
  });

  it('handles a null review author without crashing', () => {
    const summary = summarizeReviews([{ state: 'APPROVED', submitted_at: null, user: null }], []);
    expect(summary.approvals).toBe(0);
  });

  it('returns an empty summary for a PR with no reviews', () => {
    const summary = summarizeReviews([], []);
    expect(summary).toEqual({
      approvals: 0,
      changesRequested: false,
      awaiting: [],
      lastActivityMs: undefined,
      changesRequestedAtMs: undefined,
    });
  });

  it('records when changes were most recently requested', () => {
    const summary = summarizeReviews(
      [
        { state: 'CHANGES_REQUESTED', submitted_at: '2026-07-20T00:00:00.000Z', user: { login: 'bob' } },
        { state: 'CHANGES_REQUESTED', submitted_at: '2026-07-25T00:00:00.000Z', user: { login: 'carol' } },
      ],
      [],
    );
    // The newest of the outstanding requests, so "pushed since" is judged against the latest.
    expect(summary.changesRequestedAtMs).toBe(Date.parse('2026-07-25T00:00:00.000Z'));
  });

  it('clears changesRequestedAtMs once the reviewer approves', () => {
    const summary = summarizeReviews(
      [
        { state: 'CHANGES_REQUESTED', submitted_at: '2026-07-20T00:00:00.000Z', user: { login: 'bob' } },
        { state: 'APPROVED', submitted_at: '2026-07-25T00:00:00.000Z', user: { login: 'bob' } },
      ],
      [],
    );
    expect(summary.changesRequestedAtMs).toBeUndefined();
  });
});

describe('headCommitMs', () => {
  it('reads the committer date', () => {
    expect(headCommitMs({ committer: { date: '2026-07-28T00:00:00.000Z' } })).toBe(
      Date.parse('2026-07-28T00:00:00.000Z'),
    );
  });

  it('prefers the committer date over the author date', () => {
    // A rebased commit keeps an old author date; using it would understate freshness.
    const at = headCommitMs({
      author: { date: '2026-01-01T00:00:00.000Z' },
      committer: { date: '2026-07-28T00:00:00.000Z' },
    });
    expect(at).toBe(Date.parse('2026-07-28T00:00:00.000Z'));
  });

  it('falls back to the author date when there is no committer date', () => {
    expect(headCommitMs({ author: { date: '2026-07-01T00:00:00.000Z' }, committer: null })).toBe(
      Date.parse('2026-07-01T00:00:00.000Z'),
    );
  });

  it('tolerates missing or malformed dates', () => {
    expect(headCommitMs({})).toBeUndefined();
    expect(headCommitMs({ committer: null, author: null })).toBeUndefined();
    expect(headCommitMs({ committer: { date: 'nonsense' } })).toBeUndefined();
  });
});

describe('get_my_open_prs', () => {
  it('searches by author within the scope qualifier', async () => {
    const { ctx, work, personal } = createFakeContext({ work: { searchItems: [] }, personal: { searchItems: [] } });

    await getMyOpenPrs(ctx, { scope: 'both' });

    const workSearch = work.calls.find((call) => call.includes('search('));
    const personalSearch = personal.calls.find((call) => call.includes('search('));
    expect(workSearch).toContain('author:work-login');
    expect(workSearch).toContain('org:acme');
    expect(personalSearch).toContain('author:personal-login');
    expect(personalSearch).toContain('user:octo-personal');
  });

  it('never touches the other client when scoped', async () => {
    const { ctx, personal } = createFakeContext({ work: { searchItems: [searchItem()] } });
    await getMyOpenPrs(ctx, { scope: 'work' });
    expect(personal.calls).toEqual([]);
  });

  it('includes the review roll-up on each item', async () => {
    const { ctx } = createFakeContext({ work: { searchItems: [searchItem({ number: 4 })] } });
    const api = ctx.clients.github('work');
    Object.defineProperty(api.pulls, 'listReviews', {
      value: async () => ({
        data: [{ state: 'APPROVED', submitted_at: '2026-07-28T00:00:00.000Z', user: { login: 'alice' } }],
      }),
    });
    Object.defineProperty(api.pulls, 'get', {
      value: async () => ({
        data: {
          title: 't',
          body: null,
          state: 'open',
          additions: 5,
          deletions: 1,
          changed_files: 2,
          created_at: '2026-07-20T00:00:00.000Z',
          updated_at: '2026-07-28T00:00:00.000Z',
          html_url: 'https://github.com/acme/web/pull/4',
          user: { login: 'me' },
          head: { sha: 'abc' },
          requested_reviewers: [{ login: 'dave' }],
        },
      }),
    });

    const result = await getMyOpenPrs(ctx, { scope: 'work' });
    const item = result.items[0];

    expect(item?.approvals).toBe(1);
    expect(item?.awaiting).toEqual(['dave']);
    expect(item?.days_since_activity).toBe(3);
    expect(item?.changes_requested).toBeUndefined();
  });

  it('collapses a long awaiting list', async () => {
    const { ctx } = createFakeContext({ work: { searchItems: [searchItem({ number: 4 })] } });
    const api = ctx.clients.github('work');
    Object.defineProperty(api.pulls, 'get', {
      value: async () => ({
        data: {
          title: 't',
          body: null,
          state: 'open',
          additions: 1,
          deletions: 1,
          changed_files: 1,
          created_at: '2026-07-20T00:00:00.000Z',
          updated_at: '2026-07-28T00:00:00.000Z',
          html_url: 'https://github.com/acme/web/pull/4',
          user: { login: 'me' },
          head: { sha: 'abc' },
          requested_reviewers: Array.from({ length: 9 }, (_unused, index) => ({ login: `rev${index}` })),
        },
      }),
    });

    const result = await getMyOpenPrs(ctx, { scope: 'work' });
    const awaiting = result.items[0]?.awaiting ?? [];

    expect(awaiting).toHaveLength(6);
    expect(awaiting[5]).toBe('+4 more');
  });
});
