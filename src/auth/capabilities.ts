import type { CredentialContext } from './credential-provider.js';
import { mutationToolsEnabled } from './credential-provider.js';
import {
  SEARCH_ANALYTICS_MAX_ROW_LIMIT,
  SEARCH_ANALYTICS_MAX_ROWS_PER_DAY,
  URL_INSPECTION_MAX_BATCH,
} from '../google/constants.js';

export type CapabilityState = {
  auth_mode: CredentialContext['mode'];
  scopes: string[];
  writes_enabled: boolean;
  mutation_tools_enabled: boolean;
  search_analytics: {
    max_row_limit: number;
    max_rows_per_day: number;
    dimensions: string[];
    data_states: string[];
    disclosure: string;
  };
  url_inspection: {
    max_batch: number;
    disclosure: string;
  };
};

export function buildCapabilityState(
  context: CredentialContext,
): CapabilityState {
  return {
    auth_mode: context.mode,
    scopes: context.scopes,
    writes_enabled: context.canWrite,
    mutation_tools_enabled: mutationToolsEnabled(context),
    search_analytics: {
      max_row_limit: SEARCH_ANALYTICS_MAX_ROW_LIMIT,
      max_rows_per_day: SEARCH_ANALYTICS_MAX_ROWS_PER_DAY,
      dimensions: [
        'date',
        'hour',
        'query',
        'page',
        'country',
        'device',
        'searchAppearance',
      ],
      data_states: ['final', 'all', 'hourly_all'],
      disclosure:
        'Search Analytics returns top rows sorted by clicks, not guaranteed exhaustive data. Fresh and hourly data may change.',
    },
    url_inspection: {
      max_batch: URL_INSPECTION_MAX_BATCH,
      disclosure:
        'URL Inspection returns Google index snapshot data only. It does not request indexing or perform a live crawl test.',
    },
  };
}
