/**
 * Tool 5: `whats_blocked` — the cross-referencing tool.
 *
 * The point of this tool is that it answers "what am I blocked on and what am I blocking?"
 * in ONE call. It fans out to GitHub and Linear concurrently, applies the staleness rules,
 * and computes the summary line in code — never by asking an LLM.
 */

import { cacheKey } from '../lib/cache.js';
import { type UpstreamFailure } from '../lib/errors.js';
import { MAX_RESPONSE_CHARS, payloadChars } from '../lib/truncate.js';
import { blockedReason, buildIssueFilter, fetchAssignedIssues, toIssueItem } from '../lib/linear.js';
import { describeFailure } from '../lib/errors.js';
import type { IssueItem, PrItem } from '../lib/format.js';
import { collectAuthoredPrs, toUnenrichedItem } from './my-prs.js';
import { collectReviewQueue } from './review-queue.js';
import type { ToolContext } from '../clients.js';

export const TOOL_NAME = 'whats_blocked';

/** Default: an authored PR is "waiting on reviewers" once it is this old with no approval. */
export const DEFAULT_STALE_AUTHORED_DAYS = 3;
/** Default: a review request I hold is "blocking others" once it is this old. */
export const DEFAULT_BLOCKING_OTHERS_DAYS = 5;
/** Upper bound per section, so the combined response stays inside the char budget. */
const MAX_PER_SECTION = 10;
/** How many PRs to scan per side before filtering. */
const SCAN_LIMIT = 30;
/** How many Linear issues to scan for blockers. */
const LINEAR_SCAN_LIMIT = 100;

export const whatsBlockedInputSchema = {};

/**
 * Built per-server rather than exported as a constant: the day thresholds are configurable,
 * and the description must state the numbers actually in force — an LLM reading "3 days"
 * while the server enforces 1 would explain results wrongly.
 */
export function buildWhatsBlockedDescription(staleDays: number, blockingDays: number): string {
  return `Answers "what am I blocked on, and what am I blocking?" in a single call. Takes no parameters.

Cross-references three things at once and returns them as three labelled sections:
- waiting_on_reviewers: PRs you authored that are open more than ${staleDays} day${staleDays === 1 ? '' : 's'} with no approval, or where changes were requested and you have not pushed since. You are blocked on other people.
- blocked_issues: your Linear issues that are genuinely stuck — workflow state named like "Blocked", or another still-open issue blocks them.
- you_are_blocking: PRs awaiting YOUR review for more than ${blockingDays} day${blockingDays === 1 ? '' : 's'}. Other people are blocked on you.

Also returns a one-line "summary" string, e.g. "2 PRs waiting on reviewers, 1 ticket blocked, you are blocking 3 reviews". Every item carries a "reason" field explaining why it qualified. The summary counts every match even when a section is truncated, and any truncation is stated in "notes".

Items in you_are_blocking are lighter than the other sections — repo, number, title, author, age_days, url, source and reason, but no diff stats or CI, because deciding that you are holding someone up needs only the age. Call get_pr_context on one if you need its detail.

PREFER THIS TOOL whenever the user asks what is stuck, blocked, stalled, waiting, or needs chasing — "what am I blocked on?", "what's stuck?", "anything waiting on me?", "what should I unblock today?". It is a single call that already combines GitHub and Linear, so do NOT chain get_my_open_prs + get_my_linear_issues + get_my_review_queue to answer those questions. Reach for the individual tools only when the user wants a full list rather than just the stuck subset.

Covers both GitHub accounts (work and personal) plus Linear. If one upstream is down the others still return, with a warnings array.

Example: {}`;
}

/** Description built with the defaults, for tests and for callers without a config. */
export const whatsBlockedDescription = buildWhatsBlockedDescription(
  DEFAULT_STALE_AUTHORED_DAYS,
  DEFAULT_BLOCKING_OTHERS_DAYS,
);

export interface BlockedSections {
  readonly summary: string;
  readonly waiting_on_reviewers: PrItem[];
  readonly blocked_issues: IssueItem[];
  readonly you_are_blocking: PrItem[];
  readonly warnings?: UpstreamFailure[];
  readonly notes?: string[];
}

/**
 * Why an authored PR counts as waiting on reviewers, or undefined if it does not.
 *
 * Two independent triggers, per spec:
 *  - open longer than the staleness threshold with no approval;
 *  - changes requested and no new commit since (approximated by `days_since_activity`,
 *    which already accounts for the newest commit).
 *
 * Drafts are excluded: a draft is not waiting on anyone but its author.
 */
