/**
 * Phase 2 acceptance: every tool's largest realistic response stays under the char budget.
 *
 * Each fixture is padded to the caps the tool documents — long titles, long repo and file
 * names, long logins, maximum result counts — so this measures the real ceiling rather than a
 * comfortable average.
 */

import { describe, expect, it } from 'vitest';
import { MAX_RESPONSE_CHARS, payloadChars } from '../src/lib/truncate.js';
import { getMyReviewQueue } from '../src/tools/review-queue.js';
import { getMyOpenPrs } from '../src/tools/my-prs.js';
import { getPrContext } from '../src/tools/pr-context.js';
import { getMyLinearIssues } from '../src/tools/linear-issues.js';
import { searchMyWork } from '../src/tools/search.js';
import { whatsBlocked } from '../src/tools/whats-blocked.js';
import {
  createFakeContext,
  linearHandlerFor,
  linearIssueNode,
  searchItem,
  type FakeGithubOptions,
} from './helpers/fakes.js';

const LONG_REPO = `acme/${'long-repository-name-segment-'.repeat(3)}`;
const LONG_TITLE = `refactor(${'subsystem'.repeat(5)}): ${'a deliberately long pull request title '.repeat(4)}`;
const LONG_LOGIN = 'a-rather-long-github-username-here';

/** A padded GitHub scope returning `count` maximally verbose PRs. */
function paddedGithub(count: number, startNumber = 1): FakeGithubOptions {
  return {
    searchItems: Array.from({ length: count }, (_unused, index) => {
      const number = startNumber + index;
      return searchItem({
        number,
        title: LONG_TITLE,
        repository_url: `https://api.github.com/repos/${LONG_REPO}${index}`,
        html_url: `https://github.com/${LONG_REPO}${index}/pull/${number}`,
        created_at: '2026-05-01T00:00:00.000Z',
        updated_at: '2026-05-02T00:00:00.000Z',
        user: { login: LONG_LOGIN },
      });
    }),
    totalCount: 5_000,
    additions: 99_999,
    deletions: 99_999,
    changedFiles: 999,
    // Many failing checks makes the CI summary as long as it gets.
    checkRuns: Array.from({ length: 40 }, (_unused, index) => ({
      name: `check-run-with-a-long-name-${index}`,
      status: 'completed',
      conclusion: index % 2 === 0 ? 'failure' : 'success',
    })),
  };
}

/** A padded Linear issue with every optional field at its cap. */
function paddedIssue(index: number): ReturnType<typeof linearIssueNode> {
  return linearIssueNode({
    identifier: `ENGINEERING-${1_000 + index}`,
    title: `${'an extremely descriptive linear issue title that runs on '.repeat(3)}${index}`,
    state: { name: 'Blocked on external dependency review', type: 'started' },
    project: { name: 'Checkout and payments platform rearchitecture' },
    priorityLabel: 'Urgent',
    startedAt: '2026-04-01T00:00:00.000Z',
    inverseRelations: {
      nodes: Array.from({ length: 5 }, (_unused, blockerIndex) => ({
        type: 'blocks',
        issue: { identifier: `ENGINEERING-${2_000 + blockerIndex}`, state: { type: 'started' } },
      })),
    },
  });
}

