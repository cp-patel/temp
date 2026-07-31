/**
 * Tool 6: `search_my_work` — free-text search across GitHub PRs and Linear issues.
 *
 * The escape hatch for when the specific tools do not fit. Results are deliberately thin:
 * enough to identify the right thing, then follow up with a specific tool.
 */

import { z } from 'zod';
import { cacheKey } from '../lib/cache.js';
import { describeFailure, githubUpstream, type UpstreamFailure } from '../lib/errors.js';
import { buildEnvelope, repoFromApiUrl, type Envelope, type Source } from '../lib/format.js';
import { searchIssues } from '../lib/linear.js';
import { CAPS, truncateText } from '../lib/truncate.js';
import {
  loginFor,
  resolveScopes,
  scopeQualifier,
  type GithubScope,
  type Scope,
  type ToolContext,
} from '../clients.js';

export const TOOL_NAME = 'search_my_work';

const DEFAULT_MAX_RESULTS = 10;
const MAX_MAX_RESULTS = 25;

export const searchInputSchema = {
  query: z
    .string()
    .trim()
    .min(2)
    .max(200)
    .describe(
      'Free-text search terms, e.g. "checkout timeout" or "rate limiter". Plain words work best. GitHub search qualifiers are not needed — scoping to your accounts is applied automatically.',
    ),
  scope: z
    .enum(['work', 'personal', 'both'])
    .default('both')
    .describe('Which GitHub account to search. Linear is always searched, since it has no work/personal split.'),
  max_results: z
    .number()
    .int()
    .min(1)
    .max(MAX_MAX_RESULTS)
    .default(DEFAULT_MAX_RESULTS)
    .describe(`Maximum combined results (default ${DEFAULT_MAX_RESULTS}, max ${MAX_MAX_RESULTS}).`),
  only_mine: z
    .boolean()
    .default(false)
    .describe(
      'Restrict to work the user authored (GitHub PRs) or is assigned (Linear issues). Default false searches everything their tokens can see. Set true when the user says "my" — "find MY pr about rate limiting".',
    ),
};

export const searchDescription = `Free-text search across GitHub pull requests (titles and bodies) and Linear issue titles at the same time. This is the escape hatch for when the specific tools do not fit.

Each result is intentionally minimal: title, type ("pr" or "issue"), state, url, and source ("work", "personal", or "linear"). PRs also carry repo and number so you can pass them straight to get_pr_context.

Use this when the user refers to work by topic rather than by position — "did I ever open a PR about the retry logic?", "find the ticket about the checkout bug", "what was that thing I did on rate limiting?". Prefer the specific tools when the question is really about the user's current queue: get_my_review_queue for what awaits their review, get_my_open_prs for their own PRs, get_my_linear_issues for their tickets, whats_blocked for what is stuck, and get_standup_notes for a time-windowed "what did I do" summary. Reach for this tool when none of those framings match.

By default this searches ALL matching work regardless of author or assignee — restricted only to repositories the tokens can see. Set only_mine: true to narrow to PRs the user authored and issues assigned to them.

Example: { "query": "checkout timeout", "scope": "work", "max_results": 5 }`;

export interface SearchArgs {
  readonly query: string;
  readonly scope?: Scope | undefined;
  readonly max_results?: number | undefined;
  readonly only_mine?: boolean | undefined;
}

export interface SearchResultItem {
  readonly title: string;
  readonly type: 'pr' | 'issue';
  readonly state: string;
  readonly url: string;
  readonly source: Source | 'linear';
  readonly repo?: string;
  readonly number?: number;
  readonly identifier?: string;
}

function normalizeArgs(args: SearchArgs): { query: string; scope: Scope; maxResults: number; onlyMine: boolean } {
  const requested = args.max_results ?? DEFAULT_MAX_RESULTS;
  return {
    query: args.query.trim(),
    scope: args.scope ?? 'both',
    maxResults: Math.max(1, Math.min(Math.trunc(requested), MAX_MAX_RESULTS)),
    onlyMine: args.only_mine ?? false,
  };
}

/**
 * Neutralise GitHub search qualifiers in free text, without changing match semantics.
 *
 * Every GitHub qualifier has the form `key:value`, so removing colons makes one impossible to
 * form — which keeps the scope qualifiers this server adds authoritative.
 *
 * Quoting the whole phrase would also block injection, but it is the wrong tool: GitHub treats
 * a quoted string as an exact-phrase match. Measured against the live API, `"checkout timeout
 * regression"` returns 54 matches where the same words unquoted return 99,339 — so quoting
 * would silently hide almost everything the user was looking for.
 *
 * Double quotes and backslashes are dropped too, so the caller cannot reopen a quoted context.
 */
