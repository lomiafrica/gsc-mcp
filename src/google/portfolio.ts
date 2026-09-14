import { portfolioSites } from "../env-config.js";
import { isJsonObject, readString, type JsonValue } from "@lomi./shared";
import { mapWithConcurrency } from "./retry.js";
import {
  homepageFromSiteUrl,
  inclusiveDateRange,
  type PortfolioHealthInput,
} from "./schemas.js";
import type { SearchConsoleClient } from "./search-console-client.js";

const SITEMAP_INDEXED_DISCLOSURE =
  "Sitemap contents.indexed is often 0 even when pages are indexed. Use homepage inspection, not that field.";

type SitemapSummary = {
  path: string;
  errors: number;
  warnings: number;
  submitted: number;
};

export type PortfolioPropertyHealth = {
  site_url: string;
  permission_level?: string;
  homepage: string;
  totals: {
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
    days_with_data: number;
  };
  sitemaps: {
    count: number;
    error_count: number;
    warning_count: number;
    feeds: SitemapSummary[];
  };
  homepage_inspection?: {
    verdict?: string;
    coverage_state?: string;
    last_crawl_time?: string;
    page_fetch_state?: string;
    google_canonical?: string;
  };
  error?: string;
};

export async function runPortfolioHealth(
  client: SearchConsoleClient,
  input: PortfolioHealthInput,
): Promise<{
  date_range: { startDate: string; endDate: string };
  count: number;
  properties: PortfolioPropertyHealth[];
  disclosure: string;
}> {
  const listed = await client.listSites();
  const requested = resolvePortfolioSites(
    input.site_urls,
    listed.properties.map((property) => property.site_url),
  );
  const permissionBySite = new Map(
    listed.properties.map((property) => [
      property.site_url,
      property.permission_level,
    ]),
  );
  const range = inclusiveDateRange(input.days);
  const properties = await mapWithConcurrency(requested, 3, async (siteUrl) =>
    inspectProperty(
      client,
      siteUrl,
      permissionBySite.get(siteUrl),
      range,
      input.inspect_homepages,
    ),
  );
  return {
    date_range: range,
    count: properties.length,
    properties,
    disclosure: SITEMAP_INDEXED_DISCLOSURE,
  };
}

export function resolvePortfolioSites(
  siteUrls: string[] | undefined,
  accessible: string[],
): string[] {
  const fromInput = (siteUrls ?? []).filter(Boolean);
  if (fromInput.length > 0) {
    return uniqueSites(fromInput);
  }
  const fromEnv = portfolioSites();
  if (fromEnv.length > 0) {
    return uniqueSites(fromEnv);
  }
  return uniqueSites(accessible);
}

function uniqueSites(siteUrls: string[]): string[] {
  return [...new Set(siteUrls)];
}

async function inspectProperty(
  client: SearchConsoleClient,
  siteUrl: string,
  permissionLevel: string | undefined,
  range: { startDate: string; endDate: string },
  inspectHomepage: boolean,
): Promise<PortfolioPropertyHealth> {
  const homepage = homepageFromSiteUrl(siteUrl);
  try {
    const [sitemaps, analytics, inspection] = await Promise.all([
      client.listSitemaps(siteUrl),
      client.searchAnalytics({
        site_url: siteUrl,
        start_date: range.startDate,
        end_date: range.endDate,
        dimensions: ["date"],
        search_type: "web",
        aggregation_type: "auto",
        data_state: "all",
        row_limit: 1000,
        start_row: 0,
        filters: [],
      }),
      inspectHomepage
        ? client.inspectUrl(siteUrl, homepage, "en-US")
        : Promise.resolve(undefined),
    ]);
    return {
      site_url: siteUrl,
      permission_level: permissionLevel,
      homepage,
      totals: summarizeAnalytics(analytics.rows),
      sitemaps: summarizeSitemaps(sitemaps.sitemaps),
      homepage_inspection: inspection
        ? readHomepageInspection(inspection.inspection_result)
        : undefined,
    };
  } catch (error) {
    return {
      site_url: siteUrl,
      permission_level: permissionLevel,
      homepage,
      totals: {
        clicks: 0,
        impressions: 0,
        ctr: 0,
        position: 0,
        days_with_data: 0,
      },
      sitemaps: {
        count: 0,
        error_count: 0,
        warning_count: 0,
        feeds: [],
      },
      error:
        error instanceof Error
          ? error.message
          : "Unexpected Search Console error",
    };
  }
}

export function summarizeAnalytics(
  rows: Array<{
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
  }>,
): PortfolioPropertyHealth["totals"] {
  if (rows.length === 0) {
    return {
      clicks: 0,
      impressions: 0,
      ctr: 0,
      position: 0,
      days_with_data: 0,
    };
  }
  const clicks = rows.reduce((sum, row) => sum + row.clicks, 0);
  const impressions = rows.reduce((sum, row) => sum + row.impressions, 0);
  const weightedPosition = rows.reduce(
    (sum, row) => sum + row.position * row.impressions,
    0,
  );
  return {
    clicks,
    impressions,
    ctr: impressions > 0 ? clicks / impressions : 0,
    position: impressions > 0 ? weightedPosition / impressions : 0,
    days_with_data: rows.length,
  };
}

export function summarizeSitemaps(
  sitemaps: JsonValue,
): PortfolioPropertyHealth["sitemaps"] {
  const feeds = Array.isArray(sitemaps)
    ? sitemaps.flatMap((entry) => {
        if (!isJsonObject(entry)) {
          return [];
        }
        const path = readString(entry, "path") ?? "";
        const errors = Number(entry.errors ?? 0);
        const warnings = Number(entry.warnings ?? 0);
        const contents = Array.isArray(entry.contents) ? entry.contents : [];
        const submitted = contents.reduce((sum: number, item: JsonValue) => {
          if (!isJsonObject(item)) {
            return sum;
          }
          return sum + Number(item.submitted ?? 0);
        }, 0);
        return [
          {
            path,
            errors: Number.isFinite(errors) ? errors : 0,
            warnings: Number.isFinite(warnings) ? warnings : 0,
            submitted,
          },
        ];
      })
    : [];
  return {
    count: feeds.length,
    error_count: feeds.reduce((sum, feed) => sum + feed.errors, 0),
    warning_count: feeds.reduce((sum, feed) => sum + feed.warnings, 0),
    feeds,
  };
}

function readHomepageInspection(
  inspectionResult: JsonValue,
): PortfolioPropertyHealth["homepage_inspection"] {
  if (!isJsonObject(inspectionResult)) {
    return undefined;
  }
  const indexStatus = inspectionResult.indexStatusResult;
  if (!isJsonObject(indexStatus)) {
    return undefined;
  }
  return {
    verdict: readString(indexStatus, "verdict"),
    coverage_state: readString(indexStatus, "coverageState"),
    last_crawl_time: readString(indexStatus, "lastCrawlTime"),
    page_fetch_state: readString(indexStatus, "pageFetchState"),
    google_canonical: readString(indexStatus, "googleCanonical"),
  };
}
