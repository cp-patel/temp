/**
 * Shared helpers: truncation, budget arithmetic, cache TTL, error scrubbing.
 */

import { describe, expect, it } from 'vitest';
import {
  CAPS,
  MAX_RESPONSE_CHARS,
  payloadChars,
  serializeCompact,
  truncateBody,
  truncateText,
} from '../src/lib/truncate.js';
import { TtlCache, cacheKey } from '../src/lib/cache.js';
import { describeFailure, scrub } from '../src/lib/errors.js';
import { ageInDays, buildEnvelope, priorityLabel, repoFromApiUrl, splitRepo, toolJson } from '../src/lib/format.js';
import { mapLimit } from '../src/lib/concurrency.js';

describe('truncateText', () => {
  it('leaves short strings untouched', () => {
    expect(truncateText('hello', 10)).toBe('hello');
  });

  it('never exceeds the requested cap, including the ellipsis', () => {
    for (const cap of [1, 2, 3, 10, 25, 120]) {
      expect(truncateText('x'.repeat(500), cap).length).toBeLessThanOrEqual(cap);
    }
  });

  it('marks truncation with an ellipsis', () => {
    expect(truncateText('abcdefghij', 5)).toBe('abcd…');
  });

  it('treats null and undefined as empty', () => {
    expect(truncateText(null, 10)).toBe('');
    expect(truncateText(undefined, 10)).toBe('');
  });

  it('normalises CRLF and trims', () => {
    expect(truncateText('  a\r\nb  ', 100)).toBe('a\nb');
  });

  it('does not leave a dangling space before the ellipsis', () => {
    // Cutting at 7 lands on the space after "hello", which must not survive.
    expect(truncateText('hello world', 7)).toBe('hello…');
    // When the cut lands mid-word there is nothing to trim, so the budget is used fully.
    expect(truncateText('hello world again', 8)).toBe('hello w…');
  });

  it('handles a zero cap without throwing', () => {
    expect(truncateText('abc', 0)).toBe('');
  });

  it('caps bodies at the spec-mandated 1,500 characters by default', () => {
    expect(truncateBody('y'.repeat(5_000)).length).toBeLessThanOrEqual(1_500);
    expect(CAPS.prBody).toBe(1_500);
  });

  it('counts characters against the serialised form actually returned', () => {
    const payload = { a: 'x'.repeat(100) };
    expect(payloadChars(payload)).toBe(serializeCompact(payload).length);
  });
});

describe('buildEnvelope', () => {
  const item = (index: number): { id: number; pad: string } => ({ id: index, pad: 'p'.repeat(200) });

  it('reports has_more when the upstream total exceeds what is returned', () => {
    const envelope = buildEnvelope({ items: [item(1)], totalFound: 50 });
    expect(envelope.has_more).toBe(true);
  });

  it('reports has_more false when everything fits', () => {
    const envelope = buildEnvelope({ items: [item(1)], totalFound: 1 });
    expect(envelope.has_more).toBe(false);
  });

  it('honours forceHasMore for upstreams without a real total', () => {
    const envelope = buildEnvelope({ items: [item(1)], totalFound: 1, forceHasMore: true });
    expect(envelope.has_more).toBe(true);
  });

  it('drops items until the payload fits and discloses the drop', () => {
    const items = Array.from({ length: 200 }, (_unused, index) => item(index));
    const envelope = buildEnvelope({ items, totalFound: 200 });

    expect(payloadChars(envelope)).toBeLessThanOrEqual(MAX_RESPONSE_CHARS);
    expect(envelope.items.length).toBeLessThan(200);
    expect(envelope.notes?.join(' ')).toMatch(/omitted to stay within the response size budget/);
    expect(envelope.has_more).toBe(true);
  });

  it('omits warnings and notes entirely when there are none', () => {
    const envelope = buildEnvelope({ items: [], totalFound: 0 });
    expect(envelope.warnings).toBeUndefined();
    expect(envelope.notes).toBeUndefined();
    // Absent keys keep small responses small.
    expect(serializeCompact(envelope)).toBe('{"items":[],"total_found":0,"has_more":false}');
  });

  it('accounts for the disclosure note itself when measuring the budget', () => {
    // A note added after fitting could push the payload back over; buildEnvelope measures
    // with the note included, so the final result must still fit.
    const items = Array.from({ length: 60 }, (_unused, index) => ({
      id: index,
      pad: 'q'.repeat(130),
    }));
    const envelope = buildEnvelope({ items, totalFound: 60 });
    expect(payloadChars(envelope)).toBeLessThanOrEqual(MAX_RESPONSE_CHARS);
  });
});

