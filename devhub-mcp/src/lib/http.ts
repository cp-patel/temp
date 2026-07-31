/**
 * Upstream timeout enforcement.
 *
 * Neither Octokit nor the Linear client applies a request timeout by default, so a stalled
 * upstream would hang the tool call — and under MCP the client just sits there with no
 * feedback. Every outbound request therefore gets a deadline, after which the call fails
 * into the normal structured-error path ("upstream did not respond", warnings, etc.).
 */

/** Default deadline for any single upstream HTTP request. */
export const DEFAULT_UPSTREAM_TIMEOUT_MS = 15_000;

type FetchLike = typeof globalThis.fetch;

/**
 * A fetch wrapper that aborts after `timeoutMs`.
 *
 * Passed to Octokit via its documented `request.fetch` option ("Custom replacement for
 * built-in fetch method"). The abort surfaces as a `TimeoutError` DOMException, which
 * `describeFailure` maps to a human-readable hint.
 *
 * Note: this replaces any caller-supplied signal. Octokit does not set one on its own
 * requests, so nothing is lost in practice — and a composed-signals approach
 * (AbortSignal.any) needs Node 20.3+, which `engines` does not guarantee.
 */
export function timeoutFetch(timeoutMs: number, base: FetchLike = fetch): FetchLike {
  return (input, init) => base(input, { ...init, signal: AbortSignal.timeout(timeoutMs) });
}

/**
 * Deadline for promise-shaped clients that do not expose a fetch hook.
 *
 * The Linear SDK's options extend `RequestInit`, so a signal set at construction would be a
 * one-shot timer for the whole client lifetime, not per request. Racing the request promise
 * is the reliable alternative: the tool call resolves on time even if the underlying socket
 * lingers until the runtime reaps it.
 */
export async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const deadline = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`${label} did not respond within ${Math.round(timeoutMs / 1000)}s`));
    }, timeoutMs);
    // A pending tool call must never keep the process alive on its own.
    timer.unref();
  });
  try {
    return await Promise.race([promise, deadline]);
  } finally {
    clearTimeout(timer);
  }
}
