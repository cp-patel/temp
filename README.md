# temp

## devhub-mcp

A personal, read-only MCP server that wraps GitHub and Linear behind six semantically rich
tools, so an LLM client can answer "what should I review today?" or "what am I blocked on and
what am I blocking?" in one call instead of ten.

See [`devhub-mcp/README.md`](devhub-mcp/README.md) for setup, the exact fine-grained PAT
permissions required, and client configuration for Claude Code and Claude Desktop.

```bash
cd devhub-mcp
npm install
npm test          # no credentials or network needed
npm run inspect   # build + launch the MCP Inspector
```
