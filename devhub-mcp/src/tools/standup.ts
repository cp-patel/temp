/**
 * Tool 7: `get_standup_notes` — the retrospective tool.
 *
 * Every other tool is present-tense (what is waiting, what is stuck). This one answers the
 * daily ritual question — "what did I do yesterday, what is in flight?" — in one call, so an
 * LLM can draft a standup update without improvising over search.
 *
 * Search-only by design: GitHub's search response already carries everything needed
 * (including `pull_request.merged_at`, verified in the OpenAPI schema), so there is no
 * per-PR enrichment. Worst case is four GitHub searches plus one Linear query.
 */

import { z } from 'zod';
import { cacheKey } from '../lib/cache.js';
import { describeFailure, githubUpstream, type UpstreamFailure } from '../lib/errors.js';
import { repoFromApiUrl, type IssueItem, type Source } from '../lib/format.js';
import { buildIssueFilter, fetchAssignedIssues, toIssueItem } from '../lib/linear.js';
import { CAPS, MAX_RESPONSE_CHARS, payloadChars, truncateText } from '../lib/truncate.js';
import {
  loginFor,
  resolveScopes,
  scopeQualifier,
  type GithubScope,
  type Scope,
  type ToolContext,
} from '../clients.js';

export const TOOL_NAME = 'get_standup_notes';

const DEFAULT_DAYS_BACK = 1;
const MAX_DAYS_BACK = 14;
/** Per-section ceiling; a standup covering more than this is a summary, not a list. */
const MAX_PER_SECTION = 10;
/** How many recently-updated Linear issues to bucket. */
const LINEAR_SCAN_LIMIT = 50;

export const standupInputSchema = {
  days_back: z
    .number()
    .int()
    .min(1)
    .max(MAX_DAYS_BACK)
    .default(DEFAULT_DAYS_BACK)
    .describe(
      `How many days to look back (default ${DEFAULT_DAYS_BACK}, max ${MAX_DAYS_BACK}). Use 1 for a daily standup, 3 after a weekend, 7 for a weekly summary.`,
    ),
  scope: z
    .enum(['work', 'personal', 'both'])
    .default('both')
    .describe('Which GitHub account to cover. Linear is always included.'),
};

export const standupDescription = `Returns what YOU did recently and what you have in flight, as ready-to-summarise standup material. One call covers GitHub (both accounts) and Linear.

Four labelled sections:
- merged_prs: PRs you authored that were merged in the window (repo, number, title, url, source, merged_at).
- opened_prs: PRs you opened in the window that are still open.
- completed_issues: your Linear issues completed in the window.
- in_progress_issues: your Linear issues currently in a started state, regardless of window.

Plus a one-line "summary" like "Merged 2 PRs, opened 1, completed 1 ticket; 3 in progress." computed in code.

Use this when the user asks what they did yesterday/last week, wants standup notes, a status update, or a work summary — "what did I ship this week?", "write my standup". This is the RETROSPECTIVE tool: for the current queue use get_my_review_queue (reviews owed) or get_my_open_prs (PRs awaiting others); for what is stuck use whats_blocked.

Honest boundary: this does NOT include reviews the user gave to other people's PRs — only PRs they authored and issues assigned to them.

Example: { "days_back": 1 } -> yesterday's merged/opened PRs, completed tickets, and current in-progress work.`;

export interface StandupArgs {
  readonly days_back?: number | undefined;
  readonly scope?: Scope | undefined;
}

/** Compact shape for retrospective PRs — no CI or review state, those are queue concerns. */
export interface StandupPr {
  readonly repo: string;
  readonly number: number;
  readonly title: string;
  readonly url: string;
  readonly source: Source;
  readonly merged_at?: string;
}

export interface StandupNotes {
  readonly summary: string;
  readonly since: string;
  readonly merged_prs: StandupPr[];
  readonly opened_prs: StandupPr[];
  readonly completed_issues: IssueItem[];
  readonly in_progress_issues: IssueItem[];
  readonly warnings?: UpstreamFailure[];
  readonly notes?: string[];
}

function normalizeArgs(args: StandupArgs): { daysBack: number; scope: Scope } {
  const requested = args.days_back ?? DEFAULT_DAYS_BACK;
  return {
    daysBack: Math.max(1, Math.min(Math.trunc(requested), MAX_DAYS_BACK)),
    scope: args.scope ?? 'both',
  };
}

