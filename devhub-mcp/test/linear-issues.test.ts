/**
 * `get_my_linear_issues` plus the Linear helper layer.
 *
 * The blocked-state logic gets the most attention here, because Linear has no native blocked
 * state and the whole feature rests on a convention plus a relation.
 */

import { describe, expect, it } from 'vitest';
import { getMyLinearIssues } from '../src/tools/linear-issues.js';
import { blockedReason, buildIssueFilter, daysInCurrentState, toIssueItem } from '../src/lib/linear.js';
import { createFakeContext, linearHandlerFor, linearIssueNode, FIXED_NOW } from './helpers/fakes.js';

describe('buildIssueFilter', () => {
  it('always filters by the configured assignee email', () => {
    expect(buildIssueFilter('me@example.com', 'active')).toMatchObject({
      assignee: { email: { eq: 'me@example.com' } },
    });
  });

  it('excludes finished work for "active"', () => {
    expect(buildIssueFilter('me@example.com', 'active')).toMatchObject({
      state: { type: { nin: ['completed', 'canceled'] } },
    });
  });

  it('applies no state filter for "all"', () => {
    expect(buildIssueFilter('me@example.com', 'all').state).toBeUndefined();
  });

  it('reuses the active filter for "blocked", which is narrowed client-side', () => {
    expect(buildIssueFilter('me@example.com', 'blocked')).toEqual(buildIssueFilter('me@example.com', 'active'));
  });
});

describe('blockedReason', () => {
  it('detects a workflow state named like Blocked, case-insensitively', () => {
    expect(blockedReason(linearIssueNode({ state: { name: 'Blocked', type: 'started' } }))).toMatch(/state is "Blocked"/);
    expect(blockedReason(linearIssueNode({ state: { name: 'blocked on design', type: 'started' } }))).toBeDefined();
  });

  it('detects an inverse "blocks" relation', () => {
    const node = linearIssueNode({
      inverseRelations: { nodes: [{ type: 'blocks', issue: { identifier: 'ENG-9', state: { type: 'started' } } }] },
    });
    expect(blockedReason(node)).toBe('blocked by ENG-9');
  });

  it('ignores blockers that are already completed or cancelled', () => {
    const node = linearIssueNode({
      inverseRelations: {
        nodes: [
          { type: 'blocks', issue: { identifier: 'ENG-9', state: { type: 'completed' } } },
          { type: 'blocks', issue: { identifier: 'ENG-10', state: { type: 'canceled' } } },
        ],
      },
    });
    // A closed blocker no longer blocks anything.
    expect(blockedReason(node)).toBeUndefined();
  });

  it('ignores relation types that are not "blocks"', () => {
    const node = linearIssueNode({
      inverseRelations: { nodes: [{ type: 'related', issue: { identifier: 'ENG-9', state: { type: 'started' } } }] },
    });
    expect(blockedReason(node)).toBeUndefined();
  });

  it('collapses more than three blockers', () => {
    const node = linearIssueNode({
      inverseRelations: {
        nodes: Array.from({ length: 5 }, (_unused, index) => ({
          type: 'blocks',
          issue: { identifier: `ENG-${index}`, state: { type: 'started' } },
        })),
      },
    });
    expect(blockedReason(node)).toBe('blocked by ENG-0, ENG-1, ENG-2 +2 more');
  });

  it('returns undefined for an ordinary in-progress issue', () => {
    expect(blockedReason(linearIssueNode())).toBeUndefined();
  });

  it('prefers the concrete blocker over the state-name heuristic', () => {
    const node = linearIssueNode({
      state: { name: 'Blocked', type: 'started' },
      inverseRelations: { nodes: [{ type: 'blocks', issue: { identifier: 'ENG-9', state: { type: 'started' } } }] },
    });
    // Naming the actual blocker is strictly more useful than restating the column.
    expect(blockedReason(node)).toBe('blocked by ENG-9');
  });
});

describe('daysInCurrentState', () => {
  it('prefers the newest real state transition from history', () => {
    const node = linearIssueNode({
      startedAt: '2026-07-01T00:00:00.000Z',
      history: {
        nodes: [
          { createdAt: '2026-07-05T00:00:00.000Z', toState: { id: 's1' } },
          { createdAt: '2026-07-29T00:00:00.000Z', toState: { id: 's2' } },
          // A non-state edit must not count as a transition.
          { createdAt: '2026-07-30T00:00:00.000Z', toState: null },
        ],
      },
    });
    expect(daysInCurrentState(node, FIXED_NOW)).toBe(2);
  });

  it('falls back to the state-specific timestamp when history is absent', () => {
    expect(daysInCurrentState(linearIssueNode({ startedAt: '2026-07-24T00:00:00.000Z' }), FIXED_NOW)).toBe(7);
  });

  it('uses triagedAt for triage state', () => {
    const node = linearIssueNode({
      state: { name: 'Triage', type: 'triage' },
      triagedAt: '2026-07-30T00:00:00.000Z',
      startedAt: null,
    });
    expect(daysInCurrentState(node, FIXED_NOW)).toBe(1);
  });

  it('falls back to createdAt for backlog, not updatedAt', () => {
    const node = linearIssueNode({
      state: { name: 'Backlog', type: 'backlog' },
      createdAt: '2026-07-01T00:00:00.000Z',
      // A recent comment moves updatedAt; using it would hide a month of staleness.
      updatedAt: '2026-07-31T00:00:00.000Z',
      startedAt: null,
    });
    expect(daysInCurrentState(node, FIXED_NOW)).toBe(30);
  });
});

