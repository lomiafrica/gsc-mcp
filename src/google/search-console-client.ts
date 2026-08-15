import {
  SEARCH_ANALYTICS_MAX_ROW_LIMIT,
  URL_INSPECTION_BASE,
  WEBMASTERS_V3_BASE,
} from "./constants.js";
import { parseGoogleError } from "./errors.js";
import { mapWithConcurrency, withRetry } from "./retry.js";
import type { SearchAnalyticsInput } from "./schemas.js";
import { assertInspectionUrlUnderSite } from "./schemas.js";
import type { CredentialContext } from "../auth/credential-provider.js";
import type { JsonObject, JsonValue } from "@lomi./shared";

type SearchAnalyticsRow = {
  keys?: string[];
  clicks?: number;
  impressions?: number;
  ctr?: number;
  position?: number;
};

export type SearchAnalyticsResult = {
  site_url: string;
  start_date: string;
  end_date: string;
  dimensions: string[];
  search_type: string;
  data_state: string;
  aggregation_type: string;
  start_row: number;
  row_limit: number;
  row_count: number;
  has_more: boolean;
  next_start_row: number | null;
  stop_reason: "empty_page" | "row_limit" | "daily_cap" | null;
  metadata?: {
    first_incomplete_date?: string;
    first_incomplete_hour?: string;
  };
  response_aggregation_type?: string;
  disclosure: string;
  rows: Array<{
    keys: Record<string, string>;
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
  }>;
};

export class SearchConsoleClient {
  constructor(private readonly credentials: CredentialContext) {}

  async listSites(): Promise<{
    count: number;
    properties: Array<{ site_url: string; permission_level?: string }>;
  }> {
    const data = await this.request<{
      siteEntry?: Array<{ siteUrl?: string; permissionLevel?: string }>;
    }>(`${WEBMASTERS_V3_BASE}/sites`);
    const properties = (data.siteEntry ?? []).map((entry) => ({
      site_url: entry.siteUrl ?? "",
      permission_level: entry.permissionLevel,
    }));
    return { count: properties.length, properties };
  }

  async getSite(siteUrl: string): Promise<{
    site_url: string;
    permission_level?: string;
  }> {
    const data = await this.request<{
      siteUrl?: string;
      permissionLevel?: string;
    }>(`${WEBMASTERS_V3_BASE}/sites/${encodeURIComponent(siteUrl)}`);
    return {
      site_url: data.siteUrl ?? siteUrl,
      permission_level: data.permissionLevel,
    };
  }

  async searchAnalytics(
    input: SearchAnalyticsInput,
  ): Promise<SearchAnalyticsResult> {
    const body = {
      startDate: input.start_date,
      endDate: input.end_date,
      dimensions: input.dimensions,
      type: input.search_type,
      aggregationType: input.aggregation_type,
      dataState: input.data_state,
      rowLimit: input.row_limit,
      startRow: input.start_row,
      dimensionFilterGroups:
        input.filters.length > 0
          ? [
              {
                groupType: "and",
                filters: input.filters.map((filter) => ({
                  dimension: filter.dimension,
                  operator: filter.operator,
                  expression: filter.expression,
                })),
              },
            ]
          : undefined,
    };

    const data = await this.request<{
      rows?: SearchAnalyticsRow[];
      responseAggregationType?: string;
      metadata?: {
        first_incomplete_date?: string;
        first_incomplete_hour?: string;
      };
    }>(
      `${WEBMASTERS_V3_BASE}/sites/${encodeURIComponent(input.site_url)}/searchAnalytics/query`,
      {
        method: "POST",
        body: JSON.stringify(body),
      },
    );

    const rows = (data.rows ?? []).map((row) =>
      mapAnalyticsRow(row, input.dimensions),
    );
    const rowCount = rows.length;
    const nextStartRow = input.start_row + rowCount;
    const hasMore =
      rowCount === input.row_limit &&
      nextStartRow < SEARCH_ANALYTICS_MAX_ROW_LIMIT;
    const stopReason =
      rowCount === 0
        ? "empty_page"
        : hasMore
          ? "row_limit"
          : nextStartRow >= SEARCH_ANALYTICS_MAX_ROW_LIMIT
            ? "daily_cap"
            : null;

    return {
      site_url: input.site_url,
      start_date: input.start_date,
      end_date: input.end_date,
      dimensions: input.dimensions,
      search_type: input.search_type,
      data_state: input.data_state,
      aggregation_type: input.aggregation_type,
      start_row: input.start_row,
      row_limit: input.row_limit,
      row_count: rowCount,
      has_more: hasMore,
      next_start_row: hasMore ? nextStartRow : null,
      stop_reason: stopReason,
      metadata: data.metadata,
      response_aggregation_type: data.responseAggregationType,
      disclosure:
        "Top rows sorted by clicks, not guaranteed exhaustive. Missing dates are omitted.",
      rows,
    };
  }