/**
 * The window start as a UTC calendar date.
 *
 * GitHub's date qualifiers compare at day granularity, so the Linear bucketing below uses the
 * same floored boundary — otherwise the two sources would disagree about what "yesterday"
 * includes.
 */
export function sinceDate(now: number, daysBack: number): { dateStr: string; sinceMs: number } {
  const dateStr = new Date(now - daysBack * 86_400_000).toISOString().slice(0, 10);
  return { dateStr, sinceMs: Date.parse(dateStr) };
}

interface SectionPage {
  /** Upstream match count — may exceed the page. The summary counts THIS, not the page. */
  readonly total: number;
  readonly items: StandupPr[];
}

interface ScopeSearches {
  readonly merged: SectionPage;
  readonly opened: SectionPage;
}

/**
 * Both retrospective searches for one scope.
 *
 * `merged:>=DATE` and `created:>=DATE` were both verified against the live search API
 * (200 with real results; an invalid qualifier returns 422).
 */
async function searchScope(
  ctx: ToolContext,
  scope: GithubScope,
  dateStr: string,
  perPage: number,
): Promise<ScopeSearches> {
  const api = ctx.clients.github(scope);
  const login = loginFor(ctx.identity, scope);
  const qualifier = scopeQualifier(ctx.clients.config, scope);

  const toItem = (item: {
    number: number;
    title: string;
    html_url: string;
    repository_url: string;
    pull_request?: { merged_at?: string | null | undefined } | null | undefined;
  }): StandupPr => ({
    repo: repoFromApiUrl(item.repository_url),
    number: item.number,
    title: truncateText(item.title, CAPS.title),
    url: item.html_url,
    source: scope,
    ...(item.pull_request?.merged_at !== null && item.pull_request?.merged_at !== undefined
      ? { merged_at: item.pull_request.merged_at }
      : {}),
  });

  const [merged, opened] = await Promise.all([
    api.search.issuesAndPullRequests({
      q: `is:pr author:${login} is:merged merged:>=${dateStr} archived:false ${qualifier}`,
      per_page: perPage,
      advanced_search: 'true',
    }),
    api.search.issuesAndPullRequests({
      q: `is:pr is:open author:${login} created:>=${dateStr} archived:false ${qualifier}`,
      per_page: perPage,
      advanced_search: 'true',
    }),
  ]);

  return {
    merged: { total: merged.data.total_count, items: merged.data.items.map(toItem) },
    opened: { total: opened.data.total_count, items: opened.data.items.map(toItem) },
  };
}

/** The summary line, computed in code — exact, cheap, never delegated to an LLM. */
export function buildStandupSummary(counts: {
  merged: number;
  opened: number;
  completed: number;
  inProgress: number;
}): string {
  const { merged, opened, completed, inProgress } = counts;
  if (merged === 0 && opened === 0 && completed === 0 && inProgress === 0) {
    return 'No merged or opened PRs, no completed tickets, and nothing currently in progress in this window.';
  }
  const shipped = [
    `Merged ${merged} PR${merged === 1 ? '' : 's'}`,
    `opened ${opened}`,
    `completed ${completed} ticket${completed === 1 ? '' : 's'}`,
  ].join(', ');
  return `${shipped}; ${inProgress} in progress.`;
}

