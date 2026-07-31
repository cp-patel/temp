/**
 * Client construction and startup validation.
 *
 * Credential separation (ground rule 5) is enforced structurally:
 *  - Two Octokit instances are built from two different tokens and stored in a frozen
 *    record keyed by scope. The only way to reach one is `github(scope)` with an explicit
 *    scope — there is no default and no fallback between them.
 *  - The search qualifier is also derived from the scope (`org:<workOrg>` vs
 *    `user:<personalUsername>`), so even a leaked client could not silently widen a query.
 */

import { Octokit } from '@octokit/rest';
import { LinearClient } from '@linear/sdk';
import { z } from 'zod';
import { StartupError, describeFailure, scrub } from './lib/errors.js';
import { DEFAULT_UPSTREAM_TIMEOUT_MS, timeoutFetch, withTimeout } from './lib/http.js';
import type { TtlCache } from './lib/cache.js';

export type GithubScope = 'work' | 'personal';
export type Scope = GithubScope | 'both';

const ALL_GITHUB_SCOPES: readonly GithubScope[] = ['work', 'personal'] as const;

/** Expand a tool's `scope` argument into the concrete GitHub scopes to query. */
export function resolveScopes(scope: Scope): readonly GithubScope[] {
  return scope === 'both' ? ALL_GITHUB_SCOPES : [scope];
}

/* ------------------------------------------------------------------------------------- *
 * Narrow GitHub surface
 *
 * Only the endpoints this server actually calls, with only the fields it actually reads.
 * A real `octokit.rest` satisfies this structurally, and a test can supply an instrumented
 * stub without reconstructing Octokit's full type.
 * ------------------------------------------------------------------------------------- */

export interface GithubSearchItem {
  readonly number: number;
  readonly title: string;
  readonly html_url: string;
  readonly created_at: string;
  readonly updated_at: string;
  readonly repository_url: string;
  readonly draft?: boolean | undefined;
  readonly user: { readonly login: string } | null;
  /** "open" | "closed". The queue tools pin `is:open`, but `search_my_work` does not. */
  readonly state?: string | undefined;
  /** Present on PR hits; a non-null `merged_at` distinguishes merged from merely closed. */
  readonly pull_request?: { readonly merged_at?: string | null | undefined } | null | undefined;
}

export interface GithubApi {
  readonly search: {
    issuesAndPullRequests(params: {
      q: string;
      sort?: 'created';
      order?: 'asc' | 'desc';
      per_page?: number;
      /**
       * Opts into GitHub's advanced issues search.
       *
       * Typed as a string, not a boolean: GitHub's own OpenAPI spec declares
       * `components.parameters["issues-advanced-search"]?: string` and documents it as
       * "Set to `true` to use advanced search", so the value sent is the string "true".
       * Passing it is the forward-compatible choice as the legacy implementation is retired.
       */
      advanced_search?: string;
    }): Promise<{ data: { total_count: number; items: readonly GithubSearchItem[] } }>;
  };
  readonly pulls: {
    get(params: { owner: string; repo: string; pull_number: number }): Promise<{
      data: {
        title: string;
        body: string | null;
        state: string;
        draft?: boolean | undefined;
        additions: number;
        deletions: number;
        changed_files: number;
        created_at: string;
        updated_at: string;
        html_url: string;
        user: { login: string } | null;
        head: { sha: string };
        requested_reviewers?: readonly { login: string }[] | null | undefined;
        /**
         * Teams whose review is requested. Read alongside requested_reviewers: a PR waiting
         * solely on a team would otherwise report "no reviewer has responded", which is wrong.
         */
        requested_teams?: readonly { slug: string }[] | null | undefined;
      };
    }>;
    listReviews(params: { owner: string; repo: string; pull_number: number; per_page?: number }): Promise<{
      data: readonly {
        state: string;
        submitted_at?: string | null | undefined;
        user: { login: string } | null;
      }[];
    }>;
    listReviewComments(params: {
      owner: string;
      repo: string;
      pull_number: number;
      per_page?: number;
    }): Promise<{
      data: readonly {
        body: string;
        path: string;
        created_at: string;
        user: { login: string } | null;
      }[];
    }>;
    listFiles(params: { owner: string; repo: string; pull_number: number; per_page?: number }): Promise<{
      data: readonly { filename: string; additions: number; deletions: number }[];
    }>;
  };
  readonly checks: {
    listForRef(params: { owner: string; repo: string; ref: string; per_page?: number }): Promise<{
      data: {
        total_count: number;
        check_runs: readonly { name: string; status: string; conclusion: string | null }[];
      };
    }>;
  };
  readonly repos: {
    getCombinedStatusForRef(params: { owner: string; repo: string; ref: string }): Promise<{
      data: { state: string; total_count: number };
    }>;
    /**
     * Used to date a PR's newest commit via its head SHA.
     *
     * Deliberately not `pulls.listCommits`: that endpoint pages through up to 250 commits in
     * a documented order, so page 1 of a 150-commit PR would yield the *oldest* commits and
     * make a freshly-pushed PR look stale. The head SHA is the branch tip by definition, so
     * this is correct regardless of any ordering guarantee.
     */
    getCommit(params: { owner: string; repo: string; ref: string }): Promise<{
      data: {
        commit: {
          author?: { date?: string | undefined } | null | undefined;
          committer?: { date?: string | undefined } | null | undefined;
        };
      };
    }>;
  };
  readonly users: {
    getAuthenticated(): Promise<{ data: { login: string } }>;
  };
}

