/**
 * Real MCP protocol handshake.
 *
 * This drives the actual `McpServer` from @modelcontextprotocol/sdk over a linked in-memory
 * transport pair, so it verifies the SDK idioms themselves — that `registerTool` with a raw
 * Zod shape produces a listable tool, that the generated JSON Schema is what we expect, and
 * that `tools/call` returns parseable JSON. It is the non-interactive equivalent of the
 * MCP Inspector check.
 */

import { describe, expect, it } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { buildServer } from '../src/index.js';
import { createFakeContext, searchItem } from './helpers/fakes.js';

async function connect(ctx: Parameters<typeof buildServer>[0]): Promise<Client> {
  const server = buildServer(ctx);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'test-client', version: '0.0.0' });
  await Promise.all([client.connect(clientTransport), server.connect(serverTransport)]);
  return client;
}

function firstText(result: { content?: unknown }): string {
  const content = result.content;
  if (!Array.isArray(content) || content.length === 0) throw new Error('no content returned');
  const block = content[0] as { type?: string; text?: string };
  if (block.type !== 'text' || typeof block.text !== 'string') throw new Error('expected a text block');
  return block.text;
}

const ALL_TOOLS = [
  'get_my_review_queue',
  'get_my_open_prs',
  'get_pr_context',
  'get_my_linear_issues',
  'whats_blocked',
  'search_my_work',
  'get_standup_notes',
  'get_devhub_config',
] as const;

describe('tool surface', () => {
  it('registers exactly the expected tools', async () => {
    const { ctx } = createFakeContext();
    const client = await connect(ctx);

    const { tools } = await client.listTools();
    expect(tools.map((tool) => tool.name).sort()).toEqual([...ALL_TOOLS].sort());

    await client.close();
  });

  it('marks every tool read-only, since nothing here mutates', async () => {
    const { ctx } = createFakeContext();
    const client = await connect(ctx);

    const { tools } = await client.listTools();
    for (const tool of tools) {
      expect(tool.annotations?.readOnlyHint, `${tool.name} must be read-only`).toBe(true);
    }

    await client.close();
  });

  it('gives every tool a substantial description with an example', async () => {
    const { ctx } = createFakeContext();
    const client = await connect(ctx);

    const { tools } = await client.listTools();
    for (const tool of tools) {
      const description = tool.description ?? '';
      expect(description.length, `${tool.name} description too short`).toBeGreaterThan(200);
      expect(description, `${tool.name} needs an example invocation`).toMatch(/Example:/);
    }

    await client.close();
  });

  it('cross-references sibling tools so an LLM can choose between them', async () => {
    const { ctx } = createFakeContext();
    const client = await connect(ctx);

    const { tools } = await client.listTools();
    const byName = new Map(tools.map((tool) => [tool.name, tool.description ?? '']));

    // Each listing tool must point at its nearest neighbour, or a model will pick by luck.
    expect(byName.get('get_my_review_queue')).toContain('get_my_open_prs');
    expect(byName.get('get_my_open_prs')).toContain('get_my_review_queue');
    expect(byName.get('get_my_linear_issues')).toContain('whats_blocked');
    expect(byName.get('search_my_work')).toContain('whats_blocked');
    expect(byName.get('whats_blocked')).toContain('get_my_open_prs');
    // The retrospective/queue boundary is the newest ambiguity: both sides must disambiguate.
    expect(byName.get('get_my_open_prs')).toContain('get_standup_notes');
    expect(byName.get('get_standup_notes')).toContain('get_my_review_queue');

    await client.close();
  });

  it('exposes whats_blocked as a zero-parameter tool', async () => {
    const { ctx } = createFakeContext();
    const client = await connect(ctx);

    const { tools } = await client.listTools();
    const schema = tools.find((tool) => tool.name === 'whats_blocked')?.inputSchema as {
      properties?: Record<string, unknown>;
      required?: string[];
    };

    expect(Object.keys(schema.properties ?? {})).toEqual([]);
    expect(schema.required ?? []).toEqual([]);

    await client.close();
  });

  it('requires scope, repo and number on get_pr_context', async () => {
    const { ctx } = createFakeContext();
    const client = await connect(ctx);

    const { tools } = await client.listTools();
    const schema = tools.find((tool) => tool.name === 'get_pr_context')?.inputSchema as {
      required?: string[];
    };

    // scope has no default on purpose: guessing it could hit the wrong credential.
    expect((schema.required ?? []).sort()).toEqual(['number', 'repo', 'scope']);

    await client.close();
  });
});

