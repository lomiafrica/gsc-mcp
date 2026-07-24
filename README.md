# @lomi./gsc-mcp

Public Model Context Protocol server for Google Search Console.

**Repository:** [github.com/lomiafrica/gsc-mcp](https://github.com/lomiafrica/gsc-mcp) — standalone project. In the lomi. monorepo it is checked out as a submodule at `apps/tools/gsc-mcp`.

## Features

- Typed Search Analytics with dimensions, filters, pagination, and freshness controls
- Performance overview, period comparison, and quick-win opportunity detection
- URL inspection with bounded batch support
- Sitemap and property discovery
- Read-only by default; mutation tools require explicit write scope and `GSC_ENABLE_WRITES=true`
- Local stdio for Cursor and Claude Desktop
- Secure self-hosted Streamable HTTP for teams

## Monorepo checkout

Inside the lomi. monorepo:

```bash
git submodule update --init apps/tools/gsc-mcp
cd apps/tools/gsc-mcp
pnpm install
pnpm run build
pnpm auth
```

## Quick start

```bash
npx -y @lomi./gsc-mcp auth
```

Place your Google OAuth desktop client JSON at:

```text
~/.config/lomi-gsc-mcp/oauth_credentials.json
```

Then add to Cursor:

```json
{
  "mcpServers": {
    "google-search-console": {
      "command": "npx",
      "args": ["-y", "@lomi./gsc-mcp"]
    }
  }
}
```

## Authentication

Choose one:

- Desktop OAuth with PKCE (`lomi-gsc-mcp auth`)
- Service account JSON via `GSC_SERVICE_ACCOUNT_KEY_FILE`
- Application Default Credentials for automation

Default OAuth scope is read-only. Set `GSC_OAUTH_SCOPE=write` and `GSC_ENABLE_WRITES=true` only when you need sitemap or property mutations.

## Self-hosted HTTP

```bash
GSC_MCP_TRANSPORT=http \
GSC_MCP_CLIENT_BEARER_TOKEN=replace-me \
GSC_MCP_ALLOWED_HOSTS=localhost \
GSC_MCP_ALLOWED_ORIGINS=http://localhost:3000 \
npx -y @lomi./gsc-mcp-http
```

Non-loopback HTTP requires `GSC_MCP_CLIENT_BEARER_TOKEN`.

## Docs

See `https://docs.lomi.africa/build/mcp-gsc`.

## License

MIT
