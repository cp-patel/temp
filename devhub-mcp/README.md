# devhub-mcp

A personal MCP server that wraps GitHub and Linear behind a small number of semantically
rich tools, so an LLM client can answer "what should I review today?" or "what of mine is
blocked?" in one or two tool calls instead of ten.

It is **read-only**. No tool creates, edits or deletes anything in GitHub or Linear.

## Design constraints

These are deliberate and load-bearing:

- **Fat tools, not thin wrappers.** Every tool answers a human question and returns
  pre-digested output. There is no raw API passthrough.
- **Context budget.** No tool response exceeds ~8,000 characters (~2,000 tokens). Truncation
  happens server-side and is always disclosed in a `notes` field — never silently.
- **Strict credential separation.** Two GitHub tokens (work, personal) are never
  interchanged. Every GitHub call takes an explicit `scope`; there is no default that
  silently mixes them.
- **Partial failure degrades, never fails.** If one upstream is down, the healthy portion is
  returned with a `warnings` array.
- **Never returns raw diffs.** Diff *stats* only.

## Requirements

- Node.js 20 or newer
- A GitHub fine-grained PAT for your work org
- A separate GitHub fine-grained PAT for your personal repos
- A Linear personal API key

## Install and build

```bash
cd devhub-mcp
npm install
npm run build
```

Verify the build with the test suite (no credentials or network required):

```bash
npm test
```

## Token creation

### GitHub — two separate fine-grained PATs

Create these at **Settings → Developer settings → Personal access tokens → Fine-grained
tokens**. Make two tokens; do not reuse one for both scopes.

**Token 1 — work** (`GITHUB_WORK_TOKEN`)

- **Resource owner:** your work organisation (e.g. `headout`)
- **Repository access:** All repositories (or select the repos you review in)
- **Repository permissions** — all read-only:
  | Permission | Access | Why |
  |---|---|---|
  | Metadata | Read-only | Mandatory; GitHub enables this automatically |
  | Pull requests | Read-only | PR listings, reviews, review comments, changed files |
  | Contents | Read-only | Commit timestamps, used for "no new commits since" staleness |
  | Checks | Read-only | Check-run conclusions for CI status |
  | Commit statuses | Read-only | Legacy combined status, used as the CI fallback |
  | Issues | Read-only | `GET /search/issues` backs PR search; keeps text search complete |
- **Account permissions:** none required.

**Token 2 — personal** (`GITHUB_PERSONAL_TOKEN`)

- **Resource owner:** your own account
- **Repository access:** All repositories
- Same six repository permissions as above.

> **Two caveats worth knowing before you generate the work token.**
>
> 1. Fine-grained PATs targeting an organisation often require **org owner approval** before
>    they work. Until approved, calls return 403 and this server will tell you the token "may
>    lack repo read scope, or the org requires SAML/SSO authorization".
> 2. Fine-grained PATs only ever return search results from repositories they can see. If org
>    policy blocks fine-grained tokens entirely, a **classic PAT with the `repo` scope** is
>    the working alternative — the server treats either kind identically.

### Linear