describe('get_devhub_config', () => {
  it('reports resolved identities and limits without any upstream call', async () => {
    const { ctx, work, personal, linear } = createFakeContext();
    const client = await connect(ctx);

    const result = await client.callTool({ name: 'get_devhub_config', arguments: {} });
    const payload = JSON.parse(firstText(result)) as {
      server: { read_only: boolean };
      github: { work_login: string; work_org: string; personal_login: string };
      linear: { email: string };
      thresholds: { stale_pr_days: number };
      limits: { response_budget_chars: number };
    };

    expect(payload.server.read_only).toBe(true);
    expect(payload.github.work_login).toBe('work-login');
    expect(payload.github.work_org).toBe('acme');
    expect(payload.github.personal_login).toBe('personal-login');
    expect(payload.linear.email).toBe('me@example.com');
    expect(payload.thresholds.stale_pr_days).toBe(3);
    expect(payload.limits.response_budget_chars).toBe(8_000);

    // The whole point: troubleshooting must work even when every upstream is down.
    expect(work.calls).toEqual([]);
    expect(personal.calls).toEqual([]);
    expect(linear.calls).toEqual([]);

    await client.close();
  });

  it('never contains a credential value', async () => {
    const { ctx } = createFakeContext();
    const client = await connect(ctx);

    const result = await client.callTool({ name: 'get_devhub_config', arguments: {} });
    const text = firstText(result);

    expect(text).not.toMatch(/ghp_|github_pat_|lin_api_/);

    await client.close();
  });
});

describe('end-to-end tool calls', () => {
  it('answers whats_blocked in one call', async () => {
    const { ctx } = createFakeContext({
      work: { searchItems: [searchItem({ number: 5, created_at: '2026-06-01T00:00:00.000Z' })] },
      personal: { searchItems: [] },
    });
    const client = await connect(ctx);

    const result = await client.callTool({ name: 'whats_blocked', arguments: {} });
    const payload = JSON.parse(firstText(result)) as {
      summary: string;
      waiting_on_reviewers: unknown[];
      you_are_blocking: unknown[];
      blocked_issues: unknown[];
    };

    expect(result.isError).not.toBe(true);
    expect(payload.summary).toMatch(/waiting on reviewers/);
    expect(Array.isArray(payload.waiting_on_reviewers)).toBe(true);
    expect(Array.isArray(payload.you_are_blocking)).toBe(true);
    expect(Array.isArray(payload.blocked_issues)).toBe(true);

    await client.close();
  });

  it('surfaces a get_pr_context input error as a tool error, not a crash', async () => {
    const { ctx } = createFakeContext();
    const client = await connect(ctx);

    const result = await client.callTool({
      name: 'get_pr_context',
      arguments: { scope: 'work', repo: 'malformed', number: 1 },
    });

    expect(result.isError).toBe(true);
    // The structured error must not be double-wrapped into a JSON string of a JSON object.
    expect(JSON.parse(firstText(result))).toMatchObject({ error: 'upstream_failure' });

    await client.close();
  });

  it('rejects an unknown scope value at the schema boundary', async () => {
    const { ctx } = createFakeContext();
    const client = await connect(ctx);

    const result = await client.callTool({
      name: 'get_my_open_prs',
      arguments: { scope: 'everything' },
    });

    expect(result.isError).toBe(true);

    await client.close();
  });

  it('keeps the server alive after a tool error', async () => {
    const { ctx } = createFakeContext({ work: { searchItems: [searchItem()] } });
    const client = await connect(ctx);

    await client.callTool({ name: 'get_pr_context', arguments: { scope: 'work', repo: 'bad', number: 1 } });
    // A failed call must not take the session down with it.
    const after = await client.callTool({ name: 'get_my_review_queue', arguments: { scope: 'work' } });
    expect(after.isError).not.toBe(true);

    await client.close();
  });
});

