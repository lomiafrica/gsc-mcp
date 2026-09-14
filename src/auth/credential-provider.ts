import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

import { GoogleAuth, OAuth2Client, type JWTInput } from "google-auth-library";

import {
  quotaProjectFromEnv,
  readQuotaProjectFromAdcJson,
} from "../env-config.js";
import {
  GSC_READONLY_SCOPE,
  GSC_WRITE_SCOPE,
  requestedOAuthScopes,
  writesEnabled,
} from "./constants.js";
import { loadOAuthClientConfig } from "./oauth-flow.js";
import { readStoredToken } from "./token-store.js";

export type CredentialMode =
  | "oauth"
  | "service_account"
  | "application_default";

export type CredentialContext = {
  mode: CredentialMode;
  scopes: string[];
  canWrite: boolean;
  quotaProject: string | null;
  getAccessToken: () => Promise<string>;
};

export async function createCredentialContext(): Promise<CredentialContext> {
  const serviceAccount = await loadServiceAccountCredentials();
  if (serviceAccount) {
    const scopes = serviceAccountScopes();
    const auth = new GoogleAuth({
      credentials: serviceAccount,
      scopes,
    });
    const client = await auth.getClient();
    return attachQuota({
      mode: "service_account",
      scopes,
      canWrite: scopes.includes(GSC_WRITE_SCOPE),
      getAccessToken: async () => {
        const token = await client.getAccessToken();
        if (!token.token) {
          throw new Error("Failed to obtain Google access token");
        }
        return token.token;
      },
    });
  }

  const oauthClient = await loadOAuthClient();
  if (oauthClient) {
    const scopes = requestedOAuthScopes();
    return attachQuota({
      mode: "oauth",
      scopes,
      canWrite: scopes.includes(GSC_WRITE_SCOPE),
      getAccessToken: async () => {
        const headers = await oauthClient.getRequestHeaders();
        const authHeader = headers.get("Authorization");
        if (!authHeader?.startsWith("Bearer ")) {
          throw new Error("Failed to obtain Google access token");
        }
        return authHeader.slice("Bearer ".length);
      },
    });
  }

  const auth = new GoogleAuth({ scopes: requestedOAuthScopes() });
  const client = await auth.getClient();
  const scopes = requestedOAuthScopes();
  return attachQuota({
    mode: "application_default",
    scopes,
    canWrite: scopes.includes(GSC_WRITE_SCOPE),
    getAccessToken: async () => {
      const token = await client.getAccessToken();
      if (!token.token) {
        throw new Error("Failed to obtain Google access token");
      }
      return token.token;
    },
  });
}

async function loadOAuthClient(): Promise<OAuth2Client | null> {
  try {
    const client = await loadOAuthClientConfig();
    const token = await readStoredToken();
    if (!token) {
      return null;
    }
    client.setCredentials(token);
    return client;
  } catch {
    return null;
  }
}

async function loadServiceAccountCredentials(): Promise<JWTInput | null> {
  const inline = process.env.GSC_SERVICE_ACCOUNT_KEY?.trim();
  if (inline) {
    // SAFETY: GoogleAuth validates the parsed credential fields before use.
    return JSON.parse(inline) as JWTInput;
  }
  const path = process.env.GSC_SERVICE_ACCOUNT_KEY_FILE?.trim();
  if (!path) {
    return null;
  }
  const raw = await readFile(path, "utf8");
  // SAFETY: GoogleAuth validates the parsed credential fields before use.
  return JSON.parse(raw) as JWTInput;
}

function serviceAccountScopes(): string[] {
  if (writesEnabled()) {
    return [GSC_WRITE_SCOPE];
  }
  return [GSC_READONLY_SCOPE];
}

export function mutationToolsEnabled(context: CredentialContext): boolean {
  return writesEnabled() && context.canWrite;
}

export const AUTH_SETUP_HINT =
  "Google Search Console is not signed in. Run gcloud auth application-default login --scopes=https://www.googleapis.com/auth/cloud-platform,https://www.googleapis.com/auth/webmasters.readonly and set GOOGLE_CLOUD_QUOTA_PROJECT to a GCP project with the Search Console API enabled. Cursor Connect only reconnects this local server; it does not sign in to Google. Or place a Desktop OAuth client JSON at ~/.config/lomi-gsc-mcp/oauth_credentials.json and run: npx @lomi./gsc-mcp auth";

export function createUnauthenticatedContext(
  cause: Error | string,
): CredentialContext {
  const detail = cause instanceof Error ? cause.message : String(cause);
  return {
    mode: "oauth",
    scopes: [],
    canWrite: false,
    quotaProject: quotaProjectFromEnv(),
    getAccessToken: async () => {
      throw new Error(`${AUTH_SETUP_HINT} (${detail})`);
    },
  };
}

async function resolveQuotaProject(): Promise<string | null> {
  const fromEnv = quotaProjectFromEnv();
  if (fromEnv) {
    return fromEnv;
  }
  const path =
    process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim() ||
    join(
      homedir(),
      ".config",
      "gcloud",
      "application_default_credentials.json",
    );
  try {
    const raw = await readFile(path, "utf8");
    return readQuotaProjectFromAdcJson(raw);
  } catch {
    return null;
  }
}

async function attachQuota(
  context: Omit<CredentialContext, "quotaProject">,
): Promise<CredentialContext> {
  return {
    ...context,
    quotaProject: await resolveQuotaProject(),
  };
}

export async function createCredentialContextOrPlaceholder(): Promise<CredentialContext> {
  try {
    return await createCredentialContext();
  } catch (error) {
    return createUnauthenticatedContext(
      error instanceof Error ? error : "Unknown authentication error",
    );
  }
}
