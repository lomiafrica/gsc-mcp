#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import { createCredentialContextOrPlaceholder } from './auth/credential-provider.js';
import { runDesktopOAuthFlow } from './auth/oauth-flow.js';
import { getTransportMode } from './env-config.js';
import { buildGscServer } from './server.js';
import { startHttpServer } from './transport/http.js';

async function main(): Promise<void> {
  const command = process.argv[2];
  if (command === 'auth') {
    await runDesktopOAuthFlow();
    return;
  }

  if (getTransportMode() === 'http') {
    await startHttpServer();
    return;
  }

  const credentials = await createCredentialContextOrPlaceholder();
  const server = buildGscServer(credentials);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
