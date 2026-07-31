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
