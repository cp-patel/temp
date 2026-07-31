/**
 * Tool 2: `get_my_open_prs` — open PRs I authored, with a review-state roll-up.
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

export const TOOL_NAME = 'get_my_open_prs';

const DEFAULT_MAX_RESULTS = 15;
const MAX_MAX_RESULTS = 30;

export const myPrsInputSchema = {
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
      `Maximum PRs to return (default ${DEFAULT_MAX_RESULTS}, max ${MAX_MAX_RESULTS}). Results are oldest-first, so a small cap keeps the most stale PRs.`,
    ),
};

export const myPrsDescription = `Returns the open pull requests YOU authored, oldest first, with the review state of each one rolled up. Answers "where do my PRs stand?" and "who do I need to chase?".

Each item: repo, number, title, author, age_days, additions/deletions, changed_files, ci, draft, url, source — plus the review roll-up: approvals (count of distinct approving reviewers), changes_requested (boolean), awaiting (logins of requested reviewers who have not reviewed yet), and days_since_activity (whole days since the last commit, review or review comment).

Use this when the user asks about their own PRs, whether anything of theirs is ready to merge, who has not reviewed yet, or what they should nudge. This is the mirror image of get_my_review_queue: that one is PRs waiting on the user, this one is PRs the user is waiting on others for. For one specific PR in depth, use get_pr_context.

Returns { items, total_found, has_more }, plus warnings if one account failed.

Example: { "scope": "both", "max_results": 10 } -> your ten stalest open PRs across work and personal, with who still owes a review.`;

export interface MyPrsArgs {
  readonly scope?: Scope | undefined;
  readonly max_results?: number | undefined;
}

interface Candidate {
  readonly scope: GithubScope;
  readonly createdAtMs: number;
  readonly item: GithubSearchItem;
}

function normalizeArgs(args: MyPrsArgs): { scope: Scope; maxResults: number } {
  const requested = args.max_results ?? DEFAULT_MAX_RESULTS;
  return {
    scope: args.scope ?? 'both',
    maxResults: Math.max(1, Math.min(Math.trunc(requested), MAX_MAX_RESULTS)),
  };
}

async function searchScope(
  ctx: ToolContext,
  scope: GithubScope,
  perPage: number,
): Promise<{ total: number; candidates: Candidate[] }> {
  const api = ctx.clients.github(scope);
  const login = loginFor(ctx.identity, scope);
  const qualifier = scopeQualifier(ctx.clients.config, scope);
  const q = `is:open is:pr archived:false author:${login} ${qualifier}`;

  const response = await api.search.issuesAndPullRequests({
    q,
    sort: 'created',
    order: 'asc',
    per_page: perPage,
    advanced_search: 'true',
  });

  return {
    total: response.data.total_count,
    candidates: response.data.items.map((item) => ({
      scope,
      createdAtMs: Date.parse(item.created_at),
      item,
    })),
  };
}

export interface ReviewSummary {
  readonly approvals: number;
  readonly changesRequested: boolean;
  readonly awaiting: string[];
  readonly lastActivityMs: number | undefined;
  /**
   * When changes were most recently requested, so "pushed since" can be decided exactly.
   * Required-but-nullable rather than optional: this is an internal shape, never serialised.
   */
  readonly changesRequestedAtMs: number | undefined;

}

/**
 * Collapse a PR's review history into a decision-ready summary.
 *
 * GitHub returns every review event ever submitted, including superseded ones, so only each
 * reviewer's *latest* substantive review counts. COMMENTED and PENDING reviews are ignored
 * for approval accounting — a reviewer who comments has not approved — but they do count as
 * activity.
 */