  async inspectUrl(
    siteUrl: string,
    inspectionUrl: string,
    languageCode: string,
  ): Promise<JsonObject> {
    assertInspectionUrlUnderSite(siteUrl, inspectionUrl);
    const data = await this.request<{
      inspectionResult?: JsonObject;
    }>(`${URL_INSPECTION_BASE}/urlInspection/index:inspect`, {
      method: "POST",
      body: JSON.stringify({
        inspectionUrl,
        siteUrl,
        languageCode,
      }),
    });
    return {
      site_url: siteUrl,
      inspection_url: inspectionUrl,
      disclosure:
        "Indexed snapshot only. Does not request indexing or perform a live crawl test.",
      inspection_result: data.inspectionResult ?? {},
    };
  }

  async batchInspectUrls(
    siteUrl: string,
    inspectionUrls: string[],
    languageCode: string,
  ): Promise<{
    site_url: string;
    count: number;
    results: JsonObject[];
  }> {
    const results = await mapWithConcurrency(inspectionUrls, 3, async (url) =>
      this.inspectUrl(siteUrl, url, languageCode),
    );
    return { site_url: siteUrl, count: results.length, results };
  }

  async listSitemaps(
    siteUrl: string,
    sitemapIndex?: string,
  ): Promise<JsonObject> {
    const query = sitemapIndex
      ? `?sitemapIndex=${encodeURIComponent(sitemapIndex)}`
      : "";
    const data = await this.request<{ sitemap?: JsonValue[] }>(
      `${WEBMASTERS_V3_BASE}/sites/${encodeURIComponent(siteUrl)}/sitemaps${query}`,
    );
    return {
      site_url: siteUrl,
      count: data.sitemap?.length ?? 0,
      sitemaps: data.sitemap ?? [],
    };
  }

  async getSitemap(
    siteUrl: string,
    feedpath: string,
  ): Promise<JsonObject> {
    const data = await this.request<JsonObject>(
      `${WEBMASTERS_V3_BASE}/sites/${encodeURIComponent(siteUrl)}/sitemaps/${encodeURIComponent(feedpath)}`,
    );
    return { site_url: siteUrl, feedpath, ...data };
  }

  async submitSitemap(
    siteUrl: string,
    feedpath: string,
  ): Promise<{
    ok: true;
    site_url: string;
    feedpath: string;
    message: string;
  }> {
    await this.request<void>(
      `${WEBMASTERS_V3_BASE}/sites/${encodeURIComponent(siteUrl)}/sitemaps/${encodeURIComponent(feedpath)}`,
      { method: "PUT" },
    );
    return {
      ok: true,
      site_url: siteUrl,
      feedpath,
      message:
        "Sitemap submitted to Search Console. Submission does not guarantee crawling or indexing.",
    };
  }

  async deleteSitemap(
    siteUrl: string,
    feedpath: string,
  ): Promise<{
    ok: true;
    site_url: string;
    feedpath: string;
    message: string;
  }> {
    await this.request<void>(
      `${WEBMASTERS_V3_BASE}/sites/${encodeURIComponent(siteUrl)}/sitemaps/${encodeURIComponent(feedpath)}`,
      { method: "DELETE" },
    );
    return {
      ok: true,
      site_url: siteUrl,
      feedpath,
      message:
        "Sitemap submission removed from Search Console. URLs are not removed from Google index.",
    };
  }

  async addSite(siteUrl: string): Promise<{
    ok: true;
    site_url: string;
    message: string;
  }> {
    await this.request<void>(
      `${WEBMASTERS_V3_BASE}/sites/${encodeURIComponent(siteUrl)}`,
      { method: "PUT" },
    );
    return {
      ok: true,
      site_url: siteUrl,
      message:
        "Property added to your Search Console account. This does not verify ownership.",
    };
  }

  async deleteSite(siteUrl: string): Promise<{
    ok: true;
    site_url: string;
    message: string;
  }> {
    await this.request<void>(
      `${WEBMASTERS_V3_BASE}/sites/${encodeURIComponent(siteUrl)}`,
      { method: "DELETE" },
    );
    return {
      ok: true,
      site_url: siteUrl,
      message:
        "Property removed from your Search Console account. This does not delete the website.",
    };
  }

  private async request<T>(url: string, init: RequestInit = {}): Promise<T> {
    return withRetry(async () => {
      const token = await this.credentials.getAccessToken();
      const response = await fetch(url, {
        ...init,
        headers: Object.assign(
          {},
          {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
          init.body ? { "Content-Type": "application/json" } : {},
          {
            ...(init.headers ?? {}),
          },
        ),
        signal: init.signal ?? AbortSignal.timeout(30_000),
      });
      if (!response.ok) {
        throw await parseGoogleError(response);
      }
      if (response.status === 204) {
        // SAFETY: Callers requesting void use endpoints whose 204 body is empty.
        return undefined as T;
      }
      // SAFETY: Each request call supplies the documented Google response type.
      return (await response.json()) as T;
    });
  }
}

function mapAnalyticsRow(
  row: SearchAnalyticsRow,
  dimensions: string[],
): SearchAnalyticsResult["rows"][number] {
  const keys: Record<string, string> = {};
  (row.keys ?? []).forEach((value, index) => {
    const dimension = dimensions[index];
    if (dimension) {
      keys[dimension] = value;
    }
  });
  return {
    keys,
    clicks: row.clicks ?? 0,
    impressions: row.impressions ?? 0,
    ctr: row.ctr ?? 0,
    position: row.position ?? 0,
  };
}
