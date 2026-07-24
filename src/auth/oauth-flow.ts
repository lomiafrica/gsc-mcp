import { createServer } from 'node:http';
import { createHash, randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';

import { CodeChallengeMethod, OAuth2Client } from 'google-auth-library';

import { oauthClientPath, requestedOAuthScopes } from './constants.js';
import { writeStoredToken } from './token-store.js';

type OAuthClientJson = {
  installed?: {
    client_id: string;
    client_secret: string;
  };
  web?: {
    client_id: string;
    client_secret: string;
  };
};

export async function loadOAuthClientConfig(): Promise<OAuth2Client> {
  const path = oauthClientPath();
  const raw = await readFile(path, 'utf8');
  const parsed = JSON.parse(raw) as OAuthClientJson;
  const config = parsed.installed ?? parsed.web;
  if (!config?.client_id || !config.client_secret) {
    throw new Error(
      'OAuth client file must contain installed or web credentials with client_id and client_secret',
    );
  }
  return new OAuth2Client(config.client_id, config.client_secret);
}

export async function runDesktopOAuthFlow(): Promise<void> {
  const client = await loadOAuthClientConfig();
  const state = randomBytes(16).toString('hex');
  const codeVerifier = randomBytes(32).toString('base64url');
  const scopes = requestedOAuthScopes();

  const { authCode, returnedState, redirectUri } =
    await authorizeViaLoopback(client, state, codeVerifier, scopes);

  if (returnedState !== state) {
    throw new Error('OAuth state mismatch');
  }

  const { tokens } = await client.getToken({
    code: authCode,
    redirect_uri: redirectUri,
    codeVerifier,
  });
  if (!tokens.refresh_token && !tokens.access_token) {
    throw new Error('Google did not return OAuth tokens');
  }
  await writeStoredToken(tokens);
  console.error('Google Search Console authorization complete.');
}

async function authorizeViaLoopback(
  client: OAuth2Client,
  state: string,
  codeVerifier: string,
  scopes: string[],
): Promise<{
  authCode: string;
  returnedState: string;
  redirectUri: string;
}> {
  return new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      try {
        const url = new URL(req.url ?? '/', 'http://127.0.0.1');
        const code = url.searchParams.get('code');
        const returnedState = url.searchParams.get('state') ?? '';
        if (!code) {
          res.writeHead(400, { 'Content-Type': 'text/plain' });
          res.end('Missing authorization code');
          return;
        }
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end('<h1>Authorization complete</h1><p>You can close this tab.</p>');
        const address = server.address();
        const port =
          address && typeof address !== 'string' ? address.port : undefined;
        server.close();
        resolve({
          authCode: code,
          returnedState,
          redirectUri: `http://127.0.0.1:${port}/callback`,
        });
      } catch (error) {
        reject(error);
      }
    });

    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        reject(new Error('Failed to bind loopback OAuth server'));
        return;
      }
      const redirectUri = `http://127.0.0.1:${address.port}/callback`;
      const authUrl = client.generateAuthUrl({
        access_type: 'offline',
        prompt: 'consent',
        scope: scopes,
        redirect_uri: redirectUri,
        state,
        code_challenge_method: CodeChallengeMethod.S256,
        code_challenge: createHash('sha256')
          .update(codeVerifier)
          .digest('base64url'),
      });
      console.error(`Open this URL in your browser:\n${authUrl}`);
    });
  });
}
