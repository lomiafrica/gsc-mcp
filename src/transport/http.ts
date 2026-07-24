import express from 'express';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import {
  hostHeaderValidation,
  localhostHostValidation,
} from '@modelcontextprotocol/sdk/server/middleware/hostHeaderValidation.js';

import { createCredentialContext } from '../auth/credential-provider.js';
import {
  allowedHosts,
  allowedOrigins,
  httpBasePath,
  httpListenPort,
  listenHost,
  maxBodyBytes,
  rateLimitRpm,
} from '../env-config.js';
import { buildGscServer } from '../server.js';
import { requireHttpClientAuth } from './client-auth.js';

type RateBucket = { count: number; windowStart: number };
const buckets = new Map<string, RateBucket>();

export async function startHttpServer(): Promise<void> {
  const credentials = await createCredentialContext();
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: maxBodyBytes() }));

  const hosts = allowedHosts();
  if (hosts && hosts.length > 0) {
    app.use(hostHeaderValidation(hosts));
  } else {
    app.use(localhostHostValidation);
  }

  const origins = allowedOrigins();
  if (origins.length > 0) {
    app.use((req, res, next) => {
      const origin = req.headers.origin;
      if (origin && origins.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Vary', 'Origin');
        res.setHeader(
          'Access-Control-Allow-Headers',
          'Content-Type, Authorization, Mcp-Session-Id, Mcp-Protocol-Version',
        );
        res.setHeader(
          'Access-Control-Expose-Headers',
          'Mcp-Session-Id, WWW-Authenticate, Mcp-Protocol-Version',
        );
        if (req.method === 'OPTIONS') {
          res.status(204).end();
          return;
        }
      }
      next();
    });
  }

  app.get('/healthz', (_req, res) => {
    res.json({ ok: true });
  });

  app.get('/readyz', (_req, res) => {
    res.json({ ok: true, auth_mode: credentials.mode });
  });

  const basePath = httpBasePath();
  app.post(basePath, requireHttpClientAuth, rateLimit, async (req, res) => {
    const server = buildGscServer(credentials);
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
    await server.close();
  });

  app.get(basePath, (_req, res) => {
    res.status(405).json({ error: 'GET not supported in stateless mode' });
  });

  app.delete(basePath, (_req, res) => {
    res.status(405).json({ error: 'DELETE not supported in stateless mode' });
  });

  const host = listenHost();
  const port = httpListenPort();
  app.listen(port, host, () => {
    console.error(`lomi-gsc-mcp HTTP listening on http://${host}:${port}${basePath}`);
  });
}

function rateLimit(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
): void {
  const limit = rateLimitRpm();
  if (limit <= 0) {
    next();
    return;
  }
  const key = req.ip ?? 'unknown';
  const now = Date.now();
  const bucket = buckets.get(key) ?? { count: 0, windowStart: now };
  if (now - bucket.windowStart >= 60_000) {
    bucket.count = 0;
    bucket.windowStart = now;
  }
  bucket.count += 1;
  buckets.set(key, bucket);
  if (bucket.count > limit) {
    res.status(429).json({ error: 'Rate limit exceeded' });
    return;
  }
  next();
}
