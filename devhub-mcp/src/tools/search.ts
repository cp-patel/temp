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
import { resolveScopes, scopeQualifier, type GithubScope, type Scope, type ToolContext } from '../clients.js';

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
};

export const searchDescription = `Free-text search across GitHub pull requests (titles and bodies) and Linear issue titles at the same time. This is the escape hatch for when the specific tools do not fit.

Each result is intentionally minimal: title, type ("pr" or "issue"), state, url, and source ("work", "personal", or "linear"). PRs also carry repo and number so you can pass them straight to get_pr_context.

Use this when the user refers to work by topic rather than by position — "did I ever open a PR about the retry logic?", "find the ticket about the checkout bug", "what was that thing I did on rate limiting?". Prefer the specific tools when the question is really about the user's current queue: get_my_review_queue for what awaits their review, get_my_open_prs for their own PRs, get_my_linear_issues for their tickets, and whats_blocked for what is stuck. Reach for this tool when none of those framings match.

Unlike the other tools, this searches ALL matching work regardless of author or assignee — it is not restricted to the user's own items, only to repositories their tokens can see.

Example: { "query": "checkout timeout", "scope": "work", "max_results": 5 }`;

export interface SearchArgs {
  readonly query: string;
  readonly scope?: Scope | undefined;
  readonly max_results?: number | undefined;
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

function normalizeArgs(args: SearchArgs): { query: string; scope: Scope; maxResults: number } {
  const requested = args.max_results ?? DEFAULT_MAX_RESULTS;
  return {
    query: args.query.trim(),
    scope: args.scope ?? 'both',
    maxResults: Math.max(1, Math.min(Math.trunc(requested), MAX_MAX_RESULTS)),
  };
}

/**
 * Escape a user's free text for GitHub search.
 *
 * Bare qualifier-looking input (`author:someone`) would silently change the query's meaning,
 * so the whole phrase is quoted and embedded quotes are stripped. That keeps the scope
 * qualifiers we add authoritative.
 */
export function quoteSearchTerms(query: string): string {
  const cleaned = query.replace(/["\\]/g, ' ').replace(/\s+/g, ' ').trim();
  return `"${cleaned}"`;
}

async function searchGithubScope(
  ctx: ToolContext,
  scope: GithubScope,
  query: string,
  perPage: number,
): Promise<{ total: number; items: SearchResultItem[] }> {
  const api = ctx.clients.github(scope);
  const qualifier = scopeQualifier(ctx.clients.config, scope);
  const q = `${quoteSearchTerms(query)} is:pr archived:false ${qualifier}`;

  const response = await api.search.issuesAndPullRequests({
    q,
    per_page: perPage,
    advanced_search: 'true',
  });

  return {
    total: response.data.total_count,
    items: response.data.items.map((item) => {
      const repo = repoFromApiUrl(item.repository_url);
      return {
        title: truncateText(item.title, CAPS.title),
        type: 'pr' as const,
        state: item.draft === true ? 'draft' : 'open',
        url: item.html_url,
        source: scope,
        repo,
        number: item.number,
      };
    }),
  };
}

export async function searchMyWork(ctx: ToolContext, args: SearchArgs): Promise<Envelope<SearchResultItem>> {
  const { query, scope, maxResults } = normalizeArgs(args);

  return ctx.cache.wrap(cacheKey(TOOL_NAME, { query, scope, maxResults }), async () => {
    const warnings: UpstreamFailure[] = [];
    const now = ctx.now();
    const scopes = resolveScopes(scope);

    // Ask each upstream for the full budget, then interleave — a topic may live entirely in
    // one place, and under-asking would hide it.
    const githubTasks = scopes.map(async (current) => {
      try {
        return await searchGithubScope(ctx, current, query, maxResults);
      } catch (error: unknown) {
        warnings.push(describeFailure(githubUpstream(current), error, now));
        return undefined;
      }
    });

    const linearTask = (async () => {
      try {
        const { nodes, totalCount } = await searchIssues(ctx.clients.linear, query, maxResults);
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
