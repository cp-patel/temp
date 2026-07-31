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

All six return compact, pre-digested JSON. List tools share the envelope
`{ items, total_found, has_more }`, plus `warnings` (upstream failures) and `notes`
(server-side truncation) when relevant.

### `whats_blocked` — start here

Takes no parameters. Answers "what am I blocked on, and what am I blocking?" in one call,
which is the question this whole server exists to answer. Returns three labelled sections plus
a `summary` line computed in code:

- `waiting_on_reviewers` — your PRs open >3 days with no approval, or with changes requested
  that you have not pushed for since.
- `blocked_issues` — your Linear issues that are genuinely stuck.
- `you_are_blocking` — PRs awaiting *your* review for >5 days.

Every item carries a `reason` explaining why it qualified.

### `get_my_review_queue`

Open PRs where you are a requested reviewer, oldest first.

| Input | Type | Default | Notes |
|---|---|---|---|
| `scope` | `"work" \| "personal" \| "both"` | `"both"` | `"both"` queries each account separately and tags results |
| `max_results` | integer 1–30 | `15` | Oldest-first, so a small cap keeps the stalest reviews |

Each item: `repo`, `number`, `title`, `author`, `age_days`, `additions`, `deletions`,
`changed_files`, `ci`, `draft`, `url`, `source`.

`ci` is normalised to one short vocabulary: `passing (n)`, `failing (n/m)`, `pending (n/m)`,
`mixed (n)`, `none`, or `unknown` when enrichment failed for that row.

### `get_my_open_prs`

The mirror image: open PRs *you* authored, oldest first, with the review state rolled up.
Same inputs as above. Adds `approvals`, `changes_requested`, `pushed_since_review`,
`awaiting` (requested reviewers who have not responded) and `days_since_activity`.

`pushed_since_review` answers "have I addressed the feedback yet?" — it compares the PR's head
commit against the most recent changes-requested review.

### `get_pr_context`

One PR in depth, as a single bundle.

| Input | Type | Default | Notes |
|---|---|---|---|
| `scope` | `"work" \| "personal"` | — | **Required.** No default: guessing could reach for the wrong credential |
| `repo` | `"owner/name"` | — | Exactly as returned in other tools' `repo` field |
| `number` | integer | — | PR number |
| `include_diff_stats` | boolean | `true` | Set false to skip per-file stats and save a request |

Returns title, truncated body (1,500 chars), author, state, per-check CI, each reviewer's
latest state, the last 5 review comments, and per-file additions/deletions capped at 25 files
with a `files_omitted` count.

**Never returns the raw diff.** Per-file line counts only. To read actual code changes, open
the PR's files page in a browser.

### `get_my_linear_issues`

Linear issues assigned to you, most-stalled first.

| Input | Type | Default | Notes |
|---|---|---|---|
| `state_filter` | `"active" \| "blocked" \| "all"` | `"active"` | `"active"` excludes completed/cancelled |
| `max_results` | integer 1–50 | `15` | |

Each item: `identifier`, `title`, `state`, `priority`, `project`, `days_in_state`, `url`, and
`reason` when filtering to blocked.

### `search_my_work`

Free-text search across GitHub PR titles/bodies and Linear issue titles at once — the escape
hatch when the specific tools do not fit.

| Input | Type | Default | Notes |
|---|---|---|---|
| `query` | string, 2–200 chars | — | Plain words; qualifiers are neither needed nor honoured |
| `scope` | `"work" \| "personal" \| "both"` | `"both"` | Linear is always searched |
| `max_results` | integer 1–25 | `10` | |

Unlike the other tools this is **not** restricted to your own items — only to what your tokens
can see. Results are interleaved across sources so one prolific upstream cannot crowd out the
others.

## How "blocked" is decided

Linear has **no native blocked state** — `WorkflowState.type` is only
`triage | backlog | unstarted | started | completed | canceled | duplicate`. So an issue counts
as blocked when either:

1. its workflow state is *named* like "Blocked" (matched case-insensitively), or
2. another issue blocks it via an inverse `blocks` relation.

Blockers that are already completed or cancelled are ignored — a closed blocker no longer
blocks anything, and counting it would keep issues "blocked" forever. When both signals are
present, the concrete blocker is reported, since naming `ENG-123` beats restating the column.

`days_in_state` prefers the real workflow transition from the issue's history. If that is
unavailable it falls back to the state's dedicated timestamp (`startedAt`, `triagedAt`,
`completedAt`, `canceledAt`), and finally to `createdAt` — deliberately *not* `updatedAt`,
which moves on any edit and would make a long-stalled issue look freshly touched.

## Behaviour notes

- **Caching.** Identical calls within 60 seconds are served from an in-memory cache. Failed
  calls are never cached, so a transient outage is retryable immediately.
- **Rate limits.** On a GitHub 403/429 with rate-limit headers, the server reports minutes
  until reset rather than retrying in a loop.
- **Enrichment cost.** GitHub's REST search returns neither diff stats nor CI state, so each
  PR needs follow-up calls. Three things keep that bounded:
  - search results are merged, sorted and trimmed *before* enrichment, so `scope: "both"` with
    `max_results: 15` enriches 15 PRs rather than 30;
  - follow-ups run with bounded concurrency (5 in flight) rather than all at once, which also
    avoids GitHub's secondary rate limits;
  - `whats_blocked` skips enrichment entirely on its review-queue side (age and draft status
    come free with the search) and skips CI on its authored side (no staleness rule consults
    it), cutting roughly two thirds of the follow-up requests it would otherwise make.
- **Degradation.** If enrichment fails for one PR, that PR is still listed with
  `ci: "unknown"` and no diff stats. One bad row never sinks the call.
- **Commit freshness** comes from the PR's head commit, fetched by SHA — not from
  `pulls.listCommits`, which pages through up to 250 commits in a fixed order and would
  report the *oldest* commits for a long-lived PR, making a freshly pushed branch look stale.
- **A missing Linear payload is an error, not an empty list.** A GraphQL response with
  `data: null` is reported as a warning rather than silently answering "you have no issues".

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
    linear.ts       Linear GraphQL queries, blocked detection, issue mapping
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
