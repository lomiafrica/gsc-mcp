import { describe, expect, it } from "vitest";

import { buildCapabilityState } from "../auth/capabilities.js";
import type { CredentialContext } from "../auth/credential-provider.js";
import { mutationToolsEnabled } from "../auth/credential-provider.js";
import { GSC_READONLY_SCOPE } from "../auth/constants.js";
import { sanitizeClientError } from "../google/errors.js";
import {
  homepageFromSiteUrl,
  assertInspectionUrlUnderSite,
  inclusiveDateRange,
} from "../google/schemas.js";
import {
  resolvePortfolioSites,
  summarizeAnalytics,
  summarizeSitemaps,
} from "../google/portfolio.js";
import { readQuotaProjectFromAdcJson } from "../env-config.js";
import { toolSuccess } from "../tools/structured-result.js";

describe("schemas", () => {
  it("accepts inspection URLs under domain properties", () => {
    expect(() =>
      assertInspectionUrlUnderSite(
        "sc-domain:lomi.africa",
        "https://docs.lomi.africa/start/overview",
      ),
    ).not.toThrow();
  });

  it("rejects inspection URLs outside the property", () => {
    expect(() =>
      assertInspectionUrlUnderSite(
        "sc-domain:lomi.africa",
        "https://example.com/",
      ),
    ).toThrow();
  });

  it("builds inclusive date ranges", () => {
    const range = inclusiveDateRange(28);
    expect(range.startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(range.endDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("capabilities", () => {
  const readonlyContext: CredentialContext = {
    mode: "oauth",
    scopes: [GSC_READONLY_SCOPE],
    canWrite: false,
    quotaProject: "lomi-425000",
    getAccessToken: async () => "token",
  };

  it("disables mutation tools without write scope", () => {
    expect(mutationToolsEnabled(readonlyContext)).toBe(false);
    const state = buildCapabilityState(readonlyContext);
    expect(state.mutation_tools_enabled).toBe(false);
    expect(state.signed_in).toBe(true);
    expect(state.quota_project).toBe("lomi-425000");
    expect(state.search_analytics.disclosure).toContain("top rows");
  });
});

describe("portfolio helpers", () => {
  it("derives https homepages from domain properties", () => {
    expect(homepageFromSiteUrl("sc-domain:userill.com")).toBe(
      "https://userill.com/",
    );
  });

  it("prefers explicit sites, then env, then every accessible property", () => {
    const previous = process.env.GSC_PORTFOLIO_SITES;
    process.env.GSC_PORTFOLIO_SITES =
      "sc-domain:lomi.africa, sc-domain:beecargo.net";
    expect(
      resolvePortfolioSites(
        ["sc-domain:userill.com"],
        ["sc-domain:lomi.africa"],
      ),
    ).toEqual(["sc-domain:userill.com"]);
    expect(resolvePortfolioSites(undefined, ["sc-domain:other.com"])).toEqual([
      "sc-domain:lomi.africa",
      "sc-domain:beecargo.net",
    ]);
    delete process.env.GSC_PORTFOLIO_SITES;
    expect(
      resolvePortfolioSites(undefined, ["sc-domain:a.com", "sc-domain:a.com"]),
    ).toEqual(["sc-domain:a.com"]);
    if (previous === undefined) {
      delete process.env.GSC_PORTFOLIO_SITES;
    } else {
      process.env.GSC_PORTFOLIO_SITES = previous;
    }
  });

  it("summarizes sitemap warnings without treating indexed as health", () => {
    const summary = summarizeSitemaps([
      {
        path: "https://docs.lomi.africa/sitemap.xml",
        errors: "0",
        warnings: "102",
        contents: [{ type: "web", submitted: "212", indexed: "0" }],
      },
    ]);
    expect(summary.warning_count).toBe(102);
    expect(summary.feeds[0]?.submitted).toBe(212);
    expect(summary.feeds[0]).not.toHaveProperty("indexed");
  });

  it("weights position by impressions", () => {
    expect(
      summarizeAnalytics([
        { clicks: 1, impressions: 10, ctr: 0.1, position: 4 },
        { clicks: 1, impressions: 30, ctr: 0.03, position: 8 },
      ]),
    ).toMatchObject({
      clicks: 2,
      impressions: 40,
      position: 7,
    });
  });
});

describe("quota project", () => {
  it("reads quota_project_id from ADC JSON", () => {
    expect(
      readQuotaProjectFromAdcJson(
        '{"type":"authorized_user","quota_project_id":"lomi-425000"}',
      ),
    ).toBe("lomi-425000");
  });

  it("hints when Google asks for a quota project", () => {
    expect(
      sanitizeClientError(
        "The searchconsole.googleapis.com API requires a quota project, which is not set by default.",
      ),
    ).toContain("GOOGLE_CLOUD_QUOTA_PROJECT");
  });
});

describe("structured results", () => {
  it("truncates oversized row arrays", () => {
    process.env.GSC_MCP_MAX_RESULT_ROWS = "2";
    const result = toolSuccess({
      rows: [{ a: 1 }, { a: 2 }, { a: 3 }],
    });
    expect(
      "truncated" in result.structuredContent &&
        result.structuredContent.truncated,
    ).toBe(true);
    expect(result.structuredContent.rows).toHaveLength(2);
    delete process.env.GSC_MCP_MAX_RESULT_ROWS;
  });
});
