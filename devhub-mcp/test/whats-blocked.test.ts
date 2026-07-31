/**
 * `whats_blocked`: the staleness rules, the computed summary line, and the single-call promise.
 */

import { describe, expect, it } from 'vitest';
import {
  authoredBlockedReason,
  blockingOthersReason,
  buildSummary,
  fitSections,
  whatsBlocked,
  whatsBlockedDescription,
  type BlockedSections,
} from '../src/tools/whats-blocked.js';
import { MAX_RESPONSE_CHARS, payloadChars } from '../src/lib/truncate.js';
import type { PrItem } from '../src/lib/format.js';
import { createFakeContext, linearHandlerFor, linearIssueNode, searchItem } from './helpers/fakes.js';

function pr(overrides: Partial<PrItem> = {}): PrItem {
  return {
    source: 'work',
    repo: 'acme/web',
    number: 1,
    title: 'T',
    author: 'me',
    age_days: 10,
    url: 'https://github.com/acme/web/pull/1',
    approvals: 0,
    ...overrides,
  };
}

describe('authoredBlockedReason', () => {
  it('flags a PR open past the threshold with no approval', () => {
    expect(authoredBlockedReason(pr({ age_days: 4, approvals: 0 }))).toMatch(/open 4d with no approval/);
  });

  it('does not flag a PR that is still young', () => {
    expect(authoredBlockedReason(pr({ age_days: 3, approvals: 0 }))).toBeUndefined();
  });

  it('does not flag an approved PR', () => {
    expect(authoredBlockedReason(pr({ age_days: 30, approvals: 2 }))).toBeUndefined();
  });

  it('flags changes-requested regardless of age', () => {
    expect(
      authoredBlockedReason(
        pr({ age_days: 1, changes_requested: true, pushed_since_review: false, days_since_activity: 2 }),
      ),
    ).toMatch(/changes requested, not addressed for 2d/);
  });

  it('does not flag changes-requested once the author has pushed since the review', () => {
    // A push after the review puts the ball back with the reviewer, not the author. This is
    // decided by comparing the head commit to the review timestamp, not by coarse activity.
    expect(
      authoredBlockedReason(
        pr({ age_days: 9, changes_requested: true, pushed_since_review: true, days_since_activity: 0 }),
      ),
    ).toBeUndefined();
  });

  it('still flags changes-requested when the push signal is unknown', () => {
    // Missing head-commit date must not silently clear a real blocker.
    expect(authoredBlockedReason(pr({ age_days: 9, changes_requested: true }))).toMatch(
      /changes requested, not addressed yet/,
    );
  });

  it('names who is being waited on when known', () => {
    expect(authoredBlockedReason(pr({ age_days: 6, awaiting: ['alice', 'bob'] }))).toMatch(/awaiting alice, bob/);
  });

  it('says so explicitly when nobody has responded', () => {
    expect(authoredBlockedReason(pr({ age_days: 6, awaiting: [] }))).toMatch(/no reviewer has responded/);
  });

  it('never flags a draft', () => {
    expect(authoredBlockedReason(pr({ age_days: 60, draft: true }))).toBeUndefined();
    expect(authoredBlockedReason(pr({ draft: true, changes_requested: true }))).toBeUndefined();
  });

  it('does not invent a blocker for a PR whose review state is unknown', () => {
    // Enrichment failed, so `approvals` is absent. Defaulting it to 0 would report a stale
    // unapproved PR that might actually be approved and ready to merge.
    const { approvals: _dropped, ...withoutApprovals } = pr({ age_days: 40 });
    expect(authoredBlockedReason(withoutApprovals as PrItem)).toBeUndefined();
  });
});

describe('blockingOthersReason', () => {
  it('flags a review request older than the threshold', () => {
    expect(blockingOthersReason(pr({ age_days: 6 }))).toMatch(/awaiting your review for 6d/);
  });

  it('does not flag one at exactly the threshold', () => {
    expect(blockingOthersReason(pr({ age_days: 5 }))).toBeUndefined();
  });

  it('never flags a draft', () => {
    expect(blockingOthersReason(pr({ age_days: 60, draft: true }))).toBeUndefined();
  });
});

