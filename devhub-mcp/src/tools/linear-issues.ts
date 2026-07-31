/**
 * Tool 4: `get_my_linear_issues` — Linear issues assigned to me.
 */

import { z } from 'zod';
import { cacheKey } from '../lib/cache.js';
import { describeFailure, type UpstreamFailure } from '../lib/errors.js';
import { buildEnvelope, type Envelope, type IssueItem } from '../lib/format.js';
import {
  blockedReason,
  buildIssueFilter,
  fetchAssignedIssues,
  toIssueItem,
  type LinearIssueNode,
  type StateFilter,
} from '../lib/linear.js';
import type { ToolContext } from '../clients.js';

export const TOOL_NAME = 'get_my_linear_issues';

const DEFAULT_MAX_RESULTS = 15;
const MAX_MAX_RESULTS = 50;

/**
 * How many issues to pull before client-side narrowing.
 *
 * `state_filter: "blocked"` cannot be expressed as a Linear filter, so blocked issues are
 * found by fetching active ones and testing each. Over-fetching keeps that accurate; the cap
 * bounds the cost, and hitting it is disclosed in `notes`.
 */
const BLOCKED_FETCH_CAP = 100;

export const linearIssuesInputSchema = {
  state_filter: z
    .enum(['active', 'blocked', 'all'])
    .default('active')
    .describe(
      'Which issues to include. "active" (default) = everything not completed or cancelled. "blocked" = only issues that are actually stuck: the workflow state is named like "Blocked", or another still-open issue blocks this one. "all" = including completed and cancelled.',
    ),
  max_results: z
    .number()
    .int()
    .min(1)
    .max(MAX_MAX_RESULTS)
    .default(DEFAULT_MAX_RESULTS)
    .describe(`Maximum issues to return (default ${DEFAULT_MAX_RESULTS}, max ${MAX_MAX_RESULTS}).`),
};

export const linearIssuesDescription = `Returns the Linear issues assigned to you — your ticket workload, resolved from the configured Linear account email.

Each item: identifier (e.g. "ENG-123"), title, state (the workflow state name), priority ("Urgent".."No priority"), project, days_in_state, and url. When state_filter is "blocked", each item also carries a reason explaining why it is blocked.

Use this for anything about the user's tickets, tasks, sprint work or Linear queue — "what am I working on?", "what tickets do I have?", "what's blocked in Linear?". This covers Linear only; it says nothing about pull requests. For a combined picture of everything stuck in both GitHub and Linear at once, use whats_blocked instead.

Note on "blocked": Linear has no built-in blocked state, so this tool treats an issue as blocked when its workflow state is named like "Blocked" OR another still-open issue blocks it. Closed blockers are ignored.

days_in_state counts whole days since the issue last changed workflow state.

Example: { "state_filter": "blocked" } -> just your genuinely stuck tickets, each with a reason.`;

export interface LinearIssuesArgs {
  readonly state_filter?: StateFilter | undefined;
  readonly max_results?: number | undefined;
}

function normalizeArgs(args: LinearIssuesArgs): { stateFilter: StateFilter; maxResults: number } {
  const requested = args.max_results ?? DEFAULT_MAX_RESULTS;
  return {
    stateFilter: args.state_filter ?? 'active',
    maxResults: Math.max(1, Math.min(Math.trunc(requested), MAX_MAX_RESULTS)),
  };
}

/** Newest-stalled first: the issue sitting longest in its current state leads. */
function byDaysInStateDesc(a: IssueItem, b: IssueItem): number {
  return b.days_in_state - a.days_in_state;
}

export async function getMyLinearIssues(
  ctx: ToolContext,
  args: LinearIssuesArgs,
): Promise<Envelope<IssueItem>> {
  const { stateFilter, maxResults } = normalizeArgs(args);

  return ctx.cache.wrap(cacheKey(TOOL_NAME, { stateFilter, maxResults }), async () => {
    const warnings: UpstreamFailure[] = [];
    const notes: string[] = [];
    const now = ctx.now();

    // Blocked-ness is decided client-side, so over-fetch before narrowing.
    const fetchCount = stateFilter === 'blocked' ? Math.max(maxResults, BLOCKED_FETCH_CAP) : maxResults;
    const filter = buildIssueFilter(ctx.clients.config.linearUserEmail, stateFilter);

    let nodes: readonly LinearIssueNode[] = [];
    let hasNextPage = false;
    try {
      const fetched = await fetchAssignedIssues(ctx.clients.linear, filter, fetchCount);
      nodes = fetched.nodes;
      hasNextPage = fetched.hasNextPage;
      if (fetched.degraded) {
        notes.push(
          'days_in_state is approximate: Linear did not accept the issue-history query, so it was derived from state timestamps.',
        );
      }
    } catch (error: unknown) {
      warnings.push(describeFailure('linear', error, now));
      return buildEnvelope({ items: [], totalFound: 0, warnings, notes });
    }

    let items: IssueItem[];
    if (stateFilter === 'blocked') {
      items = nodes
        .map((node) => ({ node, reason: blockedReason(node) }))
        .filter((entry): entry is { node: LinearIssueNode; reason: string } => entry.reason !== undefined)
        .map((entry) => toIssueItem(entry.node, now, entry.reason));

      if (nodes.length >= fetchCount) {
        notes.push(
          `Scanned the ${nodes.length} most recently updated active issues; older ones were not checked for blockers.`,
        );
      }
    } else {
      items = nodes.map((node) => toIssueItem(node, now));
    }

    items.sort(byDaysInStateDesc);
    const totalFound = items.length;
    const selected = items.slice(0, maxResults);

    if (hasNextPage && stateFilter !== 'blocked') {
      notes.push('More issues are assigned to you than were fetched; raise max_results to see further.');
    }

    return buildEnvelope({
      items: selected,
      totalFound,
      warnings,
      notes,
      ...(hasNextPage ? { forceHasMore: true } : {}),
    });
  });
}