describe('toIssueItem', () => {
  it("uses Linear's own priority label when present", () => {
    expect(toIssueItem(linearIssueNode({ priorityLabel: 'Urgent' }), FIXED_NOW).priority).toBe('Urgent');
  });

  it('falls back to a derived label when Linear omits one', () => {
    expect(toIssueItem(linearIssueNode({ priorityLabel: null, priority: 1 }), FIXED_NOW).priority).toBe('urgent');
  });

  it('omits project entirely when there is none', () => {
    const item = toIssueItem(linearIssueNode({ project: null }), FIXED_NOW);
    expect('project' in item).toBe(false);
  });
});

describe('get_my_linear_issues', () => {
  it('returns assigned issues with the compact shape', async () => {
    const { ctx } = createFakeContext({
      linearHandler: linearHandlerFor({ issues: [linearIssueNode({ identifier: 'ENG-42' })] }),
    });

    const result = await getMyLinearIssues(ctx, {});
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      identifier: 'ENG-42',
      state: 'In Progress',
      priority: 'High',
      project: 'Checkout',
    });
  });

  it('narrows to genuinely blocked issues when asked', async () => {
    const { ctx } = createFakeContext({
      linearHandler: linearHandlerFor({
        issues: [
          linearIssueNode({ identifier: 'ENG-1' }),
          linearIssueNode({ identifier: 'ENG-2', state: { name: 'Blocked', type: 'started' } }),
          linearIssueNode({
            identifier: 'ENG-3',
            inverseRelations: { nodes: [{ type: 'blocks', issue: { identifier: 'ENG-99', state: { type: 'started' } } }] },
          }),
        ],
      }),
    });

    const result = await getMyLinearIssues(ctx, { state_filter: 'blocked' });
    const ids = result.items.map((item) => item.identifier).sort();

    expect(ids).toEqual(['ENG-2', 'ENG-3']);
    expect(result.items.every((item) => item.reason !== undefined)).toBe(true);
  });

  it('sorts most-stalled first', async () => {
    const { ctx } = createFakeContext({
      linearHandler: linearHandlerFor({
        issues: [
          linearIssueNode({ identifier: 'FRESH', startedAt: '2026-07-30T00:00:00.000Z' }),
          linearIssueNode({ identifier: 'STALE', startedAt: '2026-06-01T00:00:00.000Z' }),
        ],
      }),
    });

    const result = await getMyLinearIssues(ctx, {});
    expect(result.items.map((item) => item.identifier)).toEqual(['STALE', 'FRESH']);
  });

  it('degrades to the reduced query and discloses it when history is rejected', async () => {
    const { ctx, linear } = createFakeContext({
      linearHandler: linearHandlerFor({
        issues: [linearIssueNode({ startedAt: '2026-07-24T00:00:00.000Z' })],
        rejectHistory: true,
      }),
    });

    const result = await getMyLinearIssues(ctx, {});

    // Two requests: the rejected full query, then the reduced one.
    expect(linear.calls).toHaveLength(2);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.days_in_state).toBe(7);
    expect(result.notes?.join(' ')).toMatch(/days_in_state is approximate/);
  });

  it('reports a Linear outage as a warning rather than throwing', async () => {
    const { ctx } = createFakeContext({
      linearHandler: linearHandlerFor({
        rejectAll: Object.assign(new Error('unauthorized'), { status: 401 }),
      }),
    });

    const result = await getMyLinearIssues(ctx, {});

    expect(result.items).toEqual([]);
    expect(result.warnings?.[0]?.upstream).toBe('linear');
    expect(result.warnings?.[0]?.hint).toContain('LINEAR_API_KEY');
  });

  it('flags that more issues exist upstream', async () => {
    const { ctx } = createFakeContext({
      linearHandler: linearHandlerFor({ issues: [linearIssueNode()], hasNextPage: true }),
    });

    const result = await getMyLinearIssues(ctx, {});
    expect(result.has_more).toBe(true);
    expect(result.notes?.join(' ')).toMatch(/raise max_results/);
  });

  it('discloses when the blocked scan hit its fetch cap', async () => {
    const many = Array.from({ length: 100 }, (_unused, index) =>
      linearIssueNode({ identifier: `ENG-${index}`, state: { name: 'Blocked', type: 'started' } }),
    );
    const { ctx } = createFakeContext({ linearHandler: linearHandlerFor({ issues: many }) });

    const result = await getMyLinearIssues(ctx, { state_filter: 'blocked' });
    expect(result.notes?.join(' ')).toMatch(/older ones were not checked/);
  });
});
