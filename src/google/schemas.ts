import { z } from 'zod';

import {
  AGGREGATION_TYPES,
  DATA_STATES,
  DEVICES,
  FILTER_DIMENSIONS,
  FILTER_OPERATORS,
  SEARCH_DIMENSIONS,
  SEARCH_TYPES,
  SEARCH_ANALYTICS_MAX_ROW_LIMIT,
  URL_INSPECTION_MAX_BATCH,
} from './constants.js';

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD');

export const siteUrlSchema = z
  .string()
  .min(1)
  .describe(
    'Search Console property URL, e.g. sc-domain:example.com or https://example.com/',
  );

export const analyticsFilterSchema = z.object({
  dimension: z.enum(FILTER_DIMENSIONS),
  operator: z.enum(FILTER_OPERATORS).default('equals'),
  expression: z.string().min(1).max(4096),
});

export const searchAnalyticsInputSchema = z.object({
  site_url: siteUrlSchema,
  start_date: isoDate,
  end_date: isoDate,
  dimensions: z.array(z.enum(SEARCH_DIMENSIONS)).default(['query']),
  search_type: z.enum(SEARCH_TYPES).default('web'),
  aggregation_type: z.enum(AGGREGATION_TYPES).default('auto'),
  data_state: z.enum(DATA_STATES).default('final'),
  row_limit: z.number().int().min(1).max(SEARCH_ANALYTICS_MAX_ROW_LIMIT).default(1000),
  start_row: z.number().int().min(0).default(0),
  filters: z.array(analyticsFilterSchema).default([]),
});

export const performanceOverviewInputSchema = z.object({
  site_url: siteUrlSchema,
  days: z.number().int().min(1).max(480).default(28),
  search_type: z.enum(SEARCH_TYPES).default('web'),
});

export const comparePeriodsInputSchema = z.object({
  site_url: siteUrlSchema,
  period1_start: isoDate,
  period1_end: isoDate,
  period2_start: isoDate,
  period2_end: isoDate,
  dimensions: z.array(z.enum(SEARCH_DIMENSIONS)).default(['query']),
  search_type: z.enum(SEARCH_TYPES).default('web'),
  row_limit: z.number().int().min(1).max(1000).default(100),
});

export const quickWinsInputSchema = z.object({
  site_url: siteUrlSchema,
  start_date: isoDate,
  end_date: isoDate,
  min_impressions: z.number().int().min(1).default(50),
  max_ctr: z.number().min(0).max(1).default(0.02),
  position_min: z.number().min(1).default(4),
  position_max: z.number().min(1).default(20),
  row_limit: z.number().int().min(1).max(500).default(50),
});

export const inspectUrlInputSchema = z.object({
  site_url: siteUrlSchema,
  inspection_url: z.string().url(),
  language_code: z.string().default('en-US'),
});

export const batchInspectInputSchema = z.object({
  site_url: siteUrlSchema,
  inspection_urls: z
    .array(z.string().url())
    .min(1)
    .max(URL_INSPECTION_MAX_BATCH),
  language_code: z.string().default('en-US'),
});

export const indexingIssuesInputSchema = z.object({
  site_url: siteUrlSchema,
  inspection_urls: z
    .array(z.string().url())
    .min(1)
    .max(URL_INSPECTION_MAX_BATCH),
});

export const sitemapListInputSchema = z.object({
  site_url: siteUrlSchema,
  sitemap_index: z.string().url().optional(),
});

export const sitemapDetailInputSchema = z.object({
  site_url: siteUrlSchema,
  feedpath: z.string().url(),
});

export const siteDetailInputSchema = z.object({
  site_url: siteUrlSchema,
});

export const submitSitemapInputSchema = z.object({
  site_url: siteUrlSchema,
  feedpath: z.string().url(),
});

export const deleteSitemapInputSchema = z.object({
  site_url: siteUrlSchema,
  feedpath: z.string().url(),
  confirm: z.literal(true),
});

export const addSiteInputSchema = z.object({
  site_url: siteUrlSchema,
});

export const deleteSiteInputSchema = z.object({
  site_url: siteUrlSchema,
  confirm: z.literal(true),
});

export const deviceFilterSchema = z.enum(DEVICES);

export type SearchAnalyticsInput = z.infer<typeof searchAnalyticsInputSchema>;
export type PerformanceOverviewInput = z.infer<
  typeof performanceOverviewInputSchema
>;
export type ComparePeriodsInput = z.infer<typeof comparePeriodsInputSchema>;
export type QuickWinsInput = z.infer<typeof quickWinsInputSchema>;

export interface InclusiveDateRange {
  startDate: string;
  endDate: string;
}

export function inclusiveDateRange(days: number): InclusiveDateRange {
  const end = new Date();
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - (days - 1));
  return {
    startDate: formatIsoDate(start),
    endDate: formatIsoDate(end),
  };
}

export function formatIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function assertInspectionUrlUnderSite(
  siteUrl: string,
  inspectionUrl: string,
): void {
  if (siteUrl.startsWith('sc-domain:')) {
    const domain = siteUrl.slice('sc-domain:'.length).toLowerCase();
    const parsed = new URL(inspectionUrl);
    const host = parsed.hostname.toLowerCase();
    if (host !== domain && !host.endsWith(`.${domain}`)) {
      throw new Error(
        `inspection_url must belong to ${domain} for ${siteUrl}`,
      );
    }
    return;
  }

  const normalizedSite = siteUrl.endsWith('/') ? siteUrl : `${siteUrl}/`;
  if (!inspectionUrl.startsWith(normalizedSite.replace(/\/$/, ''))) {
    throw new Error(`inspection_url must be under ${siteUrl}`);
  }
}