describe('toolJson', () => {
  it('serialises compactly', () => {
    const result = toolJson({ a: 1 });
    expect(result.content[0]).toEqual({ type: 'text', text: '{"a":1}' });
  });

  it('replaces an oversized payload with a compact error rather than shipping it', () => {
    const result = toolJson({ pad: 'z'.repeat(20_000) });
    const text = (result.content[0] as { text: string }).text;
    expect(text.length).toBeLessThan(500);
    expect(JSON.parse(text)).toMatchObject({ error: 'response_too_large' });
  });
});

describe('TtlCache', () => {
  it('returns a cached value inside the TTL', () => {
    let now = 1_000;
    const cache = new TtlCache(60_000, () => now);
    cache.set('k', 'v');
    now += 59_000;
    expect(cache.get('k')).toBe('v');
  });

  it('expires a value after the TTL', () => {
    let now = 1_000;
    const cache = new TtlCache(60_000, () => now);
    cache.set('k', 'v');
    now += 60_001;
    expect(cache.get('k')).toBeUndefined();
  });

  it('runs the producer once inside the TTL', async () => {
    let calls = 0;
    const cache = new TtlCache(60_000, () => 1_000);
    const produce = async (): Promise<number> => {
      calls += 1;
      return 42;
    };
    expect(await cache.wrap('k', produce)).toBe(42);
    expect(await cache.wrap('k', produce)).toBe(42);
    expect(calls).toBe(1);
  });

  it('does not cache a rejection, so a transient failure is retryable', async () => {
    const cache = new TtlCache(60_000, () => 1_000);
    await expect(
      cache.wrap('k', async () => {
        throw new Error('upstream down');
      }),
    ).rejects.toThrow('upstream down');
    expect(await cache.wrap('k', async () => 'recovered')).toBe('recovered');
  });

  it('shares one upstream fetch between identical concurrent calls', async () => {
    let calls = 0;
    const cache = new TtlCache(60_000, () => 1_000);
    const produce = async (): Promise<number> => {
      calls += 1;
      await new Promise((resolve) => {
        setTimeout(resolve, 5);
      });
      return 7;
    };

    // Both start before either finishes, so a naive cache would fetch twice.
    const [a, b] = await Promise.all([cache.wrap('k', produce), cache.wrap('k', produce)]);

    expect(a).toBe(7);
    expect(b).toBe(7);
    expect(calls).toBe(1);
  });

  it('propagates a rejection to every concurrent caller without caching it', async () => {
    let calls = 0;
    const cache = new TtlCache(60_000, () => 1_000);
    const failing = async (): Promise<number> => {
      calls += 1;
      await new Promise((resolve) => {
        setTimeout(resolve, 5);
      });
      throw new Error('upstream down');
    };

    const results = await Promise.allSettled([cache.wrap('k', failing), cache.wrap('k', failing)]);

    expect(results.every((result) => result.status === 'rejected')).toBe(true);
    expect(calls).toBe(1);
    // The in-flight entry must be cleared, so a retry actually retries.
    expect(await cache.wrap('k', async () => 99)).toBe(99);
  });

  it('keys independently of object property order', () => {
    expect(cacheKey('t', { a: 1, b: 2 })).toBe(cacheKey('t', { b: 2, a: 1 }));
    expect(cacheKey('t', { a: 1 })).not.toBe(cacheKey('t', { a: 2 }));
  });

  it('prunes expired entries so a long session cannot grow without bound', () => {
    let now = 1_000;
    const cache = new TtlCache(60_000, () => now);
    for (let index = 0; index < 50; index += 1) cache.set(`k${index}`, index);
    expect(cache.size).toBe(50);
    now += 60_001;
    cache.set('fresh', 1);
    expect(cache.size).toBe(1);
  });
});

describe('scrub', () => {
  it('redacts GitHub classic and fine-grained tokens', () => {
    expect(scrub('failed with ghp_abcdefghijklmnopqrstuvwxyz')).not.toContain('abcdefghij');
    expect(scrub('token github_pat_11ABCDEFG_secretsecretsecret oops')).toContain('[redacted]');
  });

  it('redacts Linear keys and bearer headers', () => {
    expect(scrub('key lin_api_abcdefghijklmnopqrs failed')).toContain('[redacted]');
    expect(scrub('Authorization: Bearer abcdefghijklmnopqrstuvwxyz')).toContain('[redacted]');
  });

  it('strips query strings, which is where search terms and tokens hide', () => {
    expect(scrub('GET https://api.github.com/search/issues?q=org:secretorg+author:me')).toBe(
      'GET https://api.github.com/search/issues',
    );
  });

  it('leaves ordinary messages alone', () => {
    expect(scrub('Not Found')).toBe('Not Found');
  });
});

