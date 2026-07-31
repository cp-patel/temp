/**
 * Credential separation (ground rule 5).
 *
 * The claim under test is strong: a `scope: "work"` call must be *provably* incapable of
 * touching the personal client, and vice versa. The fakes record every call against the
 * scope that made it, so "the other client saw zero calls" is a real assertion.
 */

import { describe, expect, it } from 'vitest';
import { getMyReviewQueue } from '../src/tools/review-queue.js';
import { scopeQualifier, readEnv, createClients } from '../src/clients.js';
import { StartupError } from '../src/lib/errors.js';
import { createFakeContext, searchItem } from './helpers/fakes.js';

const WORK_PR = searchItem({
  number: 11,
  repository_url: 'https://api.github.com/repos/acme/web',
  html_url: 'https://github.com/acme/web/pull/11',
});
const PERSONAL_PR = searchItem({
  number: 22,
  repository_url: 'https://api.github.com/repos/octo-personal/dotfiles',
  html_url: 'https://github.com/octo-personal/dotfiles/pull/22',
});

describe('scope separation', () => {
  it('a work-scoped call never touches the personal client', async () => {
    const { ctx, work, personal } = createFakeContext({
      work: { searchItems: [WORK_PR] },
      personal: { searchItems: [PERSONAL_PR] },
    });

    const result = await getMyReviewQueue(ctx, { scope: 'work' });

    expect(personal.calls).toEqual([]);
    expect(work.calls.length).toBeGreaterThan(0);
    expect(result.items.every((item) => item.source === 'work')).toBe(true);
  });

  it('a personal-scoped call never touches the work client', async () => {
    const { ctx, work, personal } = createFakeContext({
      work: { searchItems: [WORK_PR] },
      personal: { searchItems: [PERSONAL_PR] },
    });

    const result = await getMyReviewQueue(ctx, { scope: 'personal' });

    expect(work.calls).toEqual([]);
    expect(personal.calls.length).toBeGreaterThan(0);
    expect(result.items.every((item) => item.source === 'personal')).toBe(true);
  });

  it('restricts each scope with its own search qualifier', () => {
    const config = {
      workOrg: 'acme',
      personalUsername: 'octo-personal',
      linearUserEmail: 'me@example.com',
      stalePrDays: 3,
      blockingReviewDays: 5,
    };
    expect(scopeQualifier(config, 'work')).toBe('org:acme');
    expect(scopeQualifier(config, 'personal')).toBe('user:octo-personal');
  });

  it('uses the per-scope login and qualifier in the search query', async () => {
    const { ctx, work, personal } = createFakeContext({
      work: { searchItems: [] },
      personal: { searchItems: [] },
    });

    await getMyReviewQueue(ctx, { scope: 'both' });

    const workSearch = work.calls.find((call) => call.includes('search('));
    const personalSearch = personal.calls.find((call) => call.includes('search('));

    // Work query is pinned to the org and the work login...
    expect(workSearch).toContain('org:acme');
    expect(workSearch).toContain('review-requested:work-login');
    expect(workSearch).not.toContain('octo-personal');
    // ...and the personal query to the personal user, with no leakage of the org.
    expect(personalSearch).toContain('user:octo-personal');
    expect(personalSearch).toContain('review-requested:personal-login');
    expect(personalSearch).not.toContain('org:acme');
  });

  it('tags every item with its originating source when scope is "both"', async () => {
    const { ctx } = createFakeContext({
      work: { searchItems: [WORK_PR] },
      personal: { searchItems: [PERSONAL_PR] },
    });

    const result = await getMyReviewQueue(ctx, { scope: 'both' });
    const sources = result.items.map((item) => item.source).sort();

    expect(sources).toEqual(['personal', 'work']);
    expect(result.items.find((item) => item.number === 11)?.source).toBe('work');
    expect(result.items.find((item) => item.number === 22)?.source).toBe('personal');
  });

  it('builds two distinct clients from two distinct tokens', () => {
    const clients = createClients({
      GITHUB_WORK_TOKEN: 'ghp_workworkworkworkworkwork',
      GITHUB_PERSONAL_TOKEN: 'ghp_personalpersonalpersonal',
      GITHUB_WORK_ORG: 'acme',
      GITHUB_PERSONAL_USERNAME: 'octo-personal',
      LINEAR_API_KEY: 'lin_api_abcdefghijklmnop',
      LINEAR_USER_EMAIL: 'me@example.com',
    });

    // Distinct object identities: there is no shared instance to accidentally reuse.
    expect(clients.github('work')).not.toBe(clients.github('personal'));
    // And the accessor is stable, so caching a client per scope stays correct.
    expect(clients.github('work')).toBe(clients.github('work'));
  });
});