export async function getStandupNotes(ctx: ToolContext, args: StandupArgs): Promise<StandupNotes> {
  const { daysBack, scope } = normalizeArgs(args);

  return ctx.cache.wrap(cacheKey(TOOL_NAME, { daysBack, scope }), async () => {
    const warnings: UpstreamFailure[] = [];
    const notes: string[] = [];
    const now = ctx.now();
    const { dateStr, sinceMs } = sinceDate(now, daysBack);
    const scopes = resolveScopes(scope);

    const [githubResults, linearResult] = await Promise.all([
      Promise.all(
        scopes.map(async (current) => {
          try {
            return await searchScope(ctx, current, dateStr, MAX_PER_SECTION);
          } catch (error: unknown) {
            warnings.push(describeFailure(githubUpstream(current), error, now));
            return undefined;
          }
        }),
      ),
      (async () => {
        try {
          // One query, bucketed client-side: the sort is most-recently-updated first, and both
          // buckets are properties of the node (completedAt, state.type) — no second round trip.
          return await fetchAssignedIssues(ctx.clients.linear, buildIssueFilter(ctx.clients.config.linearUserEmail, 'all'), LINEAR_SCAN_LIMIT);
        } catch (error: unknown) {
          warnings.push(describeFailure('linear', error, now));
          return undefined;
        }
      })(),
    ]);

    const merged: StandupPr[] = [];
    const opened: StandupPr[] = [];
    let mergedTotal = 0;
    let openedTotal = 0;
    for (const result of githubResults) {
      if (result === undefined) continue;
      merged.push(...result.merged.items);
      opened.push(...result.opened.items);
      mergedTotal += result.merged.total;
      openedTotal += result.opened.total;
    }
    merged.sort((a, b) => Date.parse(b.merged_at ?? '') - Date.parse(a.merged_at ?? ''));

    const completedIssues: IssueItem[] = [];
    const inProgressIssues: IssueItem[] = [];
    for (const node of linearResult?.nodes ?? []) {
      const completedAt = node.completedAt === null || node.completedAt === undefined ? undefined : Date.parse(node.completedAt);
      if (completedAt !== undefined && completedAt >= sinceMs) {
        completedIssues.push(toIssueItem(node, now));
      } else if (node.state?.type === 'started') {
        inProgressIssues.push(toIssueItem(node, now));
      }
    }
    if ((linearResult?.nodes.length ?? 0) >= LINEAR_SCAN_LIMIT && linearResult?.hasNextPage === true) {
      notes.push(
        `Bucketed the ${LINEAR_SCAN_LIMIT} most recently updated issues; older activity in the window may be missing.`,
      );
    }
    if (linearResult?.degraded === true) {
      notes.push('days_in_state on issues is approximate for this response.');
    }

    // The summary counts upstream TOTALS, not fetched pages: with per_page at the section cap,
    // counting items would report "Merged 10" on a 30-PR day — the page size leaking into the
    // headline number. Linear counts come from the bucketed scan (its cap is disclosed above).
    const summary = buildStandupSummary({
      merged: mergedTotal,
      opened: openedTotal,
      completed: completedIssues.length,
      inProgress: inProgressIssues.length,
    });

    const truncated: string[] = [];
    const cap = <T>(items: T[], total: number, name: string): T[] => {
      const kept = items.slice(0, MAX_PER_SECTION);
      if (total > kept.length) truncated.push(`${name} (${total} total, ${kept.length} shown)`);
      return kept;
    };

    const sections = {
      merged_prs: cap(merged, mergedTotal, 'merged_prs'),
      opened_prs: cap(opened, openedTotal, 'opened_prs'),
      completed_issues: cap(completedIssues, completedIssues.length, 'completed_issues'),
      in_progress_issues: cap(inProgressIssues, inProgressIssues.length, 'in_progress_issues'),
    };
    if (truncated.length > 0) {
      notes.push(`The summary counts every match; some lists are shorter: ${truncated.join(', ')}.`);
    }

    return fitStandup({
      summary,
      since: dateStr,
      ...sections,
      ...(warnings.length > 0 ? { warnings } : {}),
      ...(notes.length > 0 ? { notes } : {}),
    });
  });
}

/**
 * Shrink until the payload fits, trimming the longest section first so every section stays
 * represented. Measured with the disclosure note attached, for the usual reason.
 */
export function fitStandup(standup: StandupNotes, maxChars: number = MAX_RESPONSE_CHARS): StandupNotes {
  if (payloadChars(standup) <= maxChars) return standup;

  const NOTE = 'Sections were shortened to stay within the response size budget; the summary counts reflect the true totals.';
  const withNote = (value: StandupNotes): StandupNotes => ({ ...value, notes: [...(value.notes ?? []), NOTE] });

  let current = standup;
  while (payloadChars(withNote(current)) > maxChars) {
    const lengths = [
      current.merged_prs.length,
      current.opened_prs.length,
      current.completed_issues.length,
      current.in_progress_issues.length,
    ];
    const longest = Math.max(...lengths);
    if (longest <= 1) break;

    current = {
      ...current,
      merged_prs: current.merged_prs.length === longest ? current.merged_prs.slice(0, -1) : current.merged_prs,
      opened_prs: current.opened_prs.length === longest ? current.opened_prs.slice(0, -1) : current.opened_prs,
      completed_issues:
        current.completed_issues.length === longest ? current.completed_issues.slice(0, -1) : current.completed_issues,
      in_progress_issues:
        current.in_progress_issues.length === longest
          ? current.in_progress_issues.slice(0, -1)
          : current.in_progress_issues,
    };
  }

  return withNote(current);
}
