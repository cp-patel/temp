/**
 * Linear GraphQL layer.
 *
 * Uses raw GraphQL rather than the typed SDK helpers on purpose: on @linear/sdk's `Issue`
 * model, `state`, `project` and `assignee` are lazy `LinearFetch<T>` promises, so reading
 * them per issue costs one HTTP round trip each. One GraphQL document fetches everything at
 * once.
 *
 * Schema facts verified against @linear/sdk 89's generated types:
 *  - `IssueFilter.assignee` is a `NullableUserFilter`, whose `email` is a `StringComparator`.
 *  - `IssueFilter.state` is a `WorkflowStateFilter`, whose `type` is a `StringComparator`
 *    supporting `nin`.
 *  - `WorkflowState.type` is one of triage | backlog | unstarted | started | completed |
 *    canceled | duplicate. There is deliberately NO "blocked" type — see `blockedReason`.
 *  - `PaginationOrderBy` serialises as "createdAt" | "updatedAt".
 *  - `searchIssues(term:)` returns `IssueSearchPayload { totalCount, nodes, pageInfo }`.
 *    The older `issueSearch` is marked deprecated in the SDK, so it is not used here.
 */

import type { LinearApi } from '../clients.js';
import { ageInDays, priorityLabel, type IssueItem } from './format.js';
import { CAPS, truncateText } from './truncate.js';

/** State types that mean "this is finished, stop counting it". */
export const DONE_STATE_TYPES: ReadonlySet<string> = new Set(['completed', 'canceled', 'duplicate']);

/**
 * Linear has no native "blocked" state type, so a workflow state *named* like one is the
 * common convention. Matched case-insensitively ("Blocked", "blocked on review", ...).
 */
const BLOCKED_STATE_NAME = /blocked/i;

export interface LinearStateNode {
  readonly name: string;
  readonly type: string;
}

export interface LinearRelationNode {
  readonly type: string;
  readonly issue: { readonly identifier: string; readonly state: { readonly type: string } | null } | null;
}

export interface LinearIssueNode {
  readonly identifier: string;
  readonly title: string;
  readonly priority?: number | null;
  readonly priorityLabel?: string | null;
  readonly url: string;
  readonly createdAt: string;
  readonly updatedAt?: string | null;
  readonly startedAt?: string | null;
  readonly triagedAt?: string | null;
  readonly completedAt?: string | null;
  readonly canceledAt?: string | null;
  readonly state: LinearStateNode | null;
  readonly project: { readonly name: string } | null;
  readonly inverseRelations?: { readonly nodes: readonly LinearRelationNode[] } | null;
  readonly history?: { readonly nodes: readonly { readonly createdAt: string; readonly toState: { readonly id: string } | null }[] } | null;
}

export interface IssuesQueryResult {
  readonly issues: {
    readonly pageInfo: { readonly hasNextPage: boolean };
    readonly nodes: readonly LinearIssueNode[];
  } | null;
}

export interface SearchQueryResult {
  readonly searchIssues: {
    readonly totalCount: number;
    readonly nodes: readonly LinearIssueNode[];
  } | null;
}

/** Fields every Linear tool needs. Kept in one string so the shape cannot drift per query. */
const ISSUE_FIELDS = `
    identifier
    title
    priority
    priorityLabel
    url
    createdAt
    updatedAt
    startedAt
    triagedAt
    completedAt
    canceledAt
    state { name type }
    project { name }
    inverseRelations(first: 10) {
      nodes { type issue { identifier state { type } } }
    }`;

/**
 * Primary query.
 *
 * Two things here are deliberate:
 *  - `history(last: 20)` is what makes `days_in_state` exact, by finding the most recent
 *    workflow-state transition.
 *  - `$sort: [IssueSortInput!]` states the direction explicitly. `orderBy: PaginationOrderBy`
 *    names only a field, leaving the direction to Linear's default — and the direction decides
 *    *which* issues a capped scan sees, so it should not be left implicit.
 */
const MY_ISSUES_QUERY = `query DevhubMyIssues($filter: IssueFilter!, $first: Int!, $sort: [IssueSortInput!]) {
  issues(filter: $filter, first: $first, sort: $sort) {
    pageInfo { hasNextPage }
    nodes {${ISSUE_FIELDS}
      history(last: 20) {
        nodes { createdAt toState { id } }
      }
    }
  }
}`;

/** Same, minus `history` — see the fallback ladder in `fetchAssignedIssues`. */
const MY_ISSUES_QUERY_NO_HISTORY = `query DevhubMyIssuesBasic($filter: IssueFilter!, $first: Int!, $sort: [IssueSortInput!]) {
  issues(filter: $filter, first: $first, sort: $sort) {
    pageInfo { hasNextPage }
    nodes {${ISSUE_FIELDS}
    }
  }
}`;

