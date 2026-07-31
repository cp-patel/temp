/**
 * Bounded-concurrency map.
 *
 * GitHub's REST search endpoint returns no diff stats and no CI state, so every PR needs
 * follow-up calls. Firing 15 x 2 requests at once invites secondary rate limiting, and
 * doing them serially is slow — so we run a small fixed number in flight.
 */

/** Default in-flight request budget for per-item GitHub enrichment. */
export const DEFAULT_CONCURRENCY = 5;

/**
 * Like `Promise.all(items.map(fn))` but with at most `limit` calls in flight.
 * Results keep the input order regardless of completion order.
 */
export async function mapLimit<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  if (items.length === 0) return [];
  const effectiveLimit = Math.max(1, Math.min(limit, items.length));
  const results = new Array<R>(items.length);
  let cursor = 0;

  const workers = Array.from({ length: effectiveLimit }, async () => {
    for (;;) {
      const index = cursor++;
      if (index >= items.length) return;
      // Guarded by the bounds check above; the non-null assertion-free read keeps
      // `noUncheckedIndexedAccess` happy.
      const item = items[index] as T;
      results[index] = await fn(item, index);
    }
  });

  await Promise.all(workers);
  return results;
}
