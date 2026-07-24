#!/usr/bin/env node
process.env.GSC_MCP_TRANSPORT = 'http';
await import('./index.js');
