/**
 * Tool 3: `get_pr_context` — everything about one PR, in a single call.
 *
 * Never returns the raw diff. Per-file additions/deletions only.
 */

import { z } from 'zod';
import { cacheKey } from '../lib/cache.js';
import { describeFailure, githubUpstream, type UpstreamFailure } from '../lib/errors.js';
import { ageInDays, splitRepo, toolError } from '../lib/format.js';
import { checkDetails, type CheckDetail } from '../lib/github.js';
import { CAPS, MAX_RESPONSE_CHARS, payloadChars, truncateBody, truncateText } from '../lib/truncate.js';
import { summarizeReviews } from './my-prs.js';
import type { GithubScope, ToolContext } from '../clients.js';

export const TOOL_NAME = 'get_pr_context';

/** Caps chosen so a worst-case bundle still fits the ~8,000-character response budget. */
const MAX_FILES = 25;
const MAX_CHECKS = 20;
const MAX_REVIEW_COMMENTS = 5;
const MAX_REVIEWERS = 15;

export const prContextInputSchema = {
  scope: z
    .enum(['work', 'personal'])
    .describe(
      'Which GitHub account owns this repo: "work" for the work org, "personal" for your own repos. Required — there is no default, because the two accounts use separate credentials. If a call returns "not found", the other scope is usually the answer.',
    ),
  repo: z
    .string()
    .min(3)
    .describe('Repository in "owner/name" form, exactly as returned in the `repo` field of the other tools, e.g. "acme/web".'),
  number: z.number().int().positive().describe('The pull request number, e.g. 4821.'),
  include_diff_stats: z
    .boolean()
    .default(true)
    .describe(
      'Include per-file additions/deletions (default true). Set false when you only need the discussion, reviews and CI state — it saves one request and shortens the response.',
    ),
};

export const prContextDescription = `Returns one pull request in depth, as a single pre-assembled bundle: title, truncated body, author, state, age_days, draft flag, url; CI status per check (name + conclusion); a review summary listing each reviewer with their latest state; who is still awaiting review; the last ${MAX_REVIEW_COMMENTS} review comments (author, truncated body, file path); and per-file diff stats (path, additions, deletions) capped at ${MAX_FILES} files with a files_omitted count.

Use this when the user asks about a specific PR — "what's going on with acme/web#4821?", "why is that PR stuck?", "what did reviewers say?" — or to follow up on any single item returned by get_my_review_queue or get_my_open_prs. Do not call it in a loop over a list; the list tools already return enough to triage.

This tool NEVER returns the raw diff, only per-file line counts. If you need to read the actual code changes, open the PR's /files page in a browser instead — say so rather than trying another tool.

Example: { "scope": "work", "repo": "acme/web", "number": 4821 }`;

export interface PrContextArgs {
  readonly scope: GithubScope;
  readonly repo: string;
  readonly number: number;
  readonly include_diff_stats?: boolean | undefined;
}

export interface ReviewerState {
  readonly reviewer: string;
  readonly state: string;
}

export interface ReviewCommentSummary {
  readonly author: string;
  readonly path: string;
  readonly body: string;
}

export interface FileStat {
  readonly path: string;
  readonly additions: number;
  readonly deletions: number;
}

export interface PrContext {
  readonly repo: string;
  readonly number: number;
  readonly title: string;
  readonly author: string;
  readonly state: string;
  readonly draft: boolean;
  readonly age_days: number;
  readonly url: string;
  readonly body: string;
  readonly additions: number;
  readonly deletions: number;
  readonly changed_files: number;
  readonly ci: CheckDetail[];
  readonly checks_omitted?: number;
  readonly reviews: ReviewerState[];
  readonly approvals: number;
  readonly changes_requested: boolean;
  readonly awaiting: string[];
  readonly recent_review_comments: ReviewCommentSummary[];
  readonly files?: FileStat[];
  readonly files_omitted?: number;
  readonly warnings?: UpstreamFailure[];
  readonly notes?: string[];
}

