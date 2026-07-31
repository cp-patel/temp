/**
 * Tool 8: `get_devhub_config` — the troubleshooting tool.
 *
 * When a queue comes back empty, the first question is "is it broken or really empty?".
 * This reports which identities and orgs the server actually resolved at startup, plus the
 * limits in force — so an LLM can explain a misconfiguration ("your work scope queries the
 * org `acme`, but your PRs are in `acme-labs`") instead of shrugging.
 *
 * Deliberately makes NO upstream calls: everything here was established during startup
 * validation, so the answer is instant and cannot itself fail.
 */

import { MAX_RESPONSE_CHARS } from '../lib/truncate.js';
import { DEFAULT_TTL_MS } from '../lib/cache.js';
import type { ToolContext } from '../clients.js';

export const TOOL_NAME = 'get_devhub_config';

export const configInfoInputSchema = {};

export const configInfoDescription = `Returns this server's resolved configuration: which GitHub logins each scope authenticates as, which org and username the scopes query, the Linear account in use, the whats_blocked staleness thresholds, and operational limits (timeouts, cache TTL, response budget). Takes no parameters and makes no API calls — the answer is instant.

Use this to TROUBLESHOOT when another tool's result looks wrong: an empty review queue, a Linear list that should not be empty, or results from an unexpected account. Typical use: call it once, compare work_org / logins / linear_email against what the user expects, and explain any mismatch. Do not call it for normal work questions — it says nothing about PRs or issues.

All tools on this server are read-only; this tool confirms that too (read_only: true).

Example: {}`;

export interface ConfigInfo {
  readonly server: { readonly name: string; readonly version: string; readonly read_only: true };
  readonly github: {
    readonly work_login: string;
    readonly work_org: string;
    readonly personal_login: string;
    readonly personal_username: string;
  };
  readonly linear: { readonly user_name: string; readonly email: string };
  readonly thresholds: {
    readonly stale_pr_days: number;
    readonly blocking_review_days: number;
  };
  readonly limits: {
    readonly upstream_timeout_seconds: number;
    readonly cache_ttl_seconds: number;
    readonly response_budget_chars: number;
  };
  readonly notes: string[];
}

export function getDevhubConfig(ctx: ToolContext, serverName: string, serverVersion: string): ConfigInfo {
  const { config } = ctx.clients;
  return {
    server: { name: serverName, version: serverVersion, read_only: true },
    github: {
      work_login: ctx.identity.workLogin,
      work_org: config.workOrg,
      personal_login: ctx.identity.personalLogin,
      personal_username: config.personalUsername,
    },
    linear: { user_name: ctx.identity.linearUserName, email: config.linearUserEmail },
    thresholds: {
      stale_pr_days: config.stalePrDays,
      blocking_review_days: config.blockingReviewDays,
    },
    limits: {
      upstream_timeout_seconds: Math.round(config.upstreamTimeoutMs / 1000),
      cache_ttl_seconds: Math.round(DEFAULT_TTL_MS / 1000),
      response_budget_chars: MAX_RESPONSE_CHARS,
    },
    notes: [
      'Work-scope queries are pinned to org:' + config.workOrg + ' using the work token only.',
      'Personal-scope queries are pinned to user:' + config.personalUsername + ' using the personal token only.',
      'Linear "my issues" are resolved by the email above; if it does not match the account behind the API key, Linear lists will be empty.',
    ],
  };
}
