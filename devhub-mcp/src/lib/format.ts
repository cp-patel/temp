/**
 * Shared item shapes and JSON output helpers.
 *
 * Every tool returns the same envelope so the calling LLM learns one shape, and every
 * response passes through `toolJson`, which enforces the char budget in exactly one place.
 */

import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { UpstreamFailure } from './errors.js';
import { CAPS, MAX_RESPONSE_CHARS, payloadChars, serializeCompact, truncateText } from './truncate.js';

/** Which credential a result came from. Present on every item when scope is "both". */
export type Source = 'work' | 'personal';

/** Compact pull-request shape, shared by review-queue, my-prs, whats-blocked and search. */
export interface PrItem {
  source: Source;
  /** "owner/name" */
  repo: string;
  number: number;
  title: string;
  author: string;
  age_days: number;
  url: string;
  draft?: boolean;
  additions?: number;
  deletions?: number;
  changed_files?: number;
  /** Short CI summary, e.g. "passing", "failing (2/14)", "pending", "none". */
  ci?: string;
  /** Review roll-up, present on authored-PR listings. */
  approvals?: number;
  changes_requested?: boolean;
  awaiting?: string[];
  days_since_activity?: number;
  /** Why this item appears in a `whats_blocked` section. */
  reason?: string;
}

/** Compact Linear issue shape. */
export interface IssueItem {
  /** e.g. "ENG-123" */
  identifier: string;
  title: string;
  state: string;
  priority: string;
  project?: string;
  days_in_state: number;
  url: string;
  /** Why this issue counts as blocked. */
  reason?: string;
}

/** The standard list envelope. */
export interface Envelope<T> {
  items: T[];
  total_found: number;
  has_more: boolean;
  /** Partial upstream failures. Present only when something actually failed. */
  warnings?: UpstreamFailure[];
  /** Server-side truncation disclosures. Never silent. */
  notes?: string[];
}

/** Whole-day age from an ISO timestamp. Clamped at 0 so clock skew cannot go negative. */
export function ageInDays(iso: string | null | undefined, now: number = Date.now()): number {
  if (iso === null || iso === undefined || iso === '') return 0;
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return 0;
  return Math.max(0, Math.floor((now - then) / 86_400_000));
}

/** Split a GitHub API `repository_url` into "owner/name". Falls back to the raw tail. */
export function repoFromApiUrl(repositoryUrl: string): string {
  const match = /\/repos\/([^/]+)\/([^/?#]+)/.exec(repositoryUrl);
  if (match === null) return truncateText(repositoryUrl, CAPS.label);
  return `${match[1] ?? ''}/${match[2] ?? ''}`;
}

/** Split "owner/name" into parts, for callers that received a repo string as tool input. */
export function splitRepo(repo: string): { owner: string; name: string } | undefined {
  const trimmed = repo.trim();
  const parts = trimmed.split('/').filter((part) => part !== '');
  if (parts.length !== 2) return undefined;
  return { owner: parts[0] as string, name: parts[1] as string };
}

interface EnvelopeInput<T> {
  items: T[];
  /** Upstream match count, which may exceed what we fetched. */
  totalFound: number;
  warnings?: readonly UpstreamFailure[];
  notes?: readonly string[];
}

/**
 * Assemble an envelope and shrink it until it fits the char budget.
 *
 * Items are dropped from the tail (they are always sorted least-interesting-last) and the
 * drop is disclosed in `notes` — ground rule 4 allows truncation, but silent truncation
 * would read as "this is everything".
 */
export function buildEnvelope<T>(input: EnvelopeInput<T>, maxChars: number = MAX_RESPONSE_CHARS): Envelope<T> {
  const warnings = input.warnings ?? [];
  const notes = [...(input.notes ?? [])];
  let items = input.items;

  const assemble = (currentItems: T[], currentNotes: readonly string[]): Envelope<T> => {
    const envelope: Envelope<T> = {
      items: currentItems,
      total_found: input.totalFound,
      // `total_found` is the upstream match count, so this stays correct whether items were
      // capped by max_results or trimmed for budget.
      has_more: input.totalFound > currentItems.length,
    };
    if (warnings.length > 0) envelope.warnings = [...warnings];
    if (currentNotes.length > 0) envelope.notes = [...currentNotes];
    return envelope;
  };

  let dropped = 0;
  while (items.length > 0 && payloadChars(assemble(items, [...notes, budgetNote(dropped + 1)])) > maxChars) {
    items = items.slice(0, items.length - 1);
    dropped += 1;
  }

  if (dropped > 0) notes.push(budgetNote(dropped));
  return assemble(items, notes);
}

function budgetNote(dropped: number): string {
  return `${dropped} further result${dropped === 1 ? '' : 's'} omitted to stay within the response size budget`;
}

/** Serialise a payload as a tool result, enforcing the char budget as a final guard. */
export function toolJson(payload: unknown, maxChars: number = MAX_RESPONSE_CHARS): CallToolResult {
  let text = serializeCompact(payload);
  if (text.length > maxChars) {
    // Reaching here means a single item blew the budget on its own. Fail loudly and
    // compactly rather than shipping a response that poisons the client's context.
    text = serializeCompact({
      error: 'response_too_large',
      hint: `Result did not fit the ${maxChars}-character budget after truncation. Narrow the request (lower max_results, or use a more specific tool).`,
      actual_chars: text.length,
    });
  }
  return { content: [{ type: 'text', text }] };
}

/** Serialise a hard failure as an MCP tool error, so the server stays alive. */
export function toolError(failures: readonly UpstreamFailure[], hint?: string): CallToolResult {
  const payload: { error: string; failures: UpstreamFailure[]; hint?: string } = {
    error: 'upstream_failure',
    failures: [...failures],
  };
  if (hint !== undefined) payload.hint = hint;
  return { content: [{ type: 'text', text: serializeCompact(payload) }], isError: true };
}

/** Render a Linear priority number as a label. 0 means "no priority" in Linear. */
export function priorityLabel(priority: number | null | undefined): string {
  switch (priority) {
    case 1:
      return 'urgent';
    case 2:
      return 'high';
    case 3:
      return 'medium';
    case 4:
      return 'low';
    default:
      return 'none';
  }
}
