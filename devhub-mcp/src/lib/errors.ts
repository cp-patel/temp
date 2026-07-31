/**
 * Structured upstream failures.
 *
 * Two hard rules from the spec drive this file:
 *  - A failing API call must become a *structured tool error*, never an exception that
 *    kills the stdio server.
 *  - Errors must never contain token values, and never a full request URL with query
 *    params (search queries can contain org names and logins).
 */

/** Which upstream produced a failure. Named per credential, not per product. */
export type Upstream = 'github-work' | 'github-personal' | 'linear';

export interface UpstreamFailure {
  readonly upstream: Upstream;
  /** HTTP status when the upstream provided one. */
  readonly status?: number;
  /** One-line, human-readable next step. */
  readonly hint: string;
}

/**
 * Token shapes we refuse to echo. GitHub PATs (`ghp_`, `github_pat_`, and the other
 * `gh?_` prefixes) and Linear keys (`lin_api_`) are all matched.
 */
const SECRET_PATTERNS: readonly RegExp[] = [
  /github_pat_[A-Za-z0-9_]{10,}/g,
  /gh[pousra]_[A-Za-z0-9]{10,}/g,
  /lin_(?:api|oauth)_[A-Za-z0-9]{10,}/g,
  /\bBearer\s+[A-Za-z0-9._~+/-]{10,}=*/g,
];

/**
 * Remove credentials and query strings from a message before it can reach a client.
 *
 * Applied to every upstream message we surface. Order matters: redact secrets first, then
 * strip query strings (which is where search terms and `access_token=` would live).
 */
export function scrub(message: string): string {
  let out = message;
  for (const pattern of SECRET_PATTERNS) out = out.replace(pattern, '[redacted]');
  // Drop `?...` from any URL, keeping the path so the failing endpoint is still identifiable.
  out = out.replace(/(https?:\/\/[^\s?#]+)[?#][^\s]*/g, '$1');
  return out.trim();
}

/** Build a failure without tripping `exactOptionalPropertyTypes` on an absent status. */
function failure(upstream: Upstream, status: number | undefined, hint: string): UpstreamFailure {
  return status === undefined ? { upstream, hint } : { upstream, status, hint };
}

function readStatus(error: unknown): number | undefined {
  if (typeof error !== 'object' || error === null) return undefined;
  const status = (error as { status?: unknown }).status;
  return typeof status === 'number' ? status : undefined;
}

/** Octokit's RequestError carries `response.headers`; anything else yields an empty bag. */
function readHeaders(error: unknown): Record<string, string> {
  if (typeof error !== 'object' || error === null) return {};
  const response = (error as { response?: unknown }).response;
  if (typeof response !== 'object' || response === null) return {};
  const headers = (response as { headers?: unknown }).headers;
  if (typeof headers !== 'object' || headers === null) return {};
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers as Record<string, unknown>)) {
    if (typeof value === 'string') out[key.toLowerCase()] = value;
    else if (typeof value === 'number') out[key.toLowerCase()] = String(value);
  }
  return out;
}

function readMessage(error: unknown): string {
  if (error instanceof Error) return scrub(error.message);
  if (typeof error === 'string') return scrub(error);
  return 'unknown error';
}

/**
 * Minutes until a rate limit clears.
 *
 * Prefers `retry-after` (seconds, used for secondary limits) and falls back to
 * `x-ratelimit-reset` (absolute unix seconds). Always at least 1, so we never say
 * "retry in 0 minutes".
 */
function minutesUntilReset(headers: Record<string, string>, now: number): number {
  const retryAfter = Number(headers['retry-after']);
  if (Number.isFinite(retryAfter) && retryAfter > 0) {
    return Math.max(1, Math.ceil(retryAfter / 60));
  }
  const reset = Number(headers['x-ratelimit-reset']);
  if (Number.isFinite(reset) && reset > 0) {
    return Math.max(1, Math.ceil((reset * 1_000 - now) / 60_000));
  }
  return 1;
}

function isRateLimited(status: number | undefined, headers: Record<string, string>): boolean {
  if (status === 429) return true;
  if (status !== 403) return false;
  // A 403 is only a rate limit when GitHub says the budget is actually spent; a 403 with
  // remaining quota means a scope/SSO problem instead.
  return headers['x-ratelimit-remaining'] === '0' || headers['retry-after'] !== undefined;
}

/** Human-readable next step for a GitHub status code. */
function githubHint(upstream: Upstream, status: number | undefined, message: string): string {
  const tokenVar = upstream === 'github-work' ? 'GITHUB_WORK_TOKEN' : 'GITHUB_PERSONAL_TOKEN';
  switch (status) {
    case 401:
      return `${tokenVar} was rejected — it may be expired or revoked`;
    case 403:
      return `${tokenVar} may lack repo read scope, or the org requires SAML/SSO authorization for this token`;
    case 404:
      return `not found, or invisible to ${tokenVar} — fine-grained PATs report unauthorised repos as 404`;
    case 422:
      return `GitHub rejected the search query as invalid: ${message}`;
    case 503:
    case 502:
    case 500:
      return 'GitHub returned a server error; try again shortly';
    default:
      return message === '' ? 'GitHub request failed' : `GitHub request failed: ${message}`;
  }
}

function linearHint(status: number | undefined, message: string): string {
  switch (status) {
    case 400:
      return `Linear rejected the query: ${message}`;
    case 401:
    case 403:
      return 'LINEAR_API_KEY was rejected — it may be expired, revoked, or lack read access';
    case 429:
      return 'Linear rate limit reached; try again shortly';
    default:
      return message === '' ? 'Linear request failed' : `Linear request failed: ${message}`;
  }
}

/**
 * Convert any thrown value into a safe, structured `UpstreamFailure`.
 *
 * `now` is injectable so rate-limit maths is testable.
 */
export function describeFailure(
  upstream: Upstream,
  error: unknown,
  now: number = Date.now(),
): UpstreamFailure {
  const status = readStatus(error);
  const headers = readHeaders(error);
  const message = readMessage(error);

  if (isRateLimited(status, headers)) {
    const minutes = minutesUntilReset(headers, now);
    return failure(
      upstream,
      status,
      `rate limit exceeded; resets in about ${minutes} minute${minutes === 1 ? '' : 's'} (not retrying automatically)`,
    );
  }

  const hint = upstream === 'linear' ? linearHint(status, message) : githubHint(upstream, status, message);
  return failure(upstream, status, hint);
}

/** Map a GitHub scope to its upstream identifier. */
export function githubUpstream(scope: 'work' | 'personal'): Upstream {
  return scope === 'work' ? 'github-work' : 'github-personal';
}

/** Thrown only during startup validation, so `index.ts` can name the offending variable. */
export class StartupError extends Error {
  constructor(
    message: string,
    readonly variables: readonly string[],
  ) {
    super(message);
    this.name = 'StartupError';
  }
}