export function summarizeReviews(
  reviews: readonly { state: string; submitted_at?: string | null | undefined; user: { login: string } | null }[],
  requestedReviewers: readonly { login: string }[],
): ReviewSummary {
  const latestByReviewer = new Map<string, { state: string; at: number }>();
  let lastActivityMs: number | undefined;

  for (const review of reviews) {
    const login = review.user?.login;
    const at = review.submitted_at === null || review.submitted_at === undefined ? 0 : Date.parse(review.submitted_at);
    if (Number.isFinite(at) && at > 0 && (lastActivityMs === undefined || at > lastActivityMs)) {
      lastActivityMs = at;
    }
    if (login === undefined) continue;

    const state = review.state.toUpperCase();
    // Only APPROVED / CHANGES_REQUESTED / DISMISSED change a reviewer's standing.
    if (state !== 'APPROVED' && state !== 'CHANGES_REQUESTED' && state !== 'DISMISSED') continue;

    const previous = latestByReviewer.get(login);
    if (previous === undefined || at >= previous.at) latestByReviewer.set(login, { state, at });
  }

  let approvals = 0;
  let changesRequested = false;
  let changesRequestedAtMs: number | undefined;
  for (const { state, at } of latestByReviewer.values()) {
    if (state === 'APPROVED') approvals += 1;
    if (state === 'CHANGES_REQUESTED') {
      changesRequested = true;
      if (changesRequestedAtMs === undefined || at > changesRequestedAtMs) changesRequestedAtMs = at;
    }
  }

  // "Awaiting" = still formally requested and has not left a standing substantive review.
  //
  // A DISMISSED review is tracked above (it must supersede an earlier approval) but does NOT
  // count as responded: dismissal is precisely the act of voiding a review, and GitHub
  // re-requests the reviewer, so they genuinely still owe one.
  const responded = new Set(
    [...latestByReviewer.entries()]
      .filter(([, latest]) => latest.state !== 'DISMISSED')
      .map(([login]) => login),
  );
  const awaiting = requestedReviewers
    .map((reviewer) => reviewer.login)
    .filter((login) => !responded.has(login));

  return { approvals, changesRequested, awaiting, lastActivityMs, changesRequestedAtMs };
}

/**
 * Date of a PR's newest commit, from the head commit payload.
 *
 * Prefers the committer date (when the commit landed on the branch) over the author date
 * (when it was originally written), since a rebased or cherry-picked commit keeps an old
 * author date and would understate freshness.
 */
export function headCommitMs(commit: {
  author?: { date?: string | undefined } | null | undefined;
  committer?: { date?: string | undefined } | null | undefined;
}): number | undefined {
  const raw = commit.committer?.date ?? commit.author?.date;
  if (raw === undefined) return undefined;
  const at = Date.parse(raw);
  return Number.isFinite(at) ? at : undefined;
}

/** Number of reviewer logins to list before collapsing into a count. */
const MAX_AWAITING_SHOWN = 5;

/** The shape of a search hit before any follow-up requests. */
export function toUnenrichedItem(candidate: Candidate, now: number): PrItem {
  const { item, scope } = candidate;
  return {
    source: scope,
    repo: repoFromApiUrl(item.repository_url),
    number: item.number,
    title: truncateText(item.title, CAPS.title),
    author: item.user?.login ?? 'unknown',
    age_days: ageInDays(item.created_at, now),
    url: item.html_url,
    ...(item.draft === true ? { draft: true } : {}),
  };
}

export interface EnrichOptions {
  /**
   * Fetch CI status. `whats_blocked` sets this false because none of its staleness rules
   * consult CI, and skipping it removes one request per PR from an already fan-out-heavy call.
   */
  readonly includeCi: boolean;
}

