#!/usr/bin/env node
/**
 * Server bootstrap, tool registration, stdio transport.
 *
 * Transport is deliberately confined to this file: adding a streamable-HTTP port later
 * should touch `startStdio` and nothing else.
 *
 * NOTE: under the stdio transport, stdout *is* the JSON-RPC channel. Every diagnostic in
 * this process must go to stderr — a stray console.log would corrupt the protocol stream.
 */

import { pathToFileURL } from 'node:url';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

import { createClients, validateStartup, type ToolContext } from './clients.js';
import { TtlCache } from './lib/cache.js';
import { StartupError, scrub } from './lib/errors.js';
import { serializeCompact } from './lib/truncate.js';
import { toolJson } from './lib/format.js';
import {
  TOOL_NAME as REVIEW_QUEUE_TOOL,
  getMyReviewQueue,
  reviewQueueDescription,
  reviewQueueInputSchema,
} from './tools/review-queue.js';

const SERVER_NAME = 'devhub-mcp';
const SERVER_VERSION = '0.1.0';

function log(message: string): void {
  process.stderr.write(`${SERVER_NAME}: ${message}\n`);
}

/**
 * Last-resort wrapper around a tool implementation.
 *
 * Tools already convert upstream failures into `warnings`; this catches the unexpected so a
 * bug degrades one call instead of killing the server (which would drop the client session).
 */
async function safeTool(name: string, run: () => Promise<unknown>): Promise<CallToolResult> {
  try {
    return toolJson(await run());
  } catch (error: unknown) {
    const message = scrub(error instanceof Error ? error.message : String(error));
    log(`tool ${name} failed: ${message}`);
    return {
      content: [
        {
          type: 'text',
          text: serializeCompact({
            error: 'internal_error',
            tool: name,
            hint: message === '' ? 'The tool threw an unexpected error.' : message,
          }),
        },
      ],
      isError: true,
    };
  }
}

/**
 * Register every tool. Transport-agnostic.
 *
 * Exported so tests can drive the real `McpServer` over an in-memory transport and assert
 * that tools list and call correctly, without a network or a subprocess.
 */
export function buildServer(ctx: ToolContext): McpServer {
  const server = new McpServer({ name: SERVER_NAME, version: SERVER_VERSION });

  // Verified against @modelcontextprotocol/sdk 1.30: `registerTool(name, config, cb)` is the
  // current idiom and every `server.tool(...)` overload is marked @deprecated. `inputSchema`
  // is a raw Zod shape (`Record<string, AnySchema>`), not a wrapping `z.object()`.
  server.registerTool(
    REVIEW_QUEUE_TOOL,
    {
      title: 'My review queue',
      description: reviewQueueDescription,
      inputSchema: reviewQueueInputSchema,
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async (args) => safeTool(REVIEW_QUEUE_TOOL, () => getMyReviewQueue(ctx, args)),
  );

  return server;
}

/** Validate configuration and credentials, then assemble the tool context. */
async function bootstrap(): Promise<ToolContext> {
  const clients = createClients(process.env);
  const identity = await validateStartup(clients);
  log(
    `ready — github work=${identity.workLogin}, github personal=${identity.personalLogin}, linear=${identity.linearUserName}`,
  );
  return {
    clients,
    identity,
    cache: new TtlCache(),
    now: () => Date.now(),
  };
}

function reportStartupFailure(error: unknown): never {
  if (error instanceof StartupError) {
    log(scrub(error.message));
    log(`fix the following environment variable(s) and restart: ${error.variables.join(', ')}`);
  } else {
    log(`startup failed: ${scrub(error instanceof Error ? error.message : String(error))}`);
  }
  process.exit(1);
}

async function startStdio(server: McpServer): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  log('listening on stdio');
}

async function main(): Promise<void> {
  const ctx = await bootstrap().catch(reportStartupFailure);
  await startStdio(buildServer(ctx));
}

/**
 * Only bootstrap when executed as a program.
 *
 * Importing this module (as the tests do, for `buildServer`) must not connect a transport or
 * touch the network.
 */
function isDirectExecution(): boolean {
  const entry = process.argv[1];
  if (entry === undefined) return false;
  return import.meta.url === pathToFileURL(entry).href;
}

if (isDirectExecution()) {
  main().catch((error: unknown) => {
    log(`fatal: ${scrub(error instanceof Error ? error.message : String(error))}`);
    process.exit(1);
  });
}
