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
import {
  TOOL_NAME as MY_PRS_TOOL,
  getMyOpenPrs,
  myPrsDescription,
  myPrsInputSchema,
} from './tools/my-prs.js';
import {
  TOOL_NAME as PR_CONTEXT_TOOL,
  getPrContext,
  prContextDescription,
  prContextInputSchema,
} from './tools/pr-context.js';
import {
  TOOL_NAME as LINEAR_ISSUES_TOOL,
  getMyLinearIssues,
  linearIssuesDescription,
  linearIssuesInputSchema,
} from './tools/linear-issues.js';
import {
  TOOL_NAME as WHATS_BLOCKED_TOOL,
  buildWhatsBlockedDescription,
  whatsBlocked,
  whatsBlockedInputSchema,
} from './tools/whats-blocked.js';
import {
  TOOL_NAME as SEARCH_TOOL,
  searchMyWork,
  searchDescription,
  searchInputSchema,
} from './tools/search.js';
import {
  TOOL_NAME as STANDUP_TOOL,
  getStandupNotes,
  standupDescription,
  standupInputSchema,
} from './tools/standup.js';

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
/**
 * True when a tool already produced a protocol-shaped result (e.g. `get_pr_context` returning
 * a structured error). Such values must pass through untouched rather than be re-serialised.
 */
function isCallToolResult(value: unknown): value is CallToolResult {
  return typeof value === 'object' && value !== null && Array.isArray((value as { content?: unknown }).content);
}

async function safeTool(name: string, run: () => Promise<unknown>): Promise<CallToolResult> {
  try {
    const result = await run();
    return isCallToolResult(result) ? result : toolJson(result);
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
  //
  // Phase 1 is read-only, so every tool is annotated readOnlyHint.
  const readOnly = { readOnlyHint: true, openWorldHint: true } as const;

  server.registerTool(
    REVIEW_QUEUE_TOOL,
    {
      title: 'My review queue',
      description: reviewQueueDescription,
      inputSchema: reviewQueueInputSchema,
      annotations: readOnly,
    },
    async (args) => safeTool(REVIEW_QUEUE_TOOL, () => getMyReviewQueue(ctx, args)),
  );

  server.registerTool(
    MY_PRS_TOOL,
    {
      title: 'My open pull requests',
      description: myPrsDescription,
      inputSchema: myPrsInputSchema,
      annotations: readOnly,
    },
    async (args) => safeTool(MY_PRS_TOOL, () => getMyOpenPrs(ctx, args)),
  );

  server.registerTool(
    PR_CONTEXT_TOOL,
    {
      title: 'Pull request context',
      description: prContextDescription,
      inputSchema: prContextInputSchema,
      annotations: readOnly,
    },
    async (args) => safeTool(PR_CONTEXT_TOOL, () => getPrContext(ctx, args)),
  );

  server.registerTool(
    LINEAR_ISSUES_TOOL,
    {
      title: 'My Linear issues',
      description: linearIssuesDescription,
      inputSchema: linearIssuesInputSchema,
      annotations: readOnly,
    },
    async (args) => safeTool(LINEAR_ISSUES_TOOL, () => getMyLinearIssues(ctx, args)),
  );

  server.registerTool(
    WHATS_BLOCKED_TOOL,
    {
      title: "What's blocked",
      // Built from live config so the description states the thresholds actually in force.
      description: buildWhatsBlockedDescription(
        ctx.clients.config.stalePrDays,
        ctx.clients.config.blockingReviewDays,
      ),
      inputSchema: whatsBlockedInputSchema,
      annotations: readOnly,
    },
    async () => safeTool(WHATS_BLOCKED_TOOL, () => whatsBlocked(ctx)),
  );

  server.registerTool(
    SEARCH_TOOL,
    {
      title: 'Search my work',
      description: searchDescription,
      inputSchema: searchInputSchema,
      annotations: readOnly,
    },
    async (args) => safeTool(SEARCH_TOOL, () => searchMyWork(ctx, args)),
  );

  server.registerTool(
    STANDUP_TOOL,
    {
      title: 'Standup notes',
      description: standupDescription,
      inputSchema: standupInputSchema,
      annotations: readOnly,
    },
    async (args) => safeTool(STANDUP_TOOL, () => getStandupNotes(ctx, args)),
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