/* ------------------------------------------------------------------------------------- *
 * Narrow Linear surface
 * ------------------------------------------------------------------------------------- */

export interface LinearRawResponse<T> {
  readonly data?: T | undefined;
}

export interface LinearApi {
  /**
   * Raw GraphQL. Used deliberately instead of the typed helpers: on the SDK's `Issue`
   * model, `state`, `project` and `assignee` are lazy `LinearFetch<T>` promises
   * (verified in @linear/sdk 89 index.d.mts), so awaiting them per issue is an N+1 storm.
   * One GraphQL document fetches everything in a single round trip.
   */
  rawRequest<TData>(query: string, variables?: Record<string, unknown>): Promise<LinearRawResponse<TData>>;
}

/* ------------------------------------------------------------------------------------- *
 * Configuration
 * ------------------------------------------------------------------------------------- */

export interface DevhubConfig {
  readonly workOrg: string;
  readonly personalUsername: string;
  readonly linearUserEmail: string;
  /**
   * Staleness thresholds for `whats_blocked`, in whole days. Optional overrides via
   * DEVHUB_STALE_PR_DAYS / DEVHUB_BLOCKING_REVIEW_DAYS — a team with a 24-hour review SLA
   * has a very different notion of "stalled" than the 3/5-day defaults.
   */
  readonly stalePrDays: number;
  readonly blockingReviewDays: number;
  /** The per-request upstream deadline in force, surfaced by `get_devhub_config`. */
  readonly upstreamTimeoutMs: number;
}

/** Non-empty after trimming — an env var set to "" is as broken as one that is missing. */
const requiredString = z.string().trim().min(1);

/** Optional whole-day threshold: unset is fine, garbage is a startup error, not a default. */
const optionalDays = z.coerce.number().int().min(1).max(90).optional();

const envSchema = z.object({
  GITHUB_WORK_TOKEN: requiredString,
  GITHUB_PERSONAL_TOKEN: requiredString,
  GITHUB_WORK_ORG: requiredString,
  GITHUB_PERSONAL_USERNAME: requiredString,
  LINEAR_API_KEY: requiredString,
  LINEAR_USER_EMAIL: requiredString.pipe(z.string().email()),
  DEVHUB_STALE_PR_DAYS: optionalDays,
  DEVHUB_BLOCKING_REVIEW_DAYS: optionalDays,
});

export type DevhubEnv = z.infer<typeof envSchema>;

/**
 * Validate the six required variables.
 *
 * Throws a `StartupError` naming the offending variables — never their values.
 */
export function readEnv(env: NodeJS.ProcessEnv): DevhubEnv {
  const parsed = envSchema.safeParse(env);
  if (parsed.success) return parsed.data;

  const problems = parsed.error.issues.map((issue) => {
    const name = String(issue.path[0] ?? 'unknown');
    const reason = issue.code === 'invalid_type' ? 'is missing' : `is invalid (${issue.message})`;
    return { name, text: `${name} ${reason}` };
  });
  const names = [...new Set(problems.map((problem) => problem.name))];
  throw new StartupError(
    `Configuration error:\n${problems.map((problem) => `  - ${problem.text}`).join('\n')}`,
    names,
  );
}

