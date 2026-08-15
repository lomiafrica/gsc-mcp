import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import type { CredentialContext } from "../auth/credential-provider.js";
import { mutationToolsEnabled } from "../auth/credential-provider.js";
import { SearchConsoleClient } from "../google/search-console-client.js";
import {
  addSiteInputSchema,
  deleteSiteInputSchema,
  deleteSitemapInputSchema,
  submitSitemapInputSchema,
} from "../google/schemas.js";
import { sanitizeClientError } from "../google/errors.js";
import { toolError, toolSuccess } from "./structured-result.js";

export function registerWriteTools(
  server: McpServer,
  credentials: CredentialContext,
): void {
  if (!mutationToolsEnabled(credentials)) {
    return;
  }

  const client = new SearchConsoleClient(credentials);

  server.registerTool(
    "gsc_submit_sitemap",
    {
      title: "Submit sitemap",
      description:
        "Submit a sitemap URL to Search Console. Requires write scope and GSC_ENABLE_WRITES=true.",
      inputSchema: submitSitemapInputSchema["shape"],
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (input) =>
      safe(() => client.submitSitemap(input.site_url, input.feedpath)),
  );

  server.registerTool(
    "gsc_delete_sitemap",
    {
      title: "Delete sitemap submission",
      description:
        "Remove a sitemap submission from Search Console. Requires confirm=true.",
      inputSchema: deleteSitemapInputSchema["shape"],
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (input) =>
      safe(() => client.deleteSitemap(input.site_url, input.feedpath)),
  );

  server.registerTool(
    "gsc_add_property",
    {
      title: "Add Search Console property",
      description:
        "Add a property to the authenticated Search Console account. Does not verify ownership.",
      inputSchema: addSiteInputSchema["shape"],
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (input) => safe(() => client.addSite(input.site_url)),
  );

  server.registerTool(
    "gsc_delete_property",
    {
      title: "Remove Search Console property",
      description:
        "Remove a property from the authenticated Search Console account. Requires confirm=true.",
      inputSchema: deleteSiteInputSchema["shape"],
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (input) => safe(() => client.deleteSite(input.site_url)),
  );
}

export const writeToolNames = [
  "gsc_submit_sitemap",
  "gsc_delete_sitemap",
  "gsc_add_property",
  "gsc_delete_property",
] as const;

async function safe<T extends object>(
  fn: () => Promise<T>,
): Promise<ReturnType<typeof toolSuccess<T>> | ReturnType<typeof toolError>> {
  try {
    return toolSuccess(await fn());
  } catch (error) {
    return toolError(
      sanitizeClientError(
        error instanceof Error ? error : "Unexpected Search Console error",
      ),
    );
  }
}