async function enrich(
  api: GithubApi,
  candidate: Candidate,
  now: number,
  options: EnrichOptions,
): Promise<PrItem> {
  const base = toUnenrichedItem(candidate, now);
  const parts = splitRepo(base.repo);
  if (parts === undefined) return { ...base, ci: 'unknown' };
  const target = { owner: parts.owner, repo: parts.name, pull_number: candidate.item.number };

  try {
    const detail = await api.pulls.get(target);
    const [reviews, headCommit, ci] = await Promise.all([
      api.pulls.listReviews({ ...target, per_page: 100 }),
      api.repos.getCommit({ owner: parts.owner, repo: parts.name, ref: detail.data.head.sha }),
      options.includeCi
        ? ciSummary(api, parts.owner, parts.name, detail.data.head.sha)
        : Promise.resolve(undefined),
    ]);

    const summary = summarizeReviews(reviews.data, detail.data.requested_reviewers ?? []);
    const commitMs = headCommitMs(headCommit.data.commit);
    const activityCandidates = [summary.lastActivityMs, commitMs, Date.parse(detail.data.updated_at)].filter(
      (value): value is number => value !== undefined && Number.isFinite(value),
    );
    const lastActivity = activityCandidates.length > 0 ? Math.max(...activityCandidates) : undefined;

    // Did the author push after the most recent changes-requested review? Compared against the
    // head commit, so it is exact rather than inferred from a coarse activity timestamp.
    const pushedSinceReview =
      summary.changesRequestedAtMs !== undefined && commitMs !== undefined
        ? commitMs > summary.changesRequestedAtMs
        : undefined;

    const awaiting =
      summary.awaiting.length > MAX_AWAITING_SHOWN
        ? [...summary.awaiting.slice(0, MAX_AWAITING_SHOWN), `+${summary.awaiting.length - MAX_AWAITING_SHOWN} more`]
        : summary.awaiting;

    return {
      ...base,
      additions: detail.data.additions,
      deletions: detail.data.deletions,
      changed_files: detail.data.changed_files,
      ...(ci !== undefined ? { ci } : {}),
      approvals: summary.approvals,
      ...(summary.changesRequested ? { changes_requested: true } : {}),
      ...(pushedSinceReview !== undefined ? { pushed_since_review: pushedSinceReview } : {}),
      ...(awaiting.length > 0 ? { awaiting } : {}),
      ...(lastActivity !== undefined
        ? { days_since_activity: Math.max(0, Math.floor((now - lastActivity) / 86_400_000)) }
        : {}),
      ...(detail.data.draft === true ? { draft: true } : {}),
    };
  } catch {
    return { ...base, ci: 'unknown' };
  }
}

export interface AuthoredPrs {
  readonly items: PrItem[];
  readonly totalFound: number;
  readonly warnings: UpstreamFailure[];
}

/**
 * Search and enrich the PRs I authored, WITHOUT applying the response budget.
 *
 * Kept separate from `getMyOpenPrs` on purpose. The ~8,000-character budget governs what is
 * returned to a client; it must not govern intermediate data. `whats_blocked` composes this
 * list and then filters it, so trimming here would silently hide blocked PRs — measured, a
 * saturated 30-PR fetch trims to 14 items, which would have made over half of them invisible
 * to the blocked-detection rules.
 */
export async function collectAuthoredPrs(
  ctx: ToolContext,
  scope: Scope,
  maxResults: number,
  options: EnrichOptions,
): Promise<AuthoredPrs> {
  const scopes = resolveScopes(scope);
  const warnings: UpstreamFailure[] = [];
  const candidates: Candidate[] = [];
  let totalFound = 0;

  const searches = await Promise.all(
    scopes.map(async (current) => {
      try {
        return await searchScope(ctx, current, maxResults);
      } catch (error: unknown) {
        warnings.push(describeFailure(githubUpstream(current), error, ctx.now()));
        return undefined;
      }
    }),
  );

  for (const search of searches) {
    if (search === undefined) continue;
    totalFound += search.total;
    candidates.push(...search.candidates);
  }

  candidates.sort((a, b) => a.createdAtMs - b.createdAtMs);
  const selected = candidates.slice(0, maxResults);

  const now = ctx.now();
  const items = await mapLimit(selected, DEFAULT_CONCURRENCY, (candidate) =>
    enrich(ctx.clients.github(candidate.scope), candidate, now, options),
  );

  return { items, totalFound, warnings };
}

export async function getMyOpenPrs(
  ctx: ToolContext,
  args: MyPrsArgs,
  options: EnrichOptions = { includeCi: true },
): Promise<Envelope<PrItem>> {
  const { scope, maxResults } = normalizeArgs(args);

  return ctx.cache.wrap(cacheKey(TOOL_NAME, { scope, maxResults, ci: options.includeCi }), async () => {
    const { items, totalFound, warnings } = await collectAuthoredPrs(ctx, scope, maxResults, options);
    return buildEnvelope({ items, totalFound, warnings });
  });
}
