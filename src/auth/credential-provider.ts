import { readFile } from 'node:fs/promises';

import {
  GoogleAuth,
  OAuth2Client,
  type JWTInput,
} from 'google-auth-library';

import {
  GSC_READONLY_SCOPE,
  GSC_WRITE_SCOPE,
  requestedOAuthScopes,
  writesEnabled,
} from './constants.js';
import { loadOAuthClientConfig } from './oauth-flow.js';
import { readStoredToken } from './token-store.js';

export type CredentialMode =
  | 'oauth'
  | 'service_account'
  | 'application_default';

export type CredentialContext = {
  mode: CredentialMode;
  scopes: string[];
  canWrite: boolean;
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
    return {
      mode: 'service_account',
      scopes,
      canWrite: scopes.includes(GSC_WRITE_SCOPE),
      getAccessToken: async () => {
        const token = await client.getAccessToken();
        if (!token.token) {
          throw new Error('Failed to obtain Google access token');
        }
        return token.token;
      },
    };
  }

  const oauthClient = await loadOAuthClient();
  if (oauthClient) {
    const scopes = requestedOAuthScopes();
    return {
      mode: 'oauth',
      scopes,
      canWrite: scopes.includes(GSC_WRITE_SCOPE),
      getAccessToken: async () => {
        const headers = await oauthClient.getRequestHeaders();
        const authHeader =
          typeof headers.get === 'function'
            ? headers.get('Authorization')
            : (headers as { Authorization?: string }).Authorization;
        if (!authHeader?.startsWith('Bearer ')) {
          throw new Error('Failed to obtain Google access token');
        }
        return authHeader.slice('Bearer '.length);
      },
    };
  }

  const auth = new GoogleAuth({ scopes: requestedOAuthScopes() });
  const client = await auth.getClient();
  const scopes = requestedOAuthScopes();
  return {
    mode: 'application_default',
    scopes,
    canWrite: scopes.includes(GSC_WRITE_SCOPE),
    getAccessToken: async () => {
      const token = await client.getAccessToken();
      if (!token.token) {
        throw new Error('Failed to obtain Google access token');
      }
      return token.token;
    },
  };
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
    return JSON.parse(inline) as JWTInput;
  }
  const path = process.env.GSC_SERVICE_ACCOUNT_KEY_FILE?.trim();
  if (!path) {
    return null;
  }
  const raw = await readFile(path, 'utf8');
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

const AUTH_SETUP_HINT =
  'Place a Google OAuth desktop client JSON at ~/.config/lomi-gsc-mcp/oauth_credentials.json, then run: npx @lomi./gsc-mcp auth';

export function createUnauthenticatedContext(cause: unknown): CredentialContext {
  const detail = cause instanceof Error ? cause.message : String(cause);
  return {
    mode: 'oauth',
    scopes: [],
    canWrite: false,
    getAccessToken: async () => {
      throw new Error(`Google Search Console is not authenticated (${detail}). ${AUTH_SETUP_HINT}`);
    },
  };
}

export async function createCredentialContextOrPlaceholder(): Promise<CredentialContext> {
  try {
    return await createCredentialContext();
  } catch (error) {
    return createUnauthenticatedContext(error);
  }
}