describe('buildSummary', () => {
  it('matches the shape the spec asks for', () => {
    expect(buildSummary({ waiting: 2, blocked: 1, blocking: 3 })).toBe(
      '2 PRs waiting on reviewers, 1 ticket blocked, you are blocking 3 reviews',
    );
  });

  it('singularises correctly', () => {
    expect(buildSummary({ waiting: 1, blocked: 1, blocking: 1 })).toBe(
      '1 PR waiting on reviewers, 1 ticket blocked, you are blocking 1 review',
    );
  });

  it('says something useful when nothing is blocked', () => {
    expect(buildSummary({ waiting: 0, blocked: 0, blocking: 0 })).toMatch(/Nothing blocked/);
  });
});

describe('whats_blocked', () => {
  it('answers in a single call across all three sources', async () => {
    const { ctx, work, personal, linear } = createFakeContext({
      work: {
        searchItems: [searchItem({ number: 100, created_at: '2026-07-01T00:00:00.000Z' })],
      },
      personal: { searchItems: [] },
      linearHandler: linearHandlerFor({
        issues: [linearIssueNode({ identifier: 'ENG-7', state: { name: 'Blocked', type: 'started' } })],
      }),
    });

    const result = await whatsBlocked(ctx);

    expect(result.summary).toMatch(/waiting on reviewers/);
    expect(result.blocked_issues.map((issue) => issue.identifier)).toEqual(['ENG-7']);
    // One tool call, three upstreams — the whole point of this tool.
    expect(work.calls.length).toBeGreaterThan(0);
    expect(linear.calls.length).toBeGreaterThan(0);
    expect(personal.calls.length).toBeGreaterThan(0);
  });

  it('separates what blocks you from what you block', async () => {
    const { ctx } = createFakeContext({
      work: { searchItems: [searchItem({ number: 5, created_at: '2026-07-01T00:00:00.000Z' })] },
      personal: { searchItems: [] },
      linearHandler: linearHandlerFor({ issues: [] }),
    });

    const result = await whatsBlocked(ctx);

    // The same PR is both authored-by and review-requested-by the fake, so it lands in both
    // sections — the sections are computed independently and must both populate.
    expect(result.waiting_on_reviewers.length).toBeGreaterThan(0);
    expect(result.you_are_blocking.length).toBeGreaterThan(0);
    expect(result.waiting_on_reviewers[0]?.reason).toBeDefined();
    expect(result.you_are_blocking[0]?.reason).toBeDefined();
  });

  it('reports an empty but valid answer when nothing is stuck', async () => {
    const { ctx } = createFakeContext({
      work: { searchItems: [] },
      personal: { searchItems: [] },
      linearHandler: linearHandlerFor({ issues: [] }),
    });

    const result = await whatsBlocked(ctx);

    expect(result.summary).toMatch(/Nothing blocked/);
    expect(result.waiting_on_reviewers).toEqual([]);
    expect(result.blocked_issues).toEqual([]);
    expect(result.you_are_blocking).toEqual([]);
  });

  it('still answers when Linear is down, and says so', async () => {
    const { ctx } = createFakeContext({
      work: { searchItems: [searchItem({ number: 5, created_at: '2026-07-01T00:00:00.000Z' })] },
      personal: { searchItems: [] },
      linearHandler: linearHandlerFor({ rejectAll: Object.assign(new Error('down'), { status: 503 }) }),
    });

    const result = await whatsBlocked(ctx);

    expect(result.waiting_on_reviewers.length).toBeGreaterThan(0);
    expect(result.blocked_issues).toEqual([]);
    expect(result.warnings?.some((warning) => warning.upstream === 'linear')).toBe(true);
    expect(result.notes?.join(' ')).toMatch(/may be incomplete/);
  });

  it('surfaces a GitHub warning from the composed tools', async () => {
    const { ctx } = createFakeContext({
      work: { searchError: Object.assign(new Error('nope'), { status: 401 }) },
      personal: { searchItems: [] },
      linearHandler: linearHandlerFor({ issues: [] }),
    });

    const result = await whatsBlocked(ctx);
    expect(result.warnings?.some((warning) => warning.upstream === 'github-work')).toBe(true);
  });

  it('does not enrich the review-queue side, keeping the fan-out bounded', async () => {
    // This tool searches two scopes twice (authored + review-requested). Enriching both sides
    // fully would cost ~4 follow-up requests per PR on each side. The review-queue side needs
    // only age and draft status, which the search response already carries, so it must issue
    // no per-PR requests at all beyond the authored side's.
    const items = Array.from({ length: 10 }, (_unused, index) =>
      searchItem({ number: index + 1, created_at: '2026-06-01T00:00:00.000Z' }),
    );
    const { ctx, work } = createFakeContext({
      work: { searchItems: items },
      personal: { searchItems: [] },
      linearHandler: linearHandlerFor({ issues: [] }),
    });

    await whatsBlocked(ctx);

    const searches = work.calls.filter((call) => call.includes('search(')).length;
    const perPr = work.calls.filter((call) => call.includes('pulls.get(')).length;
    const ciCalls = work.calls.filter(
      (call) => call.includes('checks.listForRef') || call.includes('getCombinedStatusForRef'),
    ).length;

    expect(searches).toBe(2);
    // 10 authored PRs enriched once each — not 20 (which would mean the queue side enriched too).
    expect(perPr).toBe(10);
    // And no CI requests at all, since no staleness rule consults CI.
    expect(ciCalls).toBe(0);
  });

  it('takes no parameters', () => {
    expect(whatsBlockedDescription).toMatch(/Takes no parameters/);
  });

  it('tells the LLM to prefer it over chaining three tools', () => {
    expect(whatsBlockedDescription).toMatch(/do NOT chain/);
  });
});

