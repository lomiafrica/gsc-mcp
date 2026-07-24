import { timingSafeEqual } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

import { clientBearerToken, isLoopbackHost } from '../env-config.js';

export function requireHttpClientAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const host = req.hostname;
  if (isLoopbackHost(host)) {
    next();
    return;
  }

  const expected = clientBearerToken();
  if (!expected) {
    res.status(503).json({
      error: 'HTTP client authentication is not configured',
    });
    return;
  }

  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.setHeader(
      'WWW-Authenticate',
      'Bearer realm="lomi-gsc-mcp", error="invalid_token"',
    );
    res.status(401).json({ error: 'Missing bearer token' });
    return;
  }

  const presented = header.slice('Bearer '.length);
  const presentedBuf = Buffer.from(presented);
  const expectedBuf = Buffer.from(expected);
  if (
    presentedBuf.length !== expectedBuf.length ||
    !timingSafeEqual(presentedBuf, expectedBuf)
  ) {
    res.status(401).json({ error: 'Invalid bearer token' });
    return;
  }

  next();
}