describe('response budget', () => {
  it('get_my_review_queue stays under budget at max_results with both scopes padded', async () => {
    const { ctx } = createFakeContext({
      work: paddedGithub(30),
      personal: paddedGithub(30, 500),
    });

    const result = await getMyReviewQueue(ctx, { scope: 'both', max_results: 30 });

    expect(payloadChars(result)).toBeLessThanOrEqual(MAX_RESPONSE_CHARS);
    expect(result.items.length).toBeGreaterThan(0);
  });

  it('get_my_open_prs stays under budget with the review roll-up populated', async () => {
    const { ctx } = createFakeContext({
      work: paddedGithub(30),
      personal: paddedGithub(30, 500),
    });

    // Give every PR a long awaiting list, the roll-up's biggest contributor.
    for (const scope of ['work', 'personal'] as const) {
      const api = ctx.clients.github(scope);
      Object.defineProperty(api.pulls, 'get', {
        value: async (params: { owner: string; repo: string; pull_number: number }) => ({
          data: {
            title: LONG_TITLE,
            body: 'b'.repeat(9_000),
            state: 'open',
            additions: 99_999,
            deletions: 99_999,
            changed_files: 999,
            created_at: '2026-05-01T00:00:00.000Z',
            updated_at: '2026-05-02T00:00:00.000Z',
            html_url: `https://github.com/${params.owner}/${params.repo}/pull/${params.pull_number}`,
            user: { login: LONG_LOGIN },
            head: { sha: 'deadbeefdeadbeefdeadbeef' },
            requested_reviewers: Array.from({ length: 12 }, (_unused, index) => ({
              login: `reviewer-with-a-long-name-${index}`,
            })),
          },
        }),
      });
    }

    const result = await getMyOpenPrs(ctx, { scope: 'both', max_results: 30 });

    expect(payloadChars(result)).toBeLessThanOrEqual(MAX_RESPONSE_CHARS);
    expect(result.items.length).toBeGreaterThan(0);
  });

  it('get_pr_context stays under budget with every section saturated', async () => {
    const { ctx } = createFakeContext();
    const api = ctx.clients.github('work');

    Object.defineProperty(api.pulls, 'get', {
      value: async () => ({
        data: {
          title: LONG_TITLE,
          body: 'b'.repeat(20_000),
          state: 'open',
          additions: 99_999,
          deletions: 99_999,
          changed_files: 900,
          created_at: '2026-05-01T00:00:00.000Z',
          updated_at: '2026-05-02T00:00:00.000Z',
          html_url: `https://github.com/${LONG_REPO}/pull/999999`,
          user: { login: LONG_LOGIN },
          head: { sha: 'deadbeef' },
          requested_reviewers: Array.from({ length: 12 }, (_unused, index) => ({
            login: `reviewer-with-a-long-name-${index}`,
          })),
        },
      }),
    });
    Object.defineProperty(api.checks, 'listForRef', {
      value: async () => ({
        data: {
          total_count: 200,
          check_runs: Array.from({ length: 200 }, (_unused, index) => ({
            name: `a-very-long-check-run-name-for-monorepo-shard-${index}`,
            status: 'completed',
            conclusion: 'failure',
          })),
        },
      }),
    });
    Object.defineProperty(api.pulls, 'listReviews', {
      value: async () => ({
        data: Array.from({ length: 40 }, (_unused, index) => ({
          state: 'CHANGES_REQUESTED',
          submitted_at: '2026-05-02T00:00:00.000Z',
          user: { login: `reviewer-with-a-long-name-${index}` },
        })),
      }),
    });
    Object.defineProperty(api.pulls, 'listReviewComments', {
      value: async () => ({
        data: Array.from({ length: 80 }, (_unused, index) => ({
          body: 'c'.repeat(4_000),
          path: `src/very/deeply/nested/directory/structure/module-${index}/implementation.ts`,
          created_at: '2026-05-02T00:00:00.000Z',
          user: { login: `commenter-with-a-long-name-${index}` },
        })),
      }),
    });
    Object.defineProperty(api.pulls, 'listFiles', {
      value: async () => ({
        data: Array.from({ length: 100 }, (_unused, index) => ({
          filename: `src/very/deeply/nested/directory/structure/module-${index}/implementation.ts`,
          additions: 9_999,
          deletions: 9_999,
        })),
      }),
    });

    const result = await getPrContext(ctx, { scope: 'work', repo: LONG_REPO, number: 999_999 });

    expect(payloadChars(result)).toBeLessThanOrEqual(MAX_RESPONSE_CHARS);
  });

  it('get_my_linear_issues stays under budget at max_results', async () => {
    const issues = Array.from({ length: 50 }, (_unused, index) => paddedIssue(index));
    const { ctx } = createFakeContext({ linearHandler: linearHandlerFor({ issues, hasNextPage: true }) });

    const result = await getMyLinearIssues(ctx, { state_filter: 'all', max_results: 50 });

    expect(payloadChars(result)).toBeLessThanOrEqual(MAX_RESPONSE_CHARS);
    expect(result.items.length).toBeGreaterThan(0);
  });

  it('get_my_linear_issues stays under budget for blocked, where reasons are longest', async () => {
    const issues = Array.from({ length: 100 }, (_unused, index) => paddedIssue(index));
    const { ctx } = createFakeContext({ linearHandler: linearHandlerFor({ issues }) });

    const result = await getMyLinearIssues(ctx, { state_filter: 'blocked', max_results: 50 });

    expect(payloadChars(result)).toBeLessThanOrEqual(MAX_RESPONSE_CHARS);
    expect(result.items.every((item) => item.reason !== undefined)).toBe(true);
  });

  it('search_my_work stays under budget at max_results across three sources', async () => {
    const { ctx } = createFakeContext({
      work: paddedGithub(25),
      personal: paddedGithub(25, 500),
      linearHandler: linearHandlerFor({
        search: Array.from({ length: 25 }, (_unused, index) => paddedIssue(index)),
        searchTotal: 900,
      }),
    });

    const result = await searchMyWork(ctx, { query: 'checkout timeout', scope: 'both', max_results: 25 });

    expect(payloadChars(result)).toBeLessThanOrEqual(MAX_RESPONSE_CHARS);
    expect(result.items.length).toBeGreaterThan(0);
  });

  it('whats_blocked stays under budget with all three sections saturated', async () => {
    const { ctx } = createFakeContext({
      work: paddedGithub(30),
      personal: paddedGithub(30, 500),
      linearHandler: linearHandlerFor({
        issues: Array.from({ length: 100 }, (_unused, index) => paddedIssue(index)),
      }),
    });

    const result = await whatsBlocked(ctx);

    expect(payloadChars(result)).toBeLessThanOrEqual(MAX_RESPONSE_CHARS);
    // A saturated call must still answer both halves of the question.
    expect(result.waiting_on_reviewers.length).toBeGreaterThan(0);
    expect(result.you_are_blocking.length).toBeGreaterThan(0);
    expect(result.blocked_issues.length).toBeGreaterThan(0);
    expect(result.summary).toMatch(/waiting on reviewers/);
  });
});