describe('MCP server wiring', () => {
  it('lists get_my_review_queue with a usable schema', async () => {
    const { ctx } = createFakeContext();
    const client = await connect(ctx);

    const { tools } = await client.listTools();
    const tool = tools.find((candidate) => candidate.name === 'get_my_review_queue');

    expect(tool).toBeDefined();
    expect(tool?.description ?? '').toContain('waiting on YOUR review');
    // The description must teach the LLM when *not* to use it.
    expect(tool?.description ?? '').toContain('get_my_open_prs');

    const schema = tool?.inputSchema as { properties?: Record<string, unknown>; required?: string[] };
    expect(Object.keys(schema.properties ?? {}).sort()).toEqual(['max_results', 'scope']);
    // Both params carry defaults, so neither is required.
    expect(schema.required ?? []).toEqual([]);

    await client.close();
  });

  it('advertises the tool as read-only (Phase 1 is strictly read-only)', async () => {
    const { ctx } = createFakeContext();
    const client = await connect(ctx);

    const { tools } = await client.listTools();
    const tool = tools.find((candidate) => candidate.name === 'get_my_review_queue');

    expect(tool?.annotations?.readOnlyHint).toBe(true);

    await client.close();
  });

  it('returns pre-digested JSON through tools/call', async () => {
    const { ctx } = createFakeContext({
      work: {
        searchItems: [
          searchItem({
            number: 11,
            title: 'Add retry to the payment worker',
            repository_url: 'https://api.github.com/repos/acme/web',
            created_at: '2026-07-24T00:00:00.000Z',
            user: { login: 'colleague' },
          }),
        ],
      },
      personal: { searchItems: [] },
    });
    const client = await connect(ctx);

    const result = await client.callTool({
      name: 'get_my_review_queue',
      arguments: { scope: 'work', max_results: 5 },
    });

    expect(result.isError).not.toBe(true);
    const payload = JSON.parse(firstText(result)) as {
      items: { repo: string; number: number; source: string; age_days: number; ci: string }[];
      total_found: number;
      has_more: boolean;
    };

    expect(payload.total_found).toBe(1);
    expect(payload.has_more).toBe(false);
    expect(payload.items).toHaveLength(1);
    expect(payload.items[0]?.repo).toBe('acme/web');
    expect(payload.items[0]?.source).toBe('work');
    expect(payload.items[0]?.age_days).toBe(7);
    expect(payload.items[0]?.ci).toBe('passing (1)');

    await client.close();
  });

  it('rejects an out-of-range max_results at the protocol boundary', async () => {
    const { ctx } = createFakeContext();
    const client = await connect(ctx);

    // max is 30; the Zod schema must reject 999 rather than silently clamping upstream.
    const result = await client.callTool({
      name: 'get_my_review_queue',
      arguments: { scope: 'work', max_results: 999 },
    });

    expect(result.isError).toBe(true);

    await client.close();
  });

  it('applies defaults when called with no arguments', async () => {
    const { ctx } = createFakeContext({
      work: { searchItems: [searchItem({ number: 1 })] },
      personal: { searchItems: [searchItem({ number: 2, repository_url: 'https://api.github.com/repos/octo-personal/x' })] },
    });
    const client = await connect(ctx);

    const result = await client.callTool({ name: 'get_my_review_queue', arguments: {} });
    const payload = JSON.parse(firstText(result)) as { items: { source: string }[] };

    // scope defaults to "both", so both accounts are represented.
    expect(new Set(payload.items.map((item) => item.source))).toEqual(new Set(['work', 'personal']));

    await client.close();
  });
});