export function authoredBlockedReason(
  item: PrItem,
  staleDays: number = DEFAULT_STALE_AUTHORED_DAYS,
): string | undefined {
  if (item.draft === true) return undefined;

  // `approvals` is absent only when enrichment failed for this row. Treating that as "zero
  // approvals" would invent a blocker for a PR that may well be approved and ready, so an
  // unassessable PR is excluded here and disclosed in the response notes instead.
  if (item.approvals === undefined) return undefined;

  if (item.changes_requested === true) {
    // If the author already pushed after the review, the ball is back with the reviewer and
    // this PR is not blocked on the author. `pushed_since_review` compares the head commit
    // against the review timestamp, so this is exact rather than inferred.
    if (item.pushed_since_review === true) return undefined;
    const since = item.days_since_activity;
    return since === undefined
      ? 'changes requested, not addressed yet'
      : `changes requested, not addressed for ${since}d`;
  }

  if (item.age_days > staleDays && item.approvals === 0) {
    const awaiting = item.awaiting ?? [];
    const who = awaiting.length > 0 ? ` — awaiting ${awaiting.join(', ')}` : ' — no reviewer has responded';
    return `open ${item.age_days}d with no approval${who}`;
  }

  return undefined;
}

/** Why a review request I hold is blocking someone else. */
export function blockingOthersReason(
  item: PrItem,
  blockingDays: number = DEFAULT_BLOCKING_OTHERS_DAYS,
): string | undefined {
  if (item.draft === true) return undefined;
  if (item.age_days <= blockingDays) return undefined;
  return `awaiting your review for ${item.age_days}d`;
}

/**
 * The summary line, computed in code.
 *
 * Deliberately not delegated to an LLM: it must be exact, cheap and stable.
 */
export function buildSummary(sections: {
  waiting: number;
  blocked: number;
  blocking: number;
}): string {
  const { waiting, blocked, blocking } = sections;
  if (waiting === 0 && blocked === 0 && blocking === 0) {
    return 'Nothing blocked: no stalled PRs of yours, no blocked tickets, and no reviews overdue from you.';
  }
  const parts: string[] = [];
  parts.push(`${waiting} PR${waiting === 1 ? '' : 's'} waiting on reviewers`);
  parts.push(`${blocked} ticket${blocked === 1 ? '' : 's'} blocked`);
  parts.push(`you are blocking ${blocking} review${blocking === 1 ? '' : 's'}`);
  return parts.join(', ');
}

