/**
 * Startup contract, verified against the real built binary.
 *
 * Two invariants matter enough to test at the process level:
 *  - Missing configuration must exit non-zero with the offending variable named on stderr.
 *  - stdout must stay byte-empty. Under the stdio transport stdout is the JSON-RPC channel,
 *    so a single stray character from us or a dependency breaks every client.
 *
 * Uses an empty environment, so it never touches the network.
 */

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const entry = resolve(here, '../dist/index.js');

interface RunResult {
  readonly code: number | null;
  readonly stdout: string;
  readonly stderr: string;
}

/** Run the built server with an explicitly controlled environment. */
async function runServer(env: Record<string, string>): Promise<RunResult> {
  return new Promise<RunResult>((resolvePromise, rejectPromise) => {
    const child = spawn(process.execPath, [entry], {
      // A bare env: none of the six variables leak in from the test runner.
      env: { PATH: process.env.PATH ?? '', ...env },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString('utf8');
    });
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8');
    });
    child.on('error', rejectPromise);
    child.on('close', (code) => {
      resolvePromise({ code, stdout, stderr });
    });
    child.stdin.end();
  });
}

describe('startup validation (built binary)', () => {
  it('has been built', () => {
    expect(existsSync(entry), `expected ${entry} — run "npm run build"`).toBe(true);
  });

  it('exits non-zero and names every missing variable', async () => {
    const result = await runServer({});

    expect(result.code).toBe(1);
    for (const variable of [
      'GITHUB_WORK_TOKEN',
      'GITHUB_PERSONAL_TOKEN',
      'GITHUB_WORK_ORG',
      'GITHUB_PERSONAL_USERNAME',
      'LINEAR_API_KEY',
      'LINEAR_USER_EMAIL',
    ]) {
      expect(result.stderr).toContain(variable);
    }
  });

  it('writes nothing to stdout, so the JSON-RPC channel stays clean', async () => {
    const result = await runServer({});
    expect(result.stdout).toBe('');
  });

  it('names only the variable that is actually broken', async () => {
    const result = await runServer({
      GITHUB_WORK_TOKEN: 'ghp_placeholder',
      GITHUB_PERSONAL_TOKEN: 'ghp_placeholder',
      GITHUB_WORK_ORG: 'acme',
      GITHUB_PERSONAL_USERNAME: 'octo',
      LINEAR_API_KEY: 'lin_api_placeholder',
      // Malformed on purpose; everything else is well-formed.
      LINEAR_USER_EMAIL: 'nonsense',
    });

    expect(result.code).toBe(1);
    expect(result.stderr).toContain('LINEAR_USER_EMAIL');
    // The config stage must reject before any credential is put on the wire.
    expect(result.stderr).not.toContain('Credential validation failed');
  });

  it('never echoes a credential value in its diagnostics', async () => {
    const secret = 'ghp_supersecrettokenvalue123456';
    const result = await runServer({
      GITHUB_WORK_TOKEN: secret,
      GITHUB_PERSONAL_TOKEN: secret,
      GITHUB_WORK_ORG: 'acme',
      GITHUB_PERSONAL_USERNAME: 'octo',
      LINEAR_API_KEY: 'lin_api_supersecretkeyvalue123',
      LINEAR_USER_EMAIL: 'still-not-an-email',
    });

    expect(result.stderr).not.toContain(secret);
    expect(result.stderr).not.toContain('lin_api_supersecretkeyvalue123');
    expect(result.stdout).toBe('');
  });
});
