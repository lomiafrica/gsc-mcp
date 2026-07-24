export const GSC_READONLY_SCOPE =
  'https://www.googleapis.com/auth/webmasters.readonly' as const;
export const GSC_WRITE_SCOPE = 'https://www.googleapis.com/auth/webmasters' as const;

export const WEBMASTERS_V3_BASE = 'https://www.googleapis.com/webmasters/v3';
export const URL_INSPECTION_BASE = 'https://searchconsole.googleapis.com/v1';

export const SEARCH_ANALYTICS_MAX_ROW_LIMIT = 25_000;
export const SEARCH_ANALYTICS_MAX_ROWS_PER_DAY = 50_000;
export const URL_INSPECTION_MAX_BATCH = 20;
export const URL_INSPECTION_CONCURRENCY = 3;

export const SEARCH_DIMENSIONS = [
  'date',
  'hour',
  'query',
  'page',
  'country',
  'device',
  'searchAppearance',
] as const;

export const SEARCH_TYPES = [
  'web',
  'image',
  'video',
  'news',
  'discover',
  'googleNews',
] as const;

export const DATA_STATES = ['final', 'all', 'hourly_all'] as const;

export const FILTER_OPERATORS = [
  'equals',
  'notEquals',
  'contains',
  'notContains',
  'includingRegex',
  'excludingRegex',
] as const;

export const FILTER_DIMENSIONS = [
  'country',
  'device',
  'page',
  'query',
  'searchAppearance',
] as const;

export const AGGREGATION_TYPES = [
  'auto',
  'byPage',
  'byProperty',
  'byNewsShowcasePanel',
] as const;

export const DEVICES = ['DESKTOP', 'MOBILE', 'TABLET'] as const;

export type SearchDimension = (typeof SEARCH_DIMENSIONS)[number];
export type SearchType = (typeof SEARCH_TYPES)[number];
export type DataState = (typeof DATA_STATES)[number];
export type FilterOperator = (typeof FILTER_OPERATORS)[number];
export type FilterDimension = (typeof FILTER_DIMENSIONS)[number];
export type AggregationType = (typeof AGGREGATION_TYPES)[number];
export type DeviceType = (typeof DEVICES)[number];
