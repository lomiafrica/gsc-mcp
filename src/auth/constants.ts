import { homedir } from 'node:os';
import { join } from 'node:path';

export const GSC_READONLY_SCOPE =
  'https://www.googleapis.com/auth/webmasters.readonly' as const;
export const GSC_WRITE_SCOPE = 'https://www.googleapis.com/auth/webmasters' as const;

export function configDir(): string {
  const xdg = process.env.XDG_CONFIG_HOME?.trim();
  if (xdg) {
    return join(xdg, 'lomi-gsc-mcp');
  }
  return join(homedir(), '.config', 'lomi-gsc-mcp');
}

export function oauthClientPath(): string {
  return (
    process.env.GSC_OAUTH_CLIENT_FILE?.trim() ||
    join(configDir(), 'oauth_credentials.json')
  );
}

export function oauthTokenPath(): string {
  return join(configDir(), 'token.json');
}

export function requestedOAuthScopes(): string[] {
  const mode = (process.env.GSC_OAUTH_SCOPE ?? 'readonly').toLowerCase();
  if (mode === 'write' || mode === 'full') {
    return [GSC_WRITE_SCOPE];
  }
  return [GSC_READONLY_SCOPE];
}

export function writesEnabled(): boolean {
  return process.env.GSC_ENABLE_WRITES?.trim().toLowerCase() === 'true';
}