/** States that actually decide a review's outcome. COMMENTED and PENDING do not. */
const SUBSTANTIVE_STATES: ReadonlySet<string> = new Set(['APPROVED', 'CHANGES_REQUESTED', 'DISMISSED']);

/**
 * Each reviewer's standing review state.
 *
 * Reports the latest *substantive* state rather than the literally-latest event: a reviewer who
 * approves and then leaves a comment has still approved, and showing "commented" would hide
 * that. Reviewers who only ever commented fall back to that, so they are not misreported as
 * having decided anything.
 */
function reviewerStates(
  reviews: readonly { state: string; submitted_at?: string | null | undefined; user: { login: string } | null }[],
): ReviewerState[] {
  const latest = new Map<string, { state: string; at: number }>();
  for (const review of reviews) {
    const login = review.user?.login;
    if (login === undefined) continue;
    const at = review.submitted_at === null || review.submitted_at === undefined ? 0 : Date.parse(review.submitted_at);
    const state = review.state.toUpperCase();
    const previous = latest.get(login);

    if (previous === undefined) {
      latest.set(login, { state, at });
      continue;
    }
    // A substantive state never loses to a later non-substantive one.
    if (SUBSTANTIVE_STATES.has(previous.state) && !SUBSTANTIVE_STATES.has(state)) continue;
    // A non-substantive state always yields to a substantive one, whenever it arrived.
    if (!SUBSTANTIVE_STATES.has(previous.state) && SUBSTANTIVE_STATES.has(state)) {
      latest.set(login, { state, at });
      continue;
    }
    if (at >= previous.at) latest.set(login, { state, at });
  }
  // Rank before truncating: on a PR with dozens of reviewers, an arbitrary 15 could omit the
  // one person blocking the merge. Blockers first, then approvals, then everything else.
  const rank = (state: string): number => {
    if (state === 'CHANGES_REQUESTED') return 0;
    if (state === 'APPROVED') return 1;
    return 2;
  };

  return [...latest.entries()]
    .sort(([, a], [, b]) => rank(a.state) - rank(b.state) || b.at - a.at)
    .slice(0, MAX_REVIEWERS)
    .map(([reviewer, { state }]) => ({ reviewer, state: state.toLowerCase() }));
}

/**
 * Assemble the bundle.
 *
 * Returns a `CallToolResult` on hard failure (bad repo, PR unreachable) because unlike the
 * list tools there is no partial result worth returning — but a *sub*-request failing
 * (files, comments, checks) only removes that section and records a warning.
 */