/**
 * Last-resort variant using `orderBy` instead of `sort`.
 *
 * `orderBy` is the older, narrower parameter. If a workspace's schema rejects `sort` or
 * `IssueSortInput`, this still returns the right issues — just with Linear's default ordering
 * rather than an ordering we chose.
 */
const MY_ISSUES_QUERY_ORDER_BY = `query DevhubMyIssuesOrdered($filter: IssueFilter!, $first: Int!, $orderBy: PaginationOrderBy) {
  issues(filter: $filter, first: $first, orderBy: $orderBy) {
    pageInfo { hasNextPage }
    nodes {${ISSUE_FIELDS}
    }
  }
}`;

// `searchIssues` accepts an IssueFilter alongside the term (verified in the SDK's generated
// SearchIssuesQueryVariables). Leaving $filter unset is valid GraphQL for a nullable variable.
const SEARCH_ISSUES_QUERY = `query DevhubSearchIssues($term: String!, $first: Int!, $filter: IssueFilter) {
  searchIssues(term: $term, first: $first, filter: $filter) {
    totalCount
    nodes {${ISSUE_FIELDS}
    }
  }
}`;

export type StateFilter = 'active' | 'blocked' | 'all';

/**
 * Server-side issue filter.
 *
 * "blocked" cannot be expressed as a Linear filter (it is a state-name convention plus a
 * relation), so it reuses the "active" filter and is narrowed client-side by `blockedReason`.
 */
export function buildIssueFilter(email: string, stateFilter: StateFilter): Record<string, unknown> {
  const assignee = { email: { eq: email } };
  if (stateFilter === 'all') return { assignee };
  return { assignee, state: { type: { nin: ['completed', 'canceled'] } } };
}

export interface FetchIssuesResult {
  readonly nodes: readonly LinearIssueNode[];
  readonly hasNextPage: boolean;
  /** True when the reduced query was used, so `days_in_state` is approximate. */
  readonly degraded: boolean;
}

/**
 * Fetch assigned issues in one round trip, falling back to the reduced query on rejection.
 *
 * The retry runs only on the error path, so the happy path stays at exactly one request. If
 * the fallback also fails, the *original* error is thrown, since it describes the real cause.
 */
/**
 * Read the `issues` connection, refusing to treat a missing payload as "no issues".
 *
 * A GraphQL response can carry `data: null` alongside an `errors` array. Coalescing that to an
 * empty list would report "you have no issues assigned" during an outage, which is a wrong
 * answer rather than a reported failure — so this throws and lets the caller surface a warning.
 */
function readIssuesPayload(response: { data?: IssuesQueryResult | undefined }): {
  nodes: readonly LinearIssueNode[];
  hasNextPage: boolean;
} {
  const issues = response.data?.issues;
  if (issues === undefined || issues === null) {
    throw new Error('Linear returned no issues payload');
  }
  return { nodes: issues.nodes, hasNextPage: issues.pageInfo.hasNextPage };
}

export async function fetchAssignedIssues(
  linear: LinearApi,
  filter: Record<string, unknown>,
  first: number,
): Promise<FetchIssuesResult> {
  // Most recently updated first, stated explicitly rather than inherited from a default.
  const sortVariables = { filter, first, sort: [{ updatedAt: { order: 'Descending' } }] };
  const orderByVariables = { filter, first, orderBy: 'updatedAt' };

  /**
   * Attempts, best first. Only the failure path costs extra requests, so the happy path stays
   * at exactly one round trip. `history` and `sort` are the two parts of the document that
   * could not be exercised against a live API during development, so each has a rung below it:
   * a schema disagreement degrades a single field rather than failing the whole tool.
   */
  const attempts: readonly { query: string; variables: Record<string, unknown>; degraded: boolean }[] = [
    { query: MY_ISSUES_QUERY, variables: sortVariables, degraded: false },
    { query: MY_ISSUES_QUERY_NO_HISTORY, variables: sortVariables, degraded: true },
    { query: MY_ISSUES_QUERY_ORDER_BY, variables: orderByVariables, degraded: true },
  ];

  let firstError: unknown;
  for (const attempt of attempts) {
    try {
      const response = await linear.rawRequest<IssuesQueryResult>(attempt.query, attempt.variables);
      return { ...readIssuesPayload(response), degraded: attempt.degraded };
    } catch (error: unknown) {
      // Report the first failure, not the last: it describes the real cause (auth, rate limit)
      // rather than the symptom of a fallback that was never going to work either.
      if (firstError === undefined) firstError = error;
    }
  }
  throw firstError;
}

