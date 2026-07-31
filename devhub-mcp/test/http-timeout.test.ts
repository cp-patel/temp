/**
 * Upstream deadlines: a stalled GitHub or Linear must fail the tool call into the normal
 * structured-error path instead of hanging the MCP session.
 */

import { describe, expect, it } from 'vitest';
import { timeoutFetch, withTimeout } from '../src/lib/http.js';
import { describeFailure } from '../src/lib/errors.js';

type FetchLike = typeof globalThis.fetch;

/** A base fetch that never answers but honours its abort signal, like a stalled socket. */
const stalledFetch: FetchLike = (_input, init) =>
  new Promise((_resolve, reject) => {
    init?.signal?.addEventListener('abort', () => {
      reject(init.signal?.reason as Error);
    });
  });

describe('timeoutFetch', () => {
  it('aborts a stalled request after the deadline', async () => {
    const fetchWithDeadline = timeoutFetch(20, stalledFetch);

    await expect(fetchWithDeadline('https://api.github.com/user')).rejects.toMatchObject({
      name: 'TimeoutError',
    });
  });

  it('passes through a fast response untouched', async () => {
    const quick: FetchLike = async () => new Response('ok');
    const fetchWithDeadline = timeoutFetch(1_000, quick);

    const response = await fetchWithDeadline('https://api.github.com/user');
    expect(await response.text()).toBe('ok');
  });
});

describe('withTimeout', () => {
  it('rejects a promise that outlives the deadline, naming the upstream', async () => {
    const never = new Promise<never>(() => {});
    await expect(withTimeout(never, 20, 'Linear')).rejects.toThrow(/Linear did not respond within/);
  });

  it('resolves a prompt promise and clears its timer', async () => {
    await expect(withTimeout(Promise.resolve(42), 1_000, 'Linear')).resolves.toBe(42);
  });

  it('propagates the original rejection when the work fails before the deadline', async () => {
    await expect(withTimeout(Promise.reject(new Error('real cause')), 1_000, 'Linear')).rejects.toThrow(
      'real cause',
    );
  });
});

describe('timeout failures become readable hints', () => {
  const now = Date.parse('2026-07-31T12:00:00.000Z');

  it('maps a TimeoutError DOMException to a deadline hint', () => {
    const error = new DOMException('The operation was aborted due to timeout', 'TimeoutError');
    const failure = describeFailure('github-work', error, now);
    expect(failure.hint).toMatch(/did not respond before the request deadline/);
    expect('status' in failure).toBe(false);
  });

  it('maps the withTimeout message to the same hint', () => {
    const failure = describeFailure('linear', new Error('Linear did not respond within 15s'), now);
    expect(failure.hint).toMatch(/did not respond before the request deadline/);
  });

  it('does not misread an ordinary error as a timeout', () => {
    const failure = describeFailure('github-work', Object.assign(new Error('bad creds'), { status: 401 }), now);
    expect(failure.hint).toContain('GITHUB_WORK_TOKEN');
  });
});