export async function getPrContext(
  ctx: ToolContext,
  args: PrContextArgs,
): Promise<PrContext | ReturnType<typeof toolError>> {
  const includeDiffStats = args.include_diff_stats ?? true;
  const parts = splitRepo(args.repo);

  if (parts === undefined) {
    return toolError(
      [{ upstream: githubUpstream(args.scope), hint: `repo must be in "owner/name" form; received "${truncateText(args.repo, 60)}"` }],
      'Use the `repo` value exactly as returned by get_my_review_queue or get_my_open_prs.',
    );
  }

  const key = cacheKey(TOOL_NAME, {
    scope: args.scope,
    repo: `${parts.owner}/${parts.name}`,
    number: args.number,
    includeDiffStats,
  });

  const cached = ctx.cache.get<PrContext>(key);
  if (cached !== undefined) return cached;

  const api = ctx.clients.github(args.scope);
  const upstream = githubUpstream(args.scope);
  const target = { owner: parts.owner, repo: parts.name, pull_number: args.number };
  const now = ctx.now();

  let detail: Awaited<ReturnType<typeof api.pulls.get>>;
  try {
    detail = await api.pulls.get(target);
  } catch (error: unknown) {
    const failure = describeFailure(upstream, error, now);
    return toolError(
      [failure],
      failure.status === 404
        ? `Not found under scope "${args.scope}". If this repo belongs to the other account, retry with the other scope.`
        : undefined,
    );
  }

  const warnings: UpstreamFailure[] = [];
  const notes: string[] = [];

  // Each section is independent: one failing does not lose the others.
  const [checksResult, reviewsResult, commentsResult, filesResult] = await Promise.allSettled([
    checkDetails(api, parts.owner, parts.name, detail.data.head.sha, MAX_CHECKS),
    api.pulls.listReviews({ ...target, per_page: 100 }),
    api.pulls.listReviewComments({ ...target, per_page: 100 }),
    includeDiffStats ? api.pulls.listFiles({ ...target, per_page: 100 }) : Promise.resolve(undefined),
  ]);

  let ci: CheckDetail[] = [];
  let checksOmitted = 0;
  if (checksResult.status === 'fulfilled') {
    ci = checksResult.value.checks;
    checksOmitted = checksResult.value.omitted;
  } else {
    warnings.push(describeFailure(upstream, checksResult.reason, now));
    notes.push('CI status unavailable.');
  }

  let reviews: ReviewerState[] = [];
  let approvals = 0;
  let changesRequested = false;
  let awaiting: string[] = [];
  if (reviewsResult.status === 'fulfilled') {
    reviews = reviewerStates(reviewsResult.value.data);
    const summary = summarizeReviews(reviewsResult.value.data, detail.data.requested_reviewers ?? []);
    approvals = summary.approvals;
    changesRequested = summary.changesRequested;
    // Requested teams are always still awaiting — a team cannot review as itself.
    awaiting = [...summary.awaiting, ...(detail.data.requested_teams ?? []).map((team) => `team:${team.slug}`)];
  } else {
    warnings.push(describeFailure(upstream, reviewsResult.reason, now));
    notes.push('Review summary unavailable.');
  }

  let recentComments: ReviewCommentSummary[] = [];
  if (commentsResult.status === 'fulfilled') {
    // Newest last from the API, so take the tail and present newest-first.
    recentComments = [...commentsResult.value.data]
      .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
      .slice(0, MAX_REVIEW_COMMENTS)
      .map((comment) => ({
        author: comment.user?.login ?? 'unknown',
        path: truncateText(comment.path, CAPS.label),
        body: truncateText(comment.body, CAPS.reviewComment),
      }));
  } else {
    warnings.push(describeFailure(upstream, commentsResult.reason, now));
    notes.push('Review comments unavailable.');
  }

  let files: FileStat[] | undefined;
  let filesOmitted = 0;
  if (includeDiffStats) {
    if (filesResult.status === 'fulfilled' && filesResult.value !== undefined) {
      const all = filesResult.value.data;
      // Keep the biggest changes when truncating — that is where review attention goes. Note
      // the ranking only sees the first page (100 files); `files_omitted` below is still exact
      // because it is derived from the PR's own `changed_files` count, not from this page.
      const ranked = [...all].sort((a, b) => b.additions + b.deletions - (a.additions + a.deletions));
      files = ranked.slice(0, MAX_FILES).map((file) => ({
        path: truncateText(file.filename, CAPS.label),
        additions: file.additions,
        deletions: file.deletions,
      }));
      filesOmitted = Math.max(0, detail.data.changed_files - files.length);
    } else if (filesResult.status === 'rejected') {
      warnings.push(describeFailure(upstream, filesResult.reason, now));
      notes.push('Per-file diff stats unavailable.');
    }
  }

  const context: PrContext = fitPrContext({
    repo: `${parts.owner}/${parts.name}`,
    number: args.number,
    title: truncateText(detail.data.title, CAPS.title),
    author: detail.data.user?.login ?? 'unknown',
    state: detail.data.state,
    draft: detail.data.draft === true,
    age_days: ageInDays(detail.data.created_at, now),
    url: detail.data.html_url,
    body: truncateBody(detail.data.body, CAPS.prBody),
    additions: detail.data.additions,
    deletions: detail.data.deletions,
    changed_files: detail.data.changed_files,
    ci,
    ...(checksOmitted > 0 ? { checks_omitted: checksOmitted } : {}),
    reviews,
    approvals,
    changes_requested: changesRequested,
    awaiting,
    recent_review_comments: recentComments,
    ...(files !== undefined ? { files } : {}),
    ...(filesOmitted > 0 ? { files_omitted: filesOmitted } : {}),
    ...(warnings.length > 0 ? { warnings } : {}),
    ...(notes.length > 0 ? { notes } : {}),
  });

  ctx.cache.set(key, context);
  return context;
}

