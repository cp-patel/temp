/**
 * Instrumented fakes for the narrow GitHub / Linear surfaces.
 *
 * Every call is recorded against the scope that made it, which is what makes the
 * credential-separation tests meaningful rather than decorative.
 */

import type {
  DevhubClients,
  GithubApi,
  GithubScope,
  GithubSearchItem,
  Identity,
  LinearApi,
  ToolContext,
} from '../../src/clients.js';
import { TtlCache } from '../../src/lib/cache.js';

export const FIXED_NOW = Date.parse('2026-07-31T12:00:00.000Z');

export interface CallLog {
  readonly calls: string[];
}

export interface FakeGithubOptions {
  /** Search hits returned for this scope. */
  readonly searchItems?: readonly GithubSearchItem[];
  readonly totalCount?: number;
  /** Throw this instead of answering a search. */
  readonly searchError?: unknown;
  readonly additions?: number;
  readonly deletions?: number;
  readonly changedFiles?: number;
  readonly checkRuns?: readonly { name: string; status: string; conclusion: string | null }[];
  readonly login?: string;
}

/** Build a search hit with sensible defaults. */
export function searchItem(overrides: Partial<GithubSearchItem> = {}): GithubSearchItem {
  return {
    number: 1,
    title: 'Fix the thing',
    html_url: 'https://github.com/acme/web/pull/1',
    created_at: '2026-07-20T00:00:00.000Z',
    updated_at: '2026-07-28T00:00:00.000Z',
    repository_url: 'https://api.github.com/repos/acme/web',
    user: { login: 'someone' },
    ...overrides,
  };
}

export function createFakeGithub(scope: GithubScope, options: FakeGithubOptions = {}): GithubApi & CallLog {
  const calls: string[] = [];
  const record = (name: string): void => {
    calls.push(`${scope}:${name}`);
  };

  const api: GithubApi = {
    search: {
      issuesAndPullRequests: async (params) => {
        record(`search(${params.q})`);
        if (options.searchError !== undefined) throw options.searchError;
        const items = options.searchItems ?? [];
        return { data: { total_count: options.totalCount ?? items.length, items } };
      },
    },
    pulls: {
      get: async (params) => {
        record(`pulls.get(${params.owner}/${params.repo}#${params.pull_number})`);
        return {
          data: {
            title: 'Fix the thing',
            body: 'Body text',
            state: 'open',
            additions: options.additions ?? 10,
            deletions: options.deletions ?? 2,
            changed_files: options.changedFiles ?? 3,
            created_at: '2026-07-20T00:00:00.000Z',
            updated_at: '2026-07-28T00:00:00.000Z',
            html_url: `https://github.com/${params.owner}/${params.repo}/pull/${params.pull_number}`,
            user: { login: 'someone' },
            head: { sha: 'deadbeef' },
            requested_reviewers: [],
          },
        };
      },
      listReviews: async (params) => {
        record(`pulls.listReviews(#${params.pull_number})`);
        return { data: [] };
      },
      listReviewComments: async (params) => {
        record(`pulls.listReviewComments(#${params.pull_number})`);
        return { data: [] };
      },
      listFiles: async (params) => {
        record(`pulls.listFiles(#${params.pull_number})`);
        return { data: [] };
      },
      listCommits: async (params) => {
        record(`pulls.listCommits(#${params.pull_number})`);
        return { data: [] };
      },
    },
    checks: {
      listForRef: async (params) => {
        record(`checks.listForRef(${params.ref})`);
        const runs = options.checkRuns ?? [{ name: 'build', status: 'completed', conclusion: 'success' }];
        return { data: { total_count: runs.length, check_runs: runs } };
      },
    },
    repos: {
      getCombinedStatusForRef: async (params) => {
        record(`repos.getCombinedStatusForRef(${params.ref})`);
        return { data: { state: 'success', total_count: 1 } };
      },
    },
    users: {
      getAuthenticated: async () => {
        record('users.getAuthenticated');
        return { data: { login: options.login ?? `${scope}-login` } };
      },
    },
  };

  return Object.assign(api, { calls });
}

export function createFakeLinear(
  handler?: (query: string, variables: Record<string, unknown> | undefined) => unknown,
): LinearApi & CallLog {
  const calls: string[] = [];
  return {
    calls,
    rawRequest: async <TData>(query: string, variables?: Record<string, unknown>) => {
      calls.push('linear:rawRequest');
      const data = handler?.(query, variables);
      return { data: data as TData | undefined };
    },
  };
}

export interface FakeContextOptions {
  readonly work?: FakeGithubOptions;
  readonly personal?: FakeGithubOptions;
  readonly linearHandler?: (query: string, variables: Record<string, unknown> | undefined) => unknown;
  readonly now?: number;
}

export interface FakeContext {
  readonly ctx: ToolContext;
  readonly work: GithubApi & CallLog;
  readonly personal: GithubApi & CallLog;
  readonly linear: LinearApi & CallLog;
}

export const FAKE_IDENTITY: Identity = {
  workLogin: 'work-login',
  personalLogin: 'personal-login',
  linearUserId: 'linear-user-id',
  linearUserName: 'Test User',
};

/** Assemble a `ToolContext` over instrumented fakes. */
export function createFakeContext(options: FakeContextOptions = {}): FakeContext {
  const work = createFakeGithub('work', options.work ?? {});
  const personal = createFakeGithub('personal', options.personal ?? {});
  const linear = createFakeLinear(options.linearHandler);
  const now = options.now ?? FIXED_NOW;

  const clients: DevhubClients = {
    config: {
      workOrg: 'acme',
      personalUsername: 'octo-personal',
      linearUserEmail: 'me@example.com',
    },
    github: (scope: GithubScope) => (scope === 'work' ? work : personal),
    linear,
  };

  const ctx: ToolContext = {
    clients,
    identity: FAKE_IDENTITY,
    cache: new TtlCache(60_000, () => now),
    now: () => now,
  };

  return { ctx, work, personal, linear };
}
