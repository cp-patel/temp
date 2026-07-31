/**
 * 60-second TTL in-memory cache, keyed by tool + args.
 *
 * Deliberately tiny: no eviction policy beyond TTL, no persistence. It exists so that a
 * client asking "what should I review?" and then "tell me about the second one" inside one
 * session does not re-hit GitHub for the same search.
 *
 * Only successful results are cached — a failed upstream call must be retryable immediately.
 */

export const DEFAULT_TTL_MS = 60_000;

interface Entry {
  readonly value: unknown;
  readonly expiresAt: number;
}

/** Deterministic JSON with sorted object keys, so `{a,b}` and `{b,a}` share a cache key. */
function stableStringify(value: unknown): string {
  if (value === undefined) return 'undefined';
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const record = value as Record<string, unknown>;
  const parts = Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`);
  return `{${parts.join(',')}}`;
}

/** Build a cache key from a tool name and its arguments. */
export function cacheKey(tool: string, args: unknown): string {
  return `${tool}:${stableStringify(args)}`;
}

export class TtlCache {
  private readonly entries = new Map<string, Entry>();
  /**
   * Requests currently in flight, so two identical concurrent calls share one upstream fetch
   * instead of racing. Without this, a client that fires the same tool twice before the first
   * returns pays twice — and `whats_blocked` makes exactly that kind of concurrent fan-out.
   */
  private readonly inFlight = new Map<string, Promise<unknown>>();

  /** `now` is injectable so TTL behaviour is testable without fake timers. */
  constructor(
    private readonly ttlMs: number = DEFAULT_TTL_MS,
    private readonly now: () => number = Date.now,
  ) {}

  get<T>(key: string): T | undefined {
    const hit = this.entries.get(key);
    if (hit === undefined) return undefined;
    if (hit.expiresAt <= this.now()) {
      this.entries.delete(key);
      return undefined;
    }
    return hit.value as T;
  }

  set(key: string, value: unknown): void {
    this.prune();
    this.entries.set(key, { value, expiresAt: this.now() + this.ttlMs });
  }

  /**
   * Return the cached value for `key`, otherwise run `produce` and cache its result.
   *
   * Rejections are intentionally not cached, so a transient upstream failure does not
   * poison the next 60 seconds of calls.
   */
  async wrap<T>(key: string, produce: () => Promise<T>): Promise<T> {
    const hit = this.get<T>(key);
    if (hit !== undefined) return hit;

    // Join an identical request already in progress rather than starting a second one.
    const pending = this.inFlight.get(key);
    if (pending !== undefined) return pending as Promise<T>;

    const promise = produce();
    this.inFlight.set(key, promise);
    try {
      const value = await promise;
      this.set(key, value);
      return value;
    } finally {
      // Cleared on both paths: a rejection must not linger and poison later calls.
      this.inFlight.delete(key);
    }
  }

  clear(): void {
    this.entries.clear();
    this.inFlight.clear();
  }

  get size(): number {
    return this.entries.size;
  }

  /** Drop expired entries so a long-lived session cannot grow the map without bound. */
  private prune(): void {
    const cutoff = this.now();
    for (const [key, entry] of this.entries) {
      if (entry.expiresAt <= cutoff) this.entries.delete(key);
    }
  }
}