/**
 * Shrink a bundle until it fits the response budget.
 *
 * A worst case at the section caps above (1,500-char body, 25 files, 20 checks, 5 comments,
 * 15 reviewers) lands slightly over 8,000 characters, so this is a live constraint rather
 * than a theoretical guard. Sections are trimmed least-valuable-first:
 *   1. the smallest changed files (already sorted biggest-first, so trim the tail),
 *   2. check runs (also pre-sorted, failures first),
 *   3. the oldest review comments,
 *   4. finally the body.
 * Every reduction is disclosed — `files_omitted` for files, `notes` for the rest.
 */
export function fitPrContext(context: PrContext, maxChars: number = MAX_RESPONSE_CHARS): PrContext {
  if (payloadChars(context) <= maxChars) return context;

  const NOTE = 'Some sections were shortened to stay within the response size budget.';
  const withNote = (value: PrContext): PrContext => ({ ...value, notes: [...(value.notes ?? []), NOTE] });

  let current = context;
  // Measure with the disclosure note already attached. Adding it afterwards would push a
  // just-fitting payload back over the limit.
  const over = (): boolean => payloadChars(withNote(current)) > maxChars;

  const dropFile = (): boolean => {
    const files = current.files;
    if (files === undefined || files.length === 0) return false;
    current = { ...current, files: files.slice(0, -1), files_omitted: (current.files_omitted ?? 0) + 1 };
    return true;
  };
  const dropCheck = (): boolean => {
    if (current.ci.length === 0) return false;
    current = { ...current, ci: current.ci.slice(0, -1), checks_omitted: (current.checks_omitted ?? 0) + 1 };
    return true;
  };
  const dropReviewer = (): boolean => {
    if (current.reviews.length === 0) return false;
    current = { ...current, reviews: current.reviews.slice(0, -1) };
    return true;
  };
  const dropComment = (): boolean => {
    if (current.recent_review_comments.length === 0) return false;
    current = { ...current, recent_review_comments: current.recent_review_comments.slice(0, -1) };
    return true;
  };
  const shrinkBody = (floor: number): boolean => {
    if (current.body.length <= floor) return false;
    const next = Math.max(floor, Math.floor(current.body.length / 2));
    current = { ...current, body: truncateBody(current.body, next) };
    return true;
  };

  /**
   * Reduction order. The first pass keeps a useful minimum of every section, so a trimmed
   * bundle is still informative. Only if that is not enough does the second pass strip
   * sections to nothing, which guarantees termination under any input.
   */
  const steps: readonly (() => boolean)[] = [
    () => (current.files?.length ?? 0) > 3 && dropFile(),
    () => current.ci.length > 3 && dropCheck(),
    () => current.reviews.length > 3 && dropReviewer(),
    () => current.recent_review_comments.length > 1 && dropComment(),
    () => shrinkBody(200),
    dropFile,
    dropCheck,
    dropReviewer,
    dropComment,
    () => shrinkBody(0),
  ];

  while (over()) {
    const progressed = steps.some((step) => step());
    if (!progressed) break;
  }

  return withNote(current);
}