describe('fitSections', () => {
  const bigPr = (index: number): PrItem =>
    pr({
      number: index,
      title: 'a fairly long pull request title that takes up room '.repeat(2),
      repo: `acme/some-long-repository-name-${index}`,
      url: `https://github.com/acme/some-long-repository-name-${index}/pull/${index}`,
      reason: 'open 12d with no approval — awaiting reviewer-one, reviewer-two',
      awaiting: ['reviewer-one', 'reviewer-two'],
    });

  it('trims until the payload fits', () => {
    const sections: BlockedSections = {
      summary: buildSummary({ waiting: 10, blocked: 10, blocking: 10 }),
      waiting_on_reviewers: Array.from({ length: 10 }, (_unused, index) => bigPr(index)),
      blocked_issues: [],
      you_are_blocking: Array.from({ length: 10 }, (_unused, index) => bigPr(index + 100)),
    };

    const fitted = fitSections(sections);
    expect(payloadChars(fitted)).toBeLessThanOrEqual(MAX_RESPONSE_CHARS);
  });

  it('keeps both directions represented when trimming', () => {
    const sections: BlockedSections = {
      summary: 's',
      waiting_on_reviewers: Array.from({ length: 15 }, (_unused, index) => bigPr(index)),
      blocked_issues: [],
      you_are_blocking: Array.from({ length: 15 }, (_unused, index) => bigPr(index + 100)),
    };

    const fitted = fitSections(sections);
    // Dropping one side entirely would misrepresent "blocked on" vs "blocking".
    expect(fitted.waiting_on_reviewers.length).toBeGreaterThan(0);
    expect(fitted.you_are_blocking.length).toBeGreaterThan(0);
  });

  it('preserves the true counts in the summary after trimming', () => {
    const summary = buildSummary({ waiting: 15, blocked: 0, blocking: 15 });
    const fitted = fitSections({
      summary,
      waiting_on_reviewers: Array.from({ length: 15 }, (_unused, index) => bigPr(index)),
      blocked_issues: [],
      you_are_blocking: Array.from({ length: 15 }, (_unused, index) => bigPr(index + 100)),
    });

    // The counts describe reality, not the truncated payload.
    expect(fitted.summary).toBe(summary);
    expect(fitted.notes?.join(' ')).toMatch(/summary counts reflect the true totals/);
  });

  it('leaves a small payload untouched', () => {
    const sections: BlockedSections = {
      summary: 's',
      waiting_on_reviewers: [pr()],
      blocked_issues: [],
      you_are_blocking: [],
    };
    expect(fitSections(sections)).toBe(sections);
  });
});
