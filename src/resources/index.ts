import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import { buildCapabilityState } from '../auth/capabilities.js';
import type { CredentialContext } from '../auth/credential-provider.js';
import { SearchConsoleClient } from '../google/search-console-client.js';

export function registerResources(
  server: McpServer,
  credentials: CredentialContext,
): void {
  server.registerResource(
    'capabilities',
    'gsc://capabilities',
    {
      title: 'Search Console capabilities',
      description: 'Active auth mode, scopes, limits, and disclosures.',
      mimeType: 'application/json',
    },
    async () => ({
      contents: [
        {
          uri: 'gsc://capabilities',
          mimeType: 'application/json',
          text: JSON.stringify(buildCapabilityState(credentials), null, 2),
        },
      ],
    }),
  );

  server.registerResource(
    'limits',
    'gsc://limits',
    {
      title: 'Search Console API limits',
      description: 'Documented quotas and output limits for this server.',
      mimeType: 'application/json',
    },
    async () => ({
      contents: [
        {
          uri: 'gsc://limits',
          mimeType: 'application/json',
          text: JSON.stringify(
            {
              search_analytics: {
                per_request_row_limit: 25000,
                max_rows_per_day: 50000,
                property_qpm: 1200,
              },
              url_inspection: {
                per_property_per_day: 2000,
                per_property_per_minute: 600,
                max_batch: 20,
              },
            },
            null,
            2,
          ),
        },
      ],
    }),
  );

  server.registerResource(
    'sites',
    'gsc://sites',
    {
      title: 'Accessible Search Console properties',
      description: 'Properties visible to the configured Google credential.',
      mimeType: 'application/json',
    },
    async () => {
      const client = new SearchConsoleClient(credentials);
      const sites = await client.listSites();
      return {
        contents: [
          {
            uri: 'gsc://sites',
            mimeType: 'application/json',
            text: JSON.stringify(sites, null, 2),
          },
        ],
      };
    },
  );
}