/* ------------------------------------------------------------------------------------- *
 * Clients
 * ------------------------------------------------------------------------------------- */

export interface DevhubClients {
  readonly config: DevhubConfig;
  /** The only way to obtain a GitHub client. Explicit scope, no default, no fallback. */
  github(scope: GithubScope): GithubApi;
  readonly linear: LinearApi;
}

const USER_AGENT = 'devhub-mcp/0.1.0';

/**
 * Route Octokit's own logging to stderr, scrubbed.
 *
 * Under the stdio transport stdout *is* the JSON-RPC channel, so any dependency that writes
 * to console.log would corrupt the protocol stream. Octokit currently logs through
 * console.warn (stderr), but pinning the sink here makes that our guarantee rather than an
 * implementation detail we inherit.
 */
const octokitLog = {
  debug: (): void => {},
  info: (): void => {},
  warn: (message: string): void => {
    process.stderr.write(`devhub-mcp: octokit: ${scrub(String(message))}\n`);
  },
  error: (message: string): void => {
    process.stderr.write(`devhub-mcp: octokit: ${scrub(String(message))}\n`);
  },
};

export interface ClientOptions {
  /** Per-request upstream deadline. Overridable so tests can exercise the path in ms. */
  readonly timeoutMs?: number;
}

/** Build both GitHub clients and the Linear client. Performs no network I/O. */
export function createClients(env: NodeJS.ProcessEnv = process.env, options: ClientOptions = {}): DevhubClients {
  const config = readEnv(env);
  const timeoutMs = options.timeoutMs ?? DEFAULT_UPSTREAM_TIMEOUT_MS;

  // Two instances, two tokens. Never merged, never reused across scopes. Both use the
  // deadline-enforcing fetch so a stalled upstream cannot hang a tool call.
  const octokitOptions = {
    userAgent: USER_AGENT,
    log: octokitLog,
    request: { fetch: timeoutFetch(timeoutMs) },
  };
  const githubByScope: Readonly<Record<GithubScope, GithubApi>> = Object.freeze({
    work: new Octokit({ ...octokitOptions, auth: config.GITHUB_WORK_TOKEN }).rest,
    personal: new Octokit({ ...octokitOptions, auth: config.GITHUB_PERSONAL_TOKEN }).rest,
  });

  const linearClient = new LinearClient({ apiKey: config.LINEAR_API_KEY });

  return {
    config: {
      workOrg: config.GITHUB_WORK_ORG,
      personalUsername: config.GITHUB_PERSONAL_USERNAME,
      linearUserEmail: config.LINEAR_USER_EMAIL,
      stalePrDays: config.DEVHUB_STALE_PR_DAYS ?? 3,
      blockingReviewDays: config.DEVHUB_BLOCKING_REVIEW_DAYS ?? 5,
      upstreamTimeoutMs: timeoutMs,
    },
    github(scope: GithubScope): GithubApi {
      return githubByScope[scope];
    },
    linear: {
      rawRequest: async <TData>(query: string, variables?: Record<string, unknown>) => {
        // The Linear client has no per-request fetch hook (its options extend RequestInit,
        // where a signal would be one-shot for the client's lifetime), so the deadline is a
        // race at this wrapper instead.
        const response = await withTimeout(
          linearClient.client.rawRequest<TData, Record<string, unknown>>(query, variables ?? {}),
          timeoutMs,
          'Linear',
        );
        return { data: response.data ?? undefined };
      },
    },
  };
}

/* ------------------------------------------------------------------------------------- *
 * Startup validation
 * ------------------------------------------------------------------------------------- */

export interface Identity {
  /** Login behind GITHUB_WORK_TOKEN. */
  readonly workLogin: string;
  /** Login behind GITHUB_PERSONAL_TOKEN. */
  readonly personalLogin: string;
  /** Display name of the Linear account, reported at startup so a mix-up is visible. */
  readonly linearUserName: string;
}