describe('describeFailure', () => {
  const now = Date.parse('2026-07-31T12:00:00.000Z');

  it('reports minutes until reset on a rate-limited 403', () => {
    const error = Object.assign(new Error('rate limited'), {
      status: 403,
      response: {
        headers: {
          'x-ratelimit-remaining': '0',
          'x-ratelimit-reset': String(Math.floor((now + 7 * 60_000) / 1000)),
        },
      },
    });
    const failure = describeFailure('github-work', error, now);
    expect(failure.hint).toMatch(/resets in about 7 minutes/);
    expect(failure.hint).toMatch(/not retrying automatically/);
  });

  it('uses retry-after when present, for secondary limits', () => {
    const error = Object.assign(new Error('secondary limit'), {
      status: 403,
      response: { headers: { 'retry-after': '120' } },
    });
    expect(describeFailure('github-work', error, now).hint).toMatch(/about 2 minutes/);
  });

  it('says minute singular for a one-minute wait', () => {
    const error = Object.assign(new Error('x'), {
      status: 429,
      response: { headers: { 'retry-after': '30' } },
    });
    expect(describeFailure('linear', error, now).hint).toMatch(/about 1 minute\b/);
  });

  it('treats a 403 with quota remaining as a scope problem, not a rate limit', () => {
    const error = Object.assign(new Error('Resource not accessible'), {
      status: 403,
      response: { headers: { 'x-ratelimit-remaining': '4999' } },
    });
    const failure = describeFailure('github-work', error, now);
    expect(failure.hint).toMatch(/lack repo read scope|SAML\/SSO/);
    expect(failure.hint).not.toMatch(/rate limit/);
  });

  it('names the right token variable per scope', () => {
    const error = Object.assign(new Error('bad creds'), { status: 401 });
    expect(describeFailure('github-work', error, now).hint).toContain('GITHUB_WORK_TOKEN');
    expect(describeFailure('github-personal', error, now).hint).toContain('GITHUB_PERSONAL_TOKEN');
    expect(describeFailure('linear', error, now).hint).toContain('LINEAR_API_KEY');
  });

  it('explains the fine-grained-PAT 404-instead-of-403 behaviour', () => {
    const error = Object.assign(new Error('Not Found'), { status: 404 });
    expect(describeFailure('github-personal', error, now).hint).toMatch(/404/);
  });

  it('never leaks a token from the upstream message', () => {
    const error = Object.assign(new Error('bad token ghp_leakedleakedleakedleaked'), { status: 401 });
    const failure = describeFailure('github-work', error, now);
    expect(JSON.stringify(failure)).not.toContain('ghp_leakedleaked');
  });

  it('omits status entirely when the upstream gave none', () => {
    const failure = describeFailure('linear', new Error('socket hang up'), now);
    expect(failure.status).toBeUndefined();
    expect('status' in failure).toBe(false);
  });
});

describe('small helpers', () => {
  it('computes whole-day ages and clamps clock skew', () => {
    const now = Date.parse('2026-07-31T12:00:00.000Z');
    expect(ageInDays('2026-07-24T12:00:00.000Z', now)).toBe(7);
    expect(ageInDays('2026-08-05T12:00:00.000Z', now)).toBe(0);
    expect(ageInDays(undefined, now)).toBe(0);
    expect(ageInDays('nonsense', now)).toBe(0);
  });

  it('parses owner/name out of a GitHub API url', () => {
    expect(repoFromApiUrl('https://api.github.com/repos/acme/web')).toBe('acme/web');
  });

  it('splits owner/name and rejects malformed input', () => {
    expect(splitRepo('acme/web')).toEqual({ owner: 'acme', name: 'web' });
    expect(splitRepo('  acme/web  ')).toEqual({ owner: 'acme', name: 'web' });
    expect(splitRepo('acme')).toBeUndefined();
    expect(splitRepo('a/b/c')).toBeUndefined();
    expect(splitRepo('')).toBeUndefined();
  });

  it('labels Linear priorities', () => {
    expect(priorityLabel(1)).toBe('urgent');
    expect(priorityLabel(4)).toBe('low');
    expect(priorityLabel(0)).toBe('none');
    expect(priorityLabel(null)).toBe('none');
  });
});

describe('mapLimit', () => {
  it('preserves input order regardless of completion order', async () => {
    const delays = [30, 5, 20, 1];
    const result = await mapLimit(delays, 2, async (delay, index) => {
      await new Promise((resolve) => {
        setTimeout(resolve, delay);
      });
      return index;
    });
    expect(result).toEqual([0, 1, 2, 3]);
  });

  it('never exceeds the concurrency limit', async () => {
    let inFlight = 0;
    let peak = 0;
    await mapLimit(Array.from({ length: 20 }, (_unused, index) => index), 3, async () => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await new Promise((resolve) => {
        setTimeout(resolve, 1);
      });
      inFlight -= 1;
      return null;
    });
    expect(peak).toBeLessThanOrEqual(3);
  });

  it('returns an empty array for empty input without invoking the callback', async () => {
    let called = false;
    const result = await mapLimit([], 5, async () => {
      called = true;
      return 1;
    });
    expect(result).toEqual([]);
    expect(called).toBe(false);
  });
});
