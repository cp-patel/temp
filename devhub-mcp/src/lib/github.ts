/**
 * Shared GitHub helpers.
 *
 * GitHub's REST search endpoint returns neither diff stats nor CI state, so listing tools
 * have to enrich each hit. These helpers keep that logic in one place and normalise CI into
 * a single short vocabulary: passing / failing / pending / none / unknown.
 */

import type { GithubApi } from '../clients.js';

/** Check-run conclusions that mean "this build is red". */
const FAILING_CONCLUSIONS: ReadonlySet<string> = new Set([
  'failure',
  'timed_out',
  'cancelled',
  'action_required',
  'startup_failure',
  'stale',
]);

/** Conclusions that are fine to ignore when deciding whether everything passed. */
const BENIGN_CONCLUSIONS: ReadonlySet<string> = new Set(['success', 'skipped', 'neutral']);

/** Normalise the legacy combined-status vocabulary onto the check-run vocabulary. */
function normalizeCombinedState(state: string): string {
  switch (state) {
    case 'success':
      return 'passing';
    case 'failure':
    case 'error':
      return 'failing';
    case 'pending':
      return 'pending';
    default:
      return state;
  }
}

/**
 * One-line CI summary for a commit.
 *
 * Prefers the Checks API and only falls back to the legacy combined-status API when a repo
 * reports no check runs at all — that keeps the common case at a single request.
 */
export async function ciSummary(
  api: GithubApi,
  owner: string,
  repo: string,
  ref: string,
): Promise<string> {
  const checks = await api.checks.listForRef({ owner, repo, ref, per_page: 100 });
  const runs = checks.data.check_runs;

  if (runs.length > 0) {
    const failing = runs.filter((run) => FAILING_CONCLUSIONS.has(run.conclusion ?? ''));
    if (failing.length > 0) return `failing (${failing.length}/${runs.length})`;
    const pending = runs.filter((run) => run.status !== 'completed');
    if (pending.length > 0) return `pending (${pending.length}/${runs.length})`;
    const passing = runs.filter((run) => BENIGN_CONCLUSIONS.has(run.conclusion ?? ''));
    if (passing.length === runs.length) return `passing (${runs.length})`;
    return `mixed (${runs.length})`;
  }

  const combined = await api.repos.getCombinedStatusForRef({ owner, repo, ref });
  if (combined.data.total_count === 0) return 'none';
  return normalizeCombinedState(combined.data.state);
}

export interface CheckDetail {
  readonly name: string;
  readonly conclusion: string;
}

/**
 * Per-check name + conclusion for `get_pr_context`.
 *
 * Capped, because a monorepo can attach hundreds of check runs to one commit and the whole
 * response has to fit ~8,000 characters.
 */
export async function checkDetails(
  api: GithubApi,
  owner: string,
  repo: string,
  ref: string,
  limit: number,
): Promise<{ checks: CheckDetail[]; omitted: number }> {
  const response = await api.checks.listForRef({ owner, repo, ref, per_page: 100 });
  const runs = response.data.check_runs;

  // Surface red and in-progress checks first — a truncated list should keep the problems.
  const ranked = [...runs].sort((a, b) => rankCheck(a) - rankCheck(b));
  const kept = ranked.slice(0, limit).map((run) => ({
    name: run.name,
    conclusion: run.status === 'completed' ? (run.conclusion ?? 'unknown') : run.status,
  }));

  return { checks: kept, omitted: Math.max(0, runs.length - kept.length) };
}

function rankCheck(run: { status: string; conclusion: string | null }): number {
  if (FAILING_CONCLUSIONS.has(run.conclusion ?? '')) return 0;
  if (run.status !== 'completed') return 1;
  return 2;
}
