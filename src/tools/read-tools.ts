import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import { buildCapabilityState } from '../auth/capabilities.js';
import type { CredentialContext } from '../auth/credential-provider.js';
import { SearchConsoleClient } from '../google/search-console-client.js';
import {
  batchInspectInputSchema,
  comparePeriodsInputSchema,
  formatIsoDate,
  inclusiveDateRange,
  indexingIssuesInputSchema,
  inspectUrlInputSchema,
  performanceOverviewInputSchema,
  quickWinsInputSchema,
  searchAnalyticsInputSchema,
  siteDetailInputSchema,
  sitemapDetailInputSchema,
  sitemapListInputSchema,
} from '../google/schemas.js';
import { sanitizeClientError } from '../google/errors.js';
import { toolError, toolSuccess } from './structured-result.js';

export function registerReadTools(
  server: McpServer,
  credentials: CredentialContext,
): void {
  const client = new SearchConsoleClient(credentials);

  server.registerTool(
    'gsc_capabilities',
    {
      title: 'Search Console capabilities',
      description:
        'Return active auth mode, scopes, limits, and disclosure notes for this server.',
      inputSchema: {},
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async () => toolSuccess(buildCapabilityState(credentials)),
  );

  server.registerTool(
    'gsc_list_properties',
    {
      title: 'List Search Console properties',
      description:
        'List properties accessible to the configured Google credential.',
      inputSchema: {},
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async () => safe(() => client.listSites()),
  );

  server.registerTool(
    'gsc_get_property',
    {
      title: 'Get Search Console property',
      description: 'Get permission details for one Search Console property.',
      inputSchema: siteDetailInputSchema.shape,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (input) => safe(() => client.getSite(input.site_url)),
  );

  server.registerTool(
    'gsc_search_analytics',
    {
      title: 'Search analytics query',
      description:
        'Query clicks, impressions, CTR, and position with dimensions, filters, pagination, and data freshness controls.',
      inputSchema: searchAnalyticsInputSchema.shape,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (input) => safe(() => client.searchAnalytics(input)),
  );

  server.registerTool(
    'gsc_performance_overview',
    {
      title: 'Performance overview',
      description:
        'Return aggregate clicks, impressions, CTR, position, and daily trend for a recent period.',
      inputSchema: performanceOverviewInputSchema.shape,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (input) =>
      safe(async () => {
        const range = inclusiveDateRange(input.days);
        const totals = await client.searchAnalytics({
          site_url: input.site_url,
          start_date: range.startDate,
          end_date: range.endDate,
          dimensions: [],
          search_type: input.search_type,
          aggregation_type: 'auto',
          data_state: 'final',
          row_limit: 1,
          start_row: 0,
          filters: [],
        });
        const daily = await client.searchAnalytics({
          site_url: input.site_url,
          start_date: range.startDate,
          end_date: range.endDate,
          dimensions: ['date'],
          search_type: input.search_type,
          aggregation_type: 'auto',
          data_state: 'final',
          row_limit: 1000,
          start_row: 0,
          filters: [],
        });
        const summary = totals.rows[0] ?? {
          keys: {},
          clicks: 0,
          impressions: 0,
          ctr: 0,
          position: 0,
        };
        return {
          site_url: input.site_url,
          date_range: range,
          totals: {
            clicks: summary.clicks,
            impressions: summary.impressions,
            ctr: summary.ctr,
            position: summary.position,
          },
          daily_trend: daily.rows,
          disclosure: daily.disclosure,
        };
      }),
  );

  server.registerTool(
    'gsc_compare_periods',
    {
      title: 'Compare search periods',
      description:
        'Compare top rows between two date ranges for the same dimensions.',
      inputSchema: comparePeriodsInputSchema.shape,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (input) =>
      safe(async () => {
        const [period1, period2] = await Promise.all([
          client.searchAnalytics({
            site_url: input.site_url,
            start_date: input.period1_start,
            end_date: input.period1_end,
            dimensions: input.dimensions,
            search_type: input.search_type,
            aggregation_type: 'auto',
            data_state: 'final',
            row_limit: input.row_limit,
            start_row: 0,
            filters: [],
          }),
          client.searchAnalytics({
            site_url: input.site_url,
            start_date: input.period2_start,
            end_date: input.period2_end,
            dimensions: input.dimensions,
            search_type: input.search_type,
            aggregation_type: 'auto',
            data_state: 'final',
            row_limit: input.row_limit,
            start_row: 0,
            filters: [],
          }),
        ]);
        return {
          site_url: input.site_url,
          period1: {
            start_date: input.period1_start,
            end_date: input.period1_end,
            rows: period1.rows,
          },
          period2: {
            start_date: input.period2_start,
            end_date: input.period2_end,
            rows: period2.rows,
          },
          disclosure:
            'Comparison uses top rows only and may omit long-tail changes.',
        };
      }),
  );

  server.registerTool(
    'gsc_quick_wins',
    {
      title: 'Find quick-win queries',
      description:
        'Identify queries with meaningful impressions, low CTR, and positions in a target range.',
      inputSchema: quickWinsInputSchema.shape,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (input) =>
      safe(async () => {
        const analytics = await client.searchAnalytics({
          site_url: input.site_url,
          start_date: input.start_date,
          end_date: input.end_date,
          dimensions: ['query', 'page'],
          search_type: 'web',
          aggregation_type: 'auto',
          data_state: 'final',
          row_limit: 5000,
          start_row: 0,
          filters: [],
        });
        const opportunities = analytics.rows
          .filter((row) => {
            const impressions = row.impressions;
            const ctr = row.ctr;
            const position = row.position;
            return (
              impressions >= input.min_impressions &&
              ctr <= input.max_ctr &&
              position >= input.position_min &&
              position <= input.position_max
            );
          })
          .map((row) => ({
            ...row,
            estimated_gain_clicks: Math.max(
              0,
              Math.round(row.impressions * 0.05 - row.clicks),
            ),
          }))
          .sort((a, b) => b.estimated_gain_clicks - a.estimated_gain_clicks)
          .slice(0, input.row_limit);
        return {
          site_url: input.site_url,
          date_range: {
            start_date: input.start_date,
            end_date: input.end_date,
          },
          count: opportunities.length,
          opportunities,
          disclosure:
            'Quick wins are heuristic opportunities based on top query/page rows only.',
        };
      }),
  );

  server.registerTool(
    'gsc_inspect_url',
    {
      title: 'Inspect URL',
      description: 'Inspect one URL indexing status in Google Search Console.',
      inputSchema: inspectUrlInputSchema.shape,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (input) =>
      safe(() =>
        client.inspectUrl(
          input.site_url,
          input.inspection_url,
          input.language_code,
        ),
      ),
  );

  server.registerTool(
    'gsc_batch_inspect_urls',
    {
      title: 'Batch inspect URLs',
      description:
        'Inspect up to 20 URLs with bounded concurrency and quota-aware execution.',
      inputSchema: batchInspectInputSchema.shape,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (input) =>
      safe(() =>
        client.batchInspectUrls(
          input.site_url,
          input.inspection_urls,
          input.language_code,
        ),
      ),
  );

  server.registerTool(
    'gsc_indexing_issues',
    {
      title: 'Summarize indexing issues',
      description:
        'Batch inspect URLs and summarize verdicts that look non-indexable.',
      inputSchema: indexingIssuesInputSchema.shape,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (input) =>
      safe(async () => {
        const batch = await client.batchInspectUrls(
          input.site_url,
          input.inspection_urls,
          'en-US',
        );
        const issues = batch.results
          .map((result) => {
            const inspection = result.inspection_result as
              | Record<string, unknown>
              | undefined;
            const indexStatus = inspection?.indexStatusResult as
              | Record<string, unknown>
              | undefined;
            const verdict = indexStatus?.verdict;
            if (verdict === 'PASS') {
              return null;
            }
            return {
              inspection_url: result.inspection_url,
              verdict,
              coverage_state: indexStatus?.coverageState,
              indexing_state: indexStatus?.indexingState,
            };
          })
          .filter(Boolean);
        return {
          site_url: input.site_url,
          inspected: batch.count,
          issue_count: issues.length,
          issues,
          disclosure: batch.results[0]?.disclosure,
        };
      }),
  );

  server.registerTool(
    'gsc_list_sitemaps',
    {
      title: 'List sitemaps',
      description: 'List submitted sitemaps for a Search Console property.',
      inputSchema: sitemapListInputSchema.shape,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (input) =>
      safe(() => client.listSitemaps(input.site_url, input.sitemap_index)),
  );

  server.registerTool(
    'gsc_get_sitemap',
    {
      title: 'Get sitemap details',
      description: 'Get details for one submitted sitemap.',
      inputSchema: sitemapDetailInputSchema.shape,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (input) =>
      safe(() => client.getSitemap(input.site_url, input.feedpath)),
  );
}

async function safe<T extends Record<string, unknown>>(
  fn: () => Promise<T>,
): Promise<ReturnType<typeof toolSuccess<T>> | ReturnType<typeof toolError>> {
  try {
    return toolSuccess(await fn());
  } catch (error) {
    return toolError(sanitizeClientError(error));
  }
}

export const readToolNames = [
  'gsc_capabilities',
  'gsc_list_properties',
  'gsc_get_property',
  'gsc_search_analytics',
  'gsc_performance_overview',
  'gsc_compare_periods',
  'gsc_quick_wins',
  'gsc_inspect_url',
  'gsc_batch_inspect_urls',
  'gsc_indexing_issues',
  'gsc_list_sitemaps',
  'gsc_get_sitemap',
] as const;

export function defaultDateRange(days = 28): {
  start_date: string;
  end_date: string;
} {
  const range = inclusiveDateRange(days);
  return {
    start_date: range.startDate,
    end_date: range.endDate,
  };
}

export function todayIso(): string {
  return formatIsoDate(new Date());
}