Create a personal API key at
**Linear → Settings → Security & access → Personal API keys**
(<https://linear.app/settings/account/security>). No scope selection is required.

## Configuration

Six environment variables, all supplied by the MCP client. The server never reads tokens
from a file and never logs their values.

| Variable | Purpose |
|---|---|
| `GITHUB_WORK_TOKEN` | Fine-grained PAT, read-only, scoped to the work org |
| `GITHUB_PERSONAL_TOKEN` | Fine-grained PAT, read-only, scoped to your personal repos |
| `GITHUB_WORK_ORG` | The org used for `scope: "work"` queries, e.g. `headout` |
| `GITHUB_PERSONAL_USERNAME` | Your personal GitHub username |
| `LINEAR_API_KEY` | Linear personal API key |
| `LINEAR_USER_EMAIL` | Resolves "my" issues in Linear |

See `.env.example` for the same list with no values.

The server **fails fast**: on startup it validates that all six are present and makes one
cheap authenticated call per client. If anything is wrong it prints the offending variable
*names* to stderr and exits non-zero.

## Client configuration

### Claude Code — project scope (`.mcp.json`)

Put this in `.mcp.json` at your project root. Claude Code expands `${VAR}` (and
`${VAR:-default}`) inside `command`, `args` and `env`, so the actual secrets stay in your
shell environment and this file is safe to commit.

```json
{
  "mcpServers": {
    "devhub": {
      "command": "node",
      "args": ["/absolute/path/to/devhub-mcp/dist/index.js"],
      "env": {
        "GITHUB_WORK_TOKEN": "${GITHUB_WORK_TOKEN}",
        "GITHUB_PERSONAL_TOKEN": "${GITHUB_PERSONAL_TOKEN}",
        "GITHUB_WORK_ORG": "${GITHUB_WORK_ORG:-headout}",
        "GITHUB_PERSONAL_USERNAME": "${GITHUB_PERSONAL_USERNAME:-cp-patel}",
        "LINEAR_API_KEY": "${LINEAR_API_KEY}",
        "LINEAR_USER_EMAIL": "${LINEAR_USER_EMAIL}"
      }
    }
  }
}
```

Export the secrets wherever your shell starts (`~/.zshrc`, direnv, a secrets manager):

```bash
export GITHUB_WORK_TOKEN=...
export GITHUB_PERSONAL_TOKEN=...
export LINEAR_API_KEY=...
export LINEAR_USER_EMAIL=you@example.com
```

Then check it loaded:

```bash
claude
/mcp          # devhub should be listed as connected
```

### Claude Desktop (`claude_desktop_config.json`)

- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "devhub": {
      "command": "node",
      "args": ["/absolute/path/to/devhub-mcp/dist/index.js"],
      "env": {
        "GITHUB_WORK_TOKEN": "ghp_your_work_token_here",
        "GITHUB_PERSONAL_TOKEN": "ghp_your_personal_token_here",
        "GITHUB_WORK_ORG": "headout",
        "GITHUB_PERSONAL_USERNAME": "cp-patel",
        "LINEAR_API_KEY": "lin_api_your_key_here",
        "LINEAR_USER_EMAIL": "you@example.com"
      }
    }
  }
}
```

> **Important difference from Claude Code:** Claude Desktop does **not** perform `${VAR}`
> expansion in this file, and it does not inherit your shell environment. The values must be
> literal. Treat `claude_desktop_config.json` as a secret-bearing file — never commit it. If
> you would rather not have plaintext tokens on disk, point `command` at a small wrapper
> script that exports them from your keychain and then execs `node .../dist/index.js`.

Restart Claude Desktop after editing. Both clients need an **absolute** path to
`dist/index.js`.

## Manual verification with the MCP Inspector

```bash
cd devhub-mcp
npm run inspect
```

That builds and launches `npx @modelcontextprotocol/inspector node dist/index.js`. The
Inspector needs the six variables in its environment, so either export them in the shell
first or add them in the Inspector's own Environment panel.

If credentials are wrong the server exits immediately and the Inspector shows the
connection failing — the reason is on stderr, naming the variable to fix.

## Tools

### `get_my_review_queue`

Open PRs where you are a requested reviewer, oldest first.

| Input | Type | Default | Notes |
|---|---|---|---|
| `scope` | `"work" \| "personal" \| "both"` | `"both"` | `"both"` queries each account separately and tags results |
| `max_results` | integer 1–30 | `15` | Oldest-first, so a small cap keeps the stalest reviews |

Returns `{ items, total_found, has_more }`, plus `warnings` / `notes` when relevant. Each
item carries `repo`, `number`, `title`, `author`, `age_days`, `additions`, `deletions`,
`changed_files`, `ci`, `draft`, `url` and `source`.

`ci` is normalised to one short vocabulary: `passing (n)`, `failing (n/m)`, `pending (n/m)`,
`mixed (n)`, `none`, or `unknown` when enrichment failed for that row.

## Behaviour notes

- **Caching.** Identical calls within 60 seconds are served from an in-memory cache. Failed
  calls are never cached, so a transient outage is retryable immediately.
- **Rate limits.** On a GitHub 403/429 with rate-limit headers, the server reports minutes
  until reset rather than retrying in a loop.
- **Enrichment cost.** GitHub's REST search returns neither diff stats nor CI state, so each
  PR needs follow-up calls. These run with bounded concurrency, and the search results are
  merged, sorted and trimmed *before* enrichment, so `scope: "both"` with `max_results: 15`
  enriches 15 PRs rather than 30.
- **Degradation.** If enrichment fails for one PR, that PR is still listed with
  `ci: "unknown"` and no diff stats. One bad row never sinks the call.

## Development

```bash
npm run typecheck   # tsc --noEmit, strict, no `any`
npm test            # vitest (builds first; no network needed)
npm run build
```

Layout:

```
src/
  index.ts          server bootstrap, tool registration, stdio transport
  clients.ts        two Octokits + Linear client, env + credential validation
  tools/            one file per tool
  lib/
    cache.ts        60s TTL cache keyed by tool+args
    truncate.ts     char budget and per-field caps
    format.ts       shared item shapes, envelope, budget enforcement
    errors.ts       structured upstream failures, secret scrubbing
    github.ts       shared GitHub helpers (CI status normalisation)
    concurrency.ts  bounded-concurrency map
test/
```

Transport is confined to `index.ts`, so adding a streamable-HTTP port later touches only
that file.

### A note on stdout

Under the stdio transport, **stdout is the JSON-RPC channel**. Every diagnostic in this
process goes to stderr, including Octokit's own request logging, which is explicitly
re-routed and scrubbed. A test asserts that the server writes zero bytes to stdout on the
failure path.