/** Free-text issue search. `searchIssues` reports a real `totalCount`, unlike `issues`. */
export async function searchIssues(
  linear: LinearApi,
  term: string,
  first: number,
  filter?: Record<string, unknown>,
): Promise<{ nodes: readonly LinearIssueNode[]; totalCount: number }> {
  const variables: Record<string, unknown> = { term, first };
  if (filter !== undefined) variables.filter = filter;
  const response = await linear.rawRequest<SearchQueryResult>(SEARCH_ISSUES_QUERY, variables);
  const payload = response.data?.searchIssues;
  // As above: a missing payload is a failure to report, not an empty result set.
  if (payload === undefined || payload === null) {
    throw new Error('Linear returned no search payload');
  }
  return { nodes: payload.nodes, totalCount: payload.totalCount };
}

/** Timestamp of the most recent workflow-state transition, when history is available. */
function latestStateChangeAt(node: LinearIssueNode): string | undefined {
  const entries = node.history?.nodes ?? [];
  let newest: string | undefined;
  for (const entry of entries) {
    if (entry.toState === null) continue;
    if (newest === undefined || Date.parse(entry.createdAt) > Date.parse(newest)) {
      newest = entry.createdAt;
    }
  }
  return newest;
}

/**
 * Dedicated timestamp for the current state type.
 *
 * Exact for started/completed/canceled/triage. Linear keeps no equivalent marker for
 * backlog or unstarted, so those fall through to the issue's creation time.
 */
function stateTypeTimestamp(node: LinearIssueNode): string | undefined {
  switch (node.state?.type) {
    case 'started':
      return node.startedAt ?? undefined;
    case 'completed':
      return node.completedAt ?? undefined;
    case 'canceled':
      return node.canceledAt ?? undefined;
    case 'triage':
      return node.triagedAt ?? undefined;
    default:
      return undefined;
  }
}

/**
 * Whole days the issue has sat in its current workflow state.
 *
 * Prefers the real transition from `history`; otherwise uses the state's dedicated
 * timestamp; otherwise falls back to creation time. `createdAt` rather than `updatedAt` is
 * the last resort deliberately — `updatedAt` moves on any edit (a comment, a label) and
 * would make a long-stalled issue look freshly touched.
 */
export function daysInCurrentState(node: LinearIssueNode, now: number): number {
  const anchor = latestStateChangeAt(node) ?? stateTypeTimestamp(node) ?? node.createdAt;
  return ageInDays(anchor, now);
}

/**
 * Why this issue counts as blocked, or undefined if it does not.
 *
 * Linear exposes no "blocked" state type, so blocking is detected two ways (both, OR'd):
 *  1. the workflow state is *named* like "Blocked";
 *  2. an inverse relation of type `blocks` exists — i.e. another issue blocks this one.
 *
 * Blockers that are already completed/canceled are ignored: a closed blocker no longer
 * blocks anything, and counting it would keep issues "blocked" forever.
 */
export function blockedReason(node: LinearIssueNode): string | undefined {
  const openBlockers = (node.inverseRelations?.nodes ?? [])
    .filter((relation) => relation.type === 'blocks')
    .map((relation) => relation.issue)
    .filter((issue): issue is NonNullable<LinearRelationNode['issue']> => issue !== null && issue !== undefined)
    .filter((issue) => !DONE_STATE_TYPES.has(issue.state?.type ?? ''));

  if (openBlockers.length > 0) {
    const shown = openBlockers.slice(0, 3).map((issue) => issue.identifier).join(', ');
    const extra = openBlockers.length > 3 ? ` +${openBlockers.length - 3} more` : '';
    return `blocked by ${shown}${extra}`;
  }

  if (node.state !== null && BLOCKED_STATE_NAME.test(node.state.name)) {
    return `state is "${truncateText(node.state.name, CAPS.label)}"`;
  }

  return undefined;
}

/** Map a raw GraphQL node onto the compact shared issue shape. */
export function toIssueItem(node: LinearIssueNode, now: number, reason?: string): IssueItem {
  const item: IssueItem = {
    identifier: node.identifier,
    title: truncateText(node.title, CAPS.title),
    state: truncateText(node.state?.name ?? 'unknown', CAPS.label),
    priority:
      node.priorityLabel !== null && node.priorityLabel !== undefined && node.priorityLabel !== ''
        ? truncateText(node.priorityLabel, CAPS.label)
        : priorityLabel(node.priority),
    days_in_state: daysInCurrentState(node, now),
    url: node.url,
    ...(node.project?.name !== undefined ? { project: truncateText(node.project.name, CAPS.label) } : {}),
    ...(reason !== undefined ? { reason } : {}),
  };
  return item;
}