describe('environment validation', () => {
  const VALID = {
    GITHUB_WORK_TOKEN: 'ghp_work',
    GITHUB_PERSONAL_TOKEN: 'ghp_personal',
    GITHUB_WORK_ORG: 'acme',
    GITHUB_PERSONAL_USERNAME: 'octo-personal',
    LINEAR_API_KEY: 'lin_api_key',
    LINEAR_USER_EMAIL: 'me@example.com',
  };

  it('accepts a complete environment', () => {
    expect(readEnv(VALID).GITHUB_WORK_ORG).toBe('acme');
  });

  it('names every missing variable without echoing any value', () => {
    const broken = { ...VALID };
    delete (broken as Record<string, string | undefined>).GITHUB_WORK_TOKEN;
    delete (broken as Record<string, string | undefined>).LINEAR_API_KEY;

    try {
      readEnv(broken);
      expect.unreachable('readEnv should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(StartupError);
      const startupError = error as StartupError;
      expect(startupError.variables).toContain('GITHUB_WORK_TOKEN');
      expect(startupError.variables).toContain('LINEAR_API_KEY');
      // The surviving secret must not appear in the message.
      expect(startupError.message).not.toContain('ghp_personal');
    }
  });

  it('rejects an empty string as firmly as a missing variable', () => {
    expect(() => readEnv({ ...VALID, GITHUB_WORK_ORG: '   ' })).toThrow(StartupError);
  });

  it('rejects a malformed LINEAR_USER_EMAIL', () => {
    expect(() => readEnv({ ...VALID, LINEAR_USER_EMAIL: 'not-an-email' })).toThrow(StartupError);
  });

  it('accepts optional day thresholds and applies defaults when absent', () => {
    const parsed = readEnv({ ...VALID, DEVHUB_STALE_PR_DAYS: '7' });
    expect(parsed.DEVHUB_STALE_PR_DAYS).toBe(7);
    expect(readEnv(VALID).DEVHUB_BLOCKING_REVIEW_DAYS).toBeUndefined();
  });

  it('rejects a garbage threshold instead of silently defaulting', () => {
    // "soon" is a config mistake the operator needs to hear about, not a value to paper over.
    expect(() => readEnv({ ...VALID, DEVHUB_STALE_PR_DAYS: 'soon' })).toThrow(StartupError);
    expect(() => readEnv({ ...VALID, DEVHUB_BLOCKING_REVIEW_DAYS: '0' })).toThrow(StartupError);
  });

  it('threads configured thresholds into the client config', () => {
    const clients = createClients({
      GITHUB_WORK_TOKEN: 'ghp_workworkworkworkworkwork',
      GITHUB_PERSONAL_TOKEN: 'ghp_personalpersonalpersonal',
      GITHUB_WORK_ORG: 'acme',
      GITHUB_PERSONAL_USERNAME: 'octo-personal',
      LINEAR_API_KEY: 'lin_api_abcdefghijklmnop',
      LINEAR_USER_EMAIL: 'me@example.com',
      DEVHUB_STALE_PR_DAYS: '1',
      DEVHUB_BLOCKING_REVIEW_DAYS: '2',
    });
    expect(clients.config.stalePrDays).toBe(1);
    expect(clients.config.blockingReviewDays).toBe(2);
  });
});
