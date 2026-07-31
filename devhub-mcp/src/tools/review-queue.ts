/**
 * Tool 1: `get_my_review_queue` — open PRs waiting on my review, oldest first.
 */

import { z } from 'zod';
import { cacheKey } from '../lib/cache.js';
import { DEFAULT_CONCURRENCY, mapLimit } from '../lib/concurrency.js';
import { describeFailure, githubUpstream, type UpstreamFailure } from '../lib/errors.js';
import {
  ageInDays,
  buildEnvelope,
  repoFromApiUrl,
  splitRepo,
  type Envelope,
  type PrItem,
} from '../lib/format.js';
import { ciSummary } from '../lib/github.js';
import { CAPS, truncateText } from '../lib/truncate.js';
import {
  loginFor,
  resolveScopes,
  scopeQualifier,
  type GithubApi,
  type GithubScope,
  type GithubSearchItem,
  type Scope,
  type ToolContext,
} from '../clients.js';

export const TOOL_NAME = 'get_my_review_queue';

const DEFAULT_MAX_RESULTS = 15;
const MAX_MAX_RESULTS = 30;

export const reviewQueueInputSchema = {
  scope: z
    .enum(['work', 'personal', 'both'])
    .default('both')
    .describe(
      'Which GitHub account to query. "work" = the work org only, "personal" = your personal repos only, "both" (default) = query both accounts separately and tag every result with its `source`.',
    ),
  max_results: z
    .number()
    .int()
    .min(1)
    .max(MAX_MAX_RESULTS)
    .default(DEFAULT_MAX_RESULTS)
    .describe(
      `Maximum PRs to return (default ${DEFAULT_MAX_RESULTS}, max ${MAX_MAX_RESULTS}). Results are oldest-first, so a small cap keeps the most stale reviews.`,
    ),
};

export const reviewQueueDescription = `Returns the open pull requests that are waiting on YOUR review, oldest first. Answers "what should I review today?" in one call.

Each item is already digested — no follow-up calls needed to triage: repo ("owner/name"), PR number, title, author, age_days, additions/deletions, changed_files, ci (short status like "passing", "failing (2/14)", "pending"), draft flag, url, and source ("work" or "personal") identifying which GitHub account it came from.

Use this when the user asks what they need to review, what is waiting on them, what their review backlog looks like, or who they are holding up. Do NOT use this for PRs the user wrote themselves — that is get_my_open_prs. To dig into one specific PR from these results, follow up with get_pr_context. To find out what is stuck in both directions at once, prefer whats_blocked.

Returns { items, total_found, has_more }, plus a warnings array if one account failed while the other succeeded.

Example: { "scope": "work", "max_results": 5 } -> the five stalest work PRs awaiting your review.`;

export interface ReviewQueueArgs {
  readonly scope?: Scope | undefined;
  readonly max_results?: number | undefined;
}

/** A search hit plus the timestamp we sort on, before enrichment. */
interface Candidate {
  readonly scope: GithubScope;
  readonly createdAtMs: number;
  readonly item: GithubSearchItem;
}

function normalizeArgs(args: ReviewQueueArgs): { scope: Scope; maxResults: number } {
  const requested = args.max_results ?? DEFAULT_MAX_RESULTS;
  return {
    scope: args.scope ?? 'both',
    maxResults: Math.max(1, Math.min(Math.trunc(requested), MAX_MAX_RESULTS)),
  };
}

/**
 * Search one scope for PRs awaiting my review.
 *
 * Verified live against GitHub search: `review-requested:<login>` with `is:open is:pr` and
 * `archived:false` is accepted (an invalid qualifier returns 422). `advanced_search` is
 * required since GitHub's 2025 issues-search migration.
 */
async function searchScope(
  ctx: ToolContext,
  scope: GithubScope,
  perPage: number,
): Promise<{ total: number; candidates: Candidate[] }> {
  const api = ctx.clients.github(scope);
  const login = loginFor(ctx.identity, scope);
  const qualifier = scopeQualifier(ctx.clients.config, scope);
  const q = `is:open is:pr archived:false review-requested:${login} ${qualifier}`;

  const response = await api.search.issuesAndPullRequests({
    q,
    sort: 'created',
    order: 'asc',
    per_page: perPage,
    advanced_search: 'true',
  });

  const candidates = response.data.items.map((item) => ({
    scope,
    createdAtMs: Date.parse(item.created_at),
    item,
  }));

  return { total: response.data.total_count, candidates };
}

/**
 * Add diff stats and CI state to one search hit.
 *
 * Enrichment failure degrades a single row instead of failing the call: the PR is still
 * listed, with `ci: "unknown"` and no diff stats.
 */
async function enrich(api: GithubApi, candidate: Candidate, now: number): Promise<PrItem> {
  const { item, scope } = candidate;
  const repo = repoFromApiUrl(item.repository_url);

  const base: PrItem = {
    source: scope,
    repo,
    number: item.number,
    title: truncateText(item.title, CAPS.title),
    author: item.user?.login ?? 'unknown',
    age_days: ageInDays(item.created_at, now),
    url: item.html_url,
    ...(item.draft === true ? { draft: true } : {}),
  };

  const parts = splitRepo(repo);
  if (parts === undefined) return { ...base, ci: 'unknown' };

  try {
    const detail = await api.pulls.get({
      owner: parts.owner,
      repo: parts.name,
      pull_number: item.number,
    });
    const ci = await ciSummary(api, parts.owner, parts.name, detail.data.head.sha);
    return {
      ...base,
      additions: detail.data.additions,
      deletions: detail.data.deletions,
      changed_files: detail.data.changed_files,
      ci,
      ...(detail.data.draft === true ? { draft: true } : {}),
    };
  } catch {
    return { ...base, ci: 'unknown' };
  }
}

/**
 * Build the review queue.
 *
 * Search results are merged, sorted and trimmed *before* enrichment, so a `scope: "both"`
 * call with max_results 15 enriches 15 PRs rather than 30.
 */
export async function getMyReviewQueue(ctx: ToolContext, args: ReviewQueueArgs): Promise<Envelope<PrItem>> {
  const { scope, maxResults } = normalizeArgs(args);

  return ctx.cache.wrap(cacheKey(TOOL_NAME, { scope, maxResults }), async () => {
    const scopes = resolveScopes(scope);
    const warnings: UpstreamFailure[] = [];
    const candidates: Candidate[] = [];
    let totalFound = 0;

    // Partial failure must not sink the whole call (ground rule: warnings, not exceptions).
    const searches = await Promise.all(
      scopes.map(async (current) => {
        try {
          return { scope: current, result: await searchScope(ctx, current, maxResults) };
        } catch (error: unknown) {
          warnings.push(describeFailure(githubUpstream(current), error, ctx.now()));
          return undefined;
        }
      }),
    );

    for (const search of searches) {
      if (search === undefined) continue;
      totalFound += search.result.total;
      candidates.push(...search.result.candidates);
    }

    candidates.sort((a, b) => a.createdAtMs - b.createdAtMs);
    const selected = candidates.slice(0, maxResults);

    const now = ctx.now();
    const items = await mapLimit(selected, DEFAULT_CONCURRENCY, (candidate) =>
      enrich(ctx.clients.github(candidate.scope), candidate, now),
    );

    return buildEnvelope({ items, totalFound, warnings });
  });
}
