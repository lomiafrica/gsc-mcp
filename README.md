# @lomi./gsc-mcp

Public Model Context Protocol server for Google Search Console.

**Repository:** [github.com/lomiafrica/gsc-mcp](https://github.com/lomiafrica/gsc-mcp) — standalone project. In the lomi. monorepo it is checked out as a submodule at `apps/tools/gsc-mcp`.

## Features

- Portfolio health across every accessible property (or `GSC_PORTFOLIO_SITES`)
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
```

## Quick start

Preferred: Application Default Credentials plus a quota project that has the Search Console API enabled.

```bash
gcloud auth application-default login \
  --scopes=https://www.googleapis.com/auth/cloud-platform,https://www.googleapis.com/auth/webmasters.readonly
```

Then add to Cursor:

```json
{
  "mcpServers": {
    "google-search-console": {
      "command": "npx",
      "args": ["-y", "@lomi./gsc-mcp"],
      "env": {
        "GOOGLE_CLOUD_QUOTA_PROJECT": "your-gcp-project-id",
        "GSC_PORTFOLIO_SITES": "sc-domain:example.com"
      }
    }
  }
}
```

Cursor Connect only reconnects this local server. It does not sign in to Google.

## Authentication

Choose one:

- Application Default Credentials (`gcloud auth application-default login`) plus `GOOGLE_CLOUD_QUOTA_PROJECT`
- Desktop OAuth with PKCE: put a Google Desktop client JSON at `~/.config/lomi-gsc-mcp/oauth_credentials.json`, then `npx -y @lomi./gsc-mcp auth`
- Service account JSON via `GSC_SERVICE_ACCOUNT_KEY_FILE`

Default OAuth scope is read-only. Set `GSC_OAUTH_SCOPE=write` and `GSC_ENABLE_WRITES=true` only when you need sitemap or property mutations.

Start with `gsc_portfolio_health`. Sitemap `contents.indexed` is often 0 even when pages are indexed; use homepage inspection.

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

See `https://docs.lomi.africa/build/mcp`.

## License

MIT
