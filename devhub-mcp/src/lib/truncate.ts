/**
 * Shared truncation and char-budget helpers.
 *
 * Ground rule 4: no tool response may exceed roughly 2,000 tokens (~8,000 characters).
 * Every field cap here exists so that a *single* item stays small enough that trimming
 * whole items (see `fitEnvelope` in format.ts) is always enough to land under budget.
 */

/** Hard ceiling for a single tool response, in characters. */
export const MAX_RESPONSE_CHARS = 8_000;

/** Per-field character caps, kept in one place so budgets are auditable. */
export const CAPS = {
  /** PR / issue titles. Long enough to stay meaningful, short enough to list 30 of them. */
  title: 120,
  /** PR body in `get_pr_context` — the spec fixes this at 1,500 chars. */
  prBody: 1_500,
  /** Review comment bodies in `get_pr_context`. */
  reviewComment: 240,
  /** Project / state / repo names and other short labels. */
  label: 80,
} as const;

/**
 * Collapse whitespace-ish noise and hard-cap a string.
 *
 * Returns `''` for null/undefined so callers never have to branch. The ellipsis is a
 * single character (U+2026), and is counted inside `maxChars` — the result is never
 * longer than `maxChars`.
 */
export function truncateText(value: string | null | undefined, maxChars: number): string {
  if (value === null || value === undefined) return '';
  const normalized = value.replace(/\r\n/g, '\n').trim();
  if (normalized.length <= maxChars) return normalized;
  if (maxChars <= 1) return normalized.slice(0, Math.max(0, maxChars));
  return `${normalized.slice(0, maxChars - 1).trimEnd()}…`;
}

/**
 * Truncate a multi-line body and drop trailing blank lines.
 *
 * Used for PR descriptions, which are often long markdown with template boilerplate.
 */
export function truncateBody(value: string | null | undefined, maxChars: number = CAPS.prBody): string {
  return truncateText(value, maxChars);
}

/** Compact serialisation used for every budget measurement, so checks match output exactly. */
export function serializeCompact(payload: unknown): string {
  return JSON.stringify(payload) ?? 'null';
}

/** Character length of a payload once serialised the way it will actually be returned. */
export function payloadChars(payload: unknown): number {
  return serializeCompact(payload).length;
}