/** The login to use in `review-requested:` / `author:` qualifiers for a scope. */
export function loginFor(identity: Identity, scope: GithubScope): string {
  return scope === 'work' ? identity.workLogin : identity.personalLogin;
}

/**
 * The scope-restricting search qualifier.
 *
 * Work queries are pinned to the org; personal queries to the user's own repos. This is the
 * second half of credential separation: the token limits what *can* be read, this limits
 * what is *asked for*.
 */
export function scopeQualifier(config: DevhubConfig, scope: GithubScope): string {
  return scope === 'work' ? `org:${config.workOrg}` : `user:${config.personalUsername}`;
}

interface ViewerQueryResult {
  readonly viewer: {
    readonly name: string;
    /** Compared against LINEAR_USER_EMAIL at startup; null on accounts that hide it. */
    readonly email: string | null;
  } | null;
}

const VIEWER_QUERY = `query DevhubViewer { viewer { name email } }`;

/**
 * Fail fast: one cheap authenticated call per client.
 *
 * On failure, throws a `StartupError` naming the responsible variable so the operator knows
 * exactly which credential to fix. Token values never appear in the message.
 */
export async function validateStartup(clients: DevhubClients): Promise<Identity> {
  const [work, personal, linear] = await Promise.all([
    clients
      .github('work')
      .users.getAuthenticated()
      .then((response) => ({ ok: true as const, login: response.data.login }))
      .catch((error: unknown) => ({ ok: false as const, error })),
    clients
      .github('personal')
      .users.getAuthenticated()
      .then((response) => ({ ok: true as const, login: response.data.login }))
      .catch((error: unknown) => ({ ok: false as const, error })),
    clients.linear
      .rawRequest<ViewerQueryResult>(VIEWER_QUERY)
      .then((response) => ({ ok: true as const, viewer: response.data?.viewer ?? null }))
      .catch((error: unknown) => ({ ok: false as const, error })),
  ]);

  const problems: string[] = [];
  const variables: string[] = [];

  if (!work.ok) {
    problems.push(`  - GITHUB_WORK_TOKEN: ${describeFailure('github-work', work.error).hint}`);
    variables.push('GITHUB_WORK_TOKEN');
  }
  if (!personal.ok) {
    problems.push(`  - GITHUB_PERSONAL_TOKEN: ${describeFailure('github-personal', personal.error).hint}`);
    variables.push('GITHUB_PERSONAL_TOKEN');
  }
  if (!linear.ok) {
    problems.push(`  - LINEAR_API_KEY: ${describeFailure('linear', linear.error).hint}`);
    variables.push('LINEAR_API_KEY');
  } else if (linear.viewer === null) {
    problems.push('  - LINEAR_API_KEY: authenticated but returned no viewer');
    variables.push('LINEAR_API_KEY');
  }

  if (problems.length > 0) {
    throw new StartupError(`Credential validation failed:\n${problems.join('\n')}`, variables);
  }

  // Narrowing for TypeScript: every failure path above throws.
  if (!work.ok || !personal.ok || !linear.ok || linear.viewer === null) {
    throw new StartupError('Credential validation failed', variables);
  }

  // A LINEAR_USER_EMAIL that does not match the key's own account is not an auth failure, but
  // it would make every "my issues" filter match nothing. Warn loudly rather than fail: the
  // account may legitimately use an alias, and the other five tools still work.
  const viewerEmail = linear.viewer.email;
  if (viewerEmail !== null && viewerEmail.toLowerCase() !== clients.config.linearUserEmail.toLowerCase()) {
    process.stderr.write(
      `devhub-mcp: WARNING LINEAR_USER_EMAIL does not match the account behind LINEAR_API_KEY. ` +
        `Linear tools resolve "my issues" by that email and will return nothing if it is wrong.\n`,
    );
  }

  return {
    workLogin: work.login,
    personalLogin: personal.login,
    linearUserName: linear.viewer.name,
  };
}

/** Everything a tool implementation needs. Passed explicitly so tools stay pure and testable. */
export interface ToolContext {
  readonly clients: DevhubClients;
  readonly identity: Identity;
  readonly cache: TtlCache;
  /** Injectable clock, so age/staleness maths is deterministic in tests. */
  readonly now: () => number;
}