export function sanitizeSearchTerms(query: string): string {
  return query
    .replace(/["\\:]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Report a PR's real state.
 *
 * This tool intentionally does not pin `is:open` — "did I ever open a PR about X?" needs
 * history — so unlike the queue tools it must distinguish merged from closed from open.
 * Reporting everything as "open" would be actively misleading.
 */
export function describePrState(item: {
  state?: string | undefined;
  draft?: boolean | undefined;
  pull_request?: { merged_at?: string | null | undefined } | null | undefined;
}): string {
  if (item.pull_request?.merged_at !== null && item.pull_request?.merged_at !== undefined) return 'merged';
  if (item.state === 'closed') return 'closed';
  if (item.draft === true) return 'draft';
  return item.state ?? 'open';
}

async function searchGithubScope(
  ctx: ToolContext,
  scope: GithubScope,
  query: string,
  perPage: number,
  onlyMine: boolean,
): Promise<{ total: number; items: SearchResultItem[] }> {
  const api = ctx.clients.github(scope);
  const qualifier = scopeQualifier(ctx.clients.config, scope);
  // The author restriction uses the login behind this scope's own token — never the other's.
  const mine = onlyMine ? ` author:${loginFor(ctx.identity, scope)}` : '';
  // Sanitised again here even though the caller already did: this function owns the guarantee
  // that no caller can inject a qualifier, and the transform is idempotent.
  const q = `${sanitizeSearchTerms(query)} is:pr archived:false ${qualifier}${mine}`;

  const response = await api.search.issuesAndPullRequests({
    q,
    per_page: perPage,
    advanced_search: 'true',
  });

  return {
    total: response.data.total_count,
    items: response.data.items.map((item) => ({
      title: truncateText(item.title, CAPS.title),
      type: 'pr' as const,
      state: describePrState(item),
      url: item.html_url,
      source: scope,
      repo: repoFromApiUrl(item.repository_url),
      number: item.number,
    })),
  };
}

export async function searchMyWork(ctx: ToolContext, args: SearchArgs): Promise<Envelope<SearchResultItem>> {
  const { query: rawQuery, scope, maxResults, onlyMine } = normalizeArgs(args);
  const query = sanitizeSearchTerms(rawQuery);

  // Input like ":::" satisfies the schema's length minimum but sanitises to nothing. Searching
  // on an empty term would drop to bare qualifiers and match every PR in scope, which is the
  // opposite of what was asked for.
  if (query === '') {
    return buildEnvelope({
      items: [],
      totalFound: 0,
      notes: ['The query contained no searchable terms after removing qualifier syntax.'],
    });
  }

  return ctx.cache.wrap(cacheKey(TOOL_NAME, { query, scope, maxResults, onlyMine }), async () => {
    const warnings: UpstreamFailure[] = [];
    const now = ctx.now();
    const scopes = resolveScopes(scope);

    // Ask each upstream for the full budget, then interleave — a topic may live entirely in
    // one place, and under-asking would hide it.
    const githubTasks = scopes.map(async (current) => {
      try {
        return await searchGithubScope(ctx, current, query, maxResults, onlyMine);
      } catch (error: unknown) {
        warnings.push(describeFailure(githubUpstream(current), error, now));
        return undefined;
      }
    });

    const linearTask = (async () => {
      try {
        const filter = onlyMine
          ? { assignee: { email: { eq: ctx.clients.config.linearUserEmail } } }
          : undefined;
        const { nodes, totalCount } = await searchIssues(ctx.clients.linear, query, maxResults, filter);
        const items: SearchResultItem[] = nodes.map((node) => ({
          title: truncateText(node.title, CAPS.title),
          type: 'issue' as const,
          state: truncateText(node.state?.name ?? 'unknown', CAPS.label),
          url: node.url,
          source: 'linear' as const,
          identifier: node.identifier,
        }));
        return { total: totalCount, items };
      } catch (error: unknown) {
        warnings.push(describeFailure('linear', error, now));
        return undefined;
      }
    })();

    const [githubResults, linearResult] = await Promise.all([Promise.all(githubTasks), linearTask]);

    const groups = [...githubResults, linearResult].filter(
      (group): group is { total: number; items: SearchResultItem[] } => group !== undefined,
    );
    const totalFound = groups.reduce((sum, group) => sum + group.total, 0);

    // Round-robin across sources so one prolific upstream cannot crowd out the others.
    const items: SearchResultItem[] = [];
    for (let index = 0; items.length < maxResults; index += 1) {
      let advanced = false;
      for (const group of groups) {
        const candidate = group.items[index];
        if (candidate === undefined) continue;
        advanced = true;
        items.push(candidate);
        if (items.length >= maxResults) break;
      }
      if (!advanced) break;
    }

    return buildEnvelope({ items, totalFound, warnings });
  });
}
