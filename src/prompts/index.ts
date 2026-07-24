import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

export function registerPrompts(server: McpServer): void {
  server.registerPrompt(
    'weekly-performance-review',
    {
      title: 'Weekly performance review',
      description:
        'Review the last 28 days of Search Console performance for one property.',
    },
    async () => ({
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: `Review Search Console performance for the target property over the last 28 days.

Steps:
1. Call gsc_list_properties and confirm the exact property identifier.
2. Call gsc_performance_overview for the selected property.
3. Call gsc_search_analytics with dimensions query and page, row_limit 100.
4. Summarize top queries, top pages, and notable CTR or position changes.

Disclose that Search Console returns top rows only, not guaranteed exhaustive data.`,
          },
        },
      ],
    }),
  );

  server.registerPrompt(
    'low-hanging-opportunities',
    {
      title: 'Low-hanging SEO opportunities',
      description:
        'Find quick-win queries with meaningful impressions and weak CTR.',
    },
    async () => ({
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: `Find low-hanging SEO opportunities for the selected property.

Use gsc_quick_wins with the last 28 days, then explain the top opportunities with page context and concrete title/meta recommendations. Mention that the analysis is based on top query/page rows only.`,
          },
        },
      ],
    }),
  );

  server.registerPrompt(
    'cannibalization-analysis',
    {
      title: 'Keyword cannibalization analysis',
      description:
        'Look for multiple pages competing for the same query.',
    },
    async () => ({
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: `Analyze keyword cannibalization for the selected property.

Call gsc_search_analytics with dimensions query and page over the last 28 days, row_limit 1000. Group rows by query and flag queries served by multiple pages with meaningful impressions. Recommend canonical or consolidation actions.`,
          },
        },
      ],
    }),
  );

  server.registerPrompt(
    'indexing-audit',
    {
      title: 'Indexing audit',
      description:
        'Inspect a set of important URLs and summarize indexing blockers.',
    },
    async () => ({
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: `Run an indexing audit for the selected property.

Inspect the important URLs provided by the user with gsc_indexing_issues.

Summarize verdicts, coverage states, canonical mismatches, and the next fixes. Mention that inspection returns indexed snapshots only and does not request indexing.`,
          },
        },
      ],
    }),
  );
}
