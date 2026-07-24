import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import type { CredentialContext } from './auth/credential-provider.js';
import { registerPrompts } from './prompts/index.js';
import { registerResources } from './resources/index.js';
import { registerReadTools } from './tools/read-tools.js';
import { registerWriteTools } from './tools/write-tools.js';

const SERVER_INSTRUCTIONS = `# lomi. Google Search Console MCP

Read-only by default. Start with \`gsc_list_properties\`, then use \`gsc_search_analytics\`, \`gsc_performance_overview\`, \`gsc_inspect_url\`, or \`gsc_list_sitemaps\`.

Search Analytics returns top rows sorted by clicks, not guaranteed exhaustive data. URL Inspection returns indexed snapshots only and does not request indexing.

Mutation tools are available only when write scope and \`GSC_ENABLE_WRITES=true\` are both configured.`;

export function buildGscServer(credentials: CredentialContext): McpServer {
  const server = new McpServer(
    {
      name: 'lomi-gsc',
      version: '0.1.0',
      title: 'lomi. Google Search Console MCP',
      description:
        'Typed Google Search Console analytics, inspection, and sitemap tools.',
      websiteUrl: 'https://docs.lomi.africa/build/mcp-gsc',
    },
    {
      instructions: SERVER_INSTRUCTIONS,
      capabilities: {
        logging: {},
      },
    },
  );

  registerReadTools(server, credentials);
  registerWriteTools(server, credentials);
  registerResources(server, credentials);
  registerPrompts(server);

  return server;
}