export async function whatsBlocked(ctx: ToolContext): Promise<BlockedSections> {
  return ctx.cache.wrap(cacheKey(TOOL_NAME, {}), async () => {
    const warnings: UpstreamFailure[] = [];
    const notes: string[] = [];
    const now = ctx.now();

    // All three upstreams in parallel. Each already degrades independently.
    //
    // Request budget matters here: this is the most fan-out-heavy tool in the server. Two
    // deliberate economies keep it tractable:
    //  - the review-queue side is NOT enriched, because `blockingOthersReason` needs only age
    //    and draft status, both present in the search response;
    //  - the authored side skips CI, because no staleness rule consults it.
    // Together those remove roughly two thirds of the follow-up requests.
    const [authored, reviewQueue, linearIssues] = await Promise.all([
      collectAuthoredPrs(ctx, 'both', SCAN_LIMIT, { includeCi: false }),
      collectReviewQueue(ctx, 'both', SCAN_LIMIT),
      (async () => {
        try {
          const filter = buildIssueFilter(ctx.clients.config.linearUserEmail, 'blocked');
          const fetched = await fetchAssignedIssues(ctx.clients.linear, filter, LINEAR_SCAN_LIMIT);
          const items = fetched.nodes
            .map((node) => ({ node, reason: blockedReason(node) }))
            .filter((entry): entry is { node: typeof entry.node; reason: string } => entry.reason !== undefined)
            .map((entry) => toIssueItem(entry.node, now, entry.reason));
          return { items, hitCap: fetched.nodes.length >= LINEAR_SCAN_LIMIT };
        } catch (error: unknown) {
          warnings.push(describeFailure('linear', error, now));
          return undefined;
        }
      })(),
    ]);

    const scannedLinearCap = linearIssues?.hitCap === true;

    // Re-surface warnings from the composed calls rather than swallowing them.
    for (const warning of [...authored.warnings, ...reviewQueue.warnings]) {
      warnings.push(warning);
    }

    const { stalePrDays, blockingReviewDays } = ctx.clients.config;

    // flatMap rather than map+filter: it keeps the element type non-nullable, which a type
    // predicate cannot express cleanly under exactOptionalPropertyTypes.
    const waitingOnReviewers: PrItem[] = authored.items
      .flatMap((item) => {
        const reason = authoredBlockedReason(item, stalePrDays);
        return reason === undefined ? [] : [{ ...item, reason }];
      })
      .sort((a, b) => b.age_days - a.age_days);

    const youAreBlocking: PrItem[] = reviewQueue.candidates
      .map((candidate) => toUnenrichedItem(candidate, now))
      .flatMap((item) => {
        const reason = blockingOthersReason(item, blockingReviewDays);
        return reason === undefined ? [] : [{ ...item, reason }];
      })
      .sort((a, b) => b.age_days - a.age_days);

    const blockedIssues = [...(linearIssues?.items ?? [])].sort((a, b) => b.days_in_state - a.days_in_state);

    // The summary counts everything found, even if a section is truncated for size.
    const summary = buildSummary({
      waiting: waitingOnReviewers.length,
      blocked: blockedIssues.length,
      blocking: youAreBlocking.length,
    });

    // Disclose the per-section cap. Without this the cap is a silent truncation: the summary
    // would say "23 tickets blocked" while only 10 appear, with nothing explaining the gap.
    const capped: string[] = [];
    if (waitingOnReviewers.length > MAX_PER_SECTION) capped.push(`waiting_on_reviewers (${waitingOnReviewers.length})`);
    if (blockedIssues.length > MAX_PER_SECTION) capped.push(`blocked_issues (${blockedIssues.length})`);
    if (youAreBlocking.length > MAX_PER_SECTION) capped.push(`you_are_blocking (${youAreBlocking.length})`);
    if (capped.length > 0) {
      notes.push(
        `Showing the ${MAX_PER_SECTION} most urgent per section; the summary counts every match. Truncated: ${capped.join(', ')}.`,
      );
    }

    if (scannedLinearCap) {
      notes.push(
        `Scanned the ${LINEAR_SCAN_LIMIT} most recently updated active Linear issues; older ones were not checked for blockers.`,
      );
    }

    // Never let a row silently vanish: a PR whose enrichment failed cannot be assessed for
    // staleness, so say how many were skipped rather than implying they are fine.
    const unassessable = authored.items.filter((item) => item.approvals === undefined && item.draft !== true).length;
    if (unassessable > 0) {
      notes.push(
        `${unassessable} of your open PR${unassessable === 1 ? '' : 's'} could not be assessed (GitHub did not return their review state) and ${unassessable === 1 ? 'is' : 'are'} not counted above.`,
      );
    }

    if (warnings.length > 0) {
      notes.push('One or more upstreams failed; sections above may be incomplete.');
    }

    return fitSections(
      {
        summary,
        waiting_on_reviewers: waitingOnReviewers.slice(0, MAX_PER_SECTION),
        blocked_issues: blockedIssues.slice(0, MAX_PER_SECTION),
        you_are_blocking: youAreBlocking.slice(0, MAX_PER_SECTION),
        ...(warnings.length > 0 ? { warnings } : {}),
        ...(notes.length > 0 ? { notes } : {}),
      },
      MAX_RESPONSE_CHARS,
    );
  });
}

/**
 * Trim the three sections evenly until the payload fits.
 *
 * Trimming round-robin from the longest section keeps all three represented — dropping one
 * entirely would misrepresent the answer to "what am I blocked on *and* blocking?". The
 * `summary` counts are computed before trimming, so they still report the true totals.
 */
export function fitSections(sections: BlockedSections, maxChars: number = MAX_RESPONSE_CHARS): BlockedSections {
  if (payloadChars(sections) <= maxChars) return sections;

  const NOTE =
    'Sections were shortened to stay within the response size budget; the summary counts reflect the true totals.';
  const withNote = (value: BlockedSections): BlockedSections => ({
    ...value,
    notes: [...(value.notes ?? []), NOTE],
  });

  let current = sections;

  // Measured with the note attached — appending it afterwards could push a just-fitting
  // payload back over the limit.
  while (payloadChars(withNote(current)) > maxChars) {
    const lengths = [
      current.waiting_on_reviewers.length,
      current.blocked_issues.length,
      current.you_are_blocking.length,
    ];
    const longest = Math.max(...lengths);
    if (longest <= 1) break;

    current = {
      ...current,
      waiting_on_reviewers:
        current.waiting_on_reviewers.length === longest
          ? current.waiting_on_reviewers.slice(0, -1)
          : current.waiting_on_reviewers,
      blocked_issues:
        current.blocked_issues.length === longest ? current.blocked_issues.slice(0, -1) : current.blocked_issues,
      you_are_blocking:
        current.you_are_blocking.length === longest
          ? current.you_are_blocking.slice(0, -1)
          : current.you_are_blocking,
    };
  }

  return withNote(current);
}
