export function maxResultRows(): number {
  const raw = process.env.GSC_MCP_MAX_RESULT_ROWS?.trim();
  const parsed = raw ? Number(raw) : 5000;
  if (!Number.isFinite(parsed) || parsed < 1) {
    return 5000;
  }
  return Math.min(parsed, 25_000);
}

export type McpTransportMode = 'stdio' | 'http';

export function getTransportMode(): McpTransportMode {
  const mode = (process.env.GSC_MCP_TRANSPORT ?? 'stdio').toLowerCase();
  if (mode === 'http' || mode === 'stdio') {
    return mode;
  }
  throw new Error('GSC_MCP_TRANSPORT must be "stdio" or "http"');
}

export function httpListenPort(): number {
  const raw = process.env.PORT ?? process.env.GSC_MCP_HTTP_PORT ?? '3344';
  const port = Number(raw);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error('Invalid GSC_MCP_HTTP_PORT');
  }
  return port;
}

export function httpBasePath(): string {
  const raw = process.env.GSC_MCP_HTTP_PATH?.trim() || '/mcp';
  return raw.startsWith('/') ? raw : `/${raw}`;
}

export function listenHost(): string {
  return process.env.GSC_MCP_HTTP_HOST?.trim() || '0.0.0.0';
}

export function allowedHosts(): string[] | undefined {
  const raw = process.env.GSC_MCP_ALLOWED_HOSTS?.trim();
  if (!raw) {
    return undefined;
  }
  return raw.split(',').map((value) => value.trim()).filter(Boolean);
}

export function allowedOrigins(): string[] {
  const raw = process.env.GSC_MCP_ALLOWED_ORIGINS?.trim();
  if (!raw) {
    return [];
  }
  return raw.split(',').map((value) => value.trim()).filter(Boolean);
}

export function clientBearerToken(): string | null {
  const raw = process.env.GSC_MCP_CLIENT_BEARER_TOKEN?.trim();
  return raw || null;
}

export function rateLimitRpm(): number {
  const raw = process.env.GSC_MCP_RATE_LIMIT_RPM?.trim();
  const parsed = raw ? Number(raw) : 120;
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 120;
}

export function maxBodyBytes(): number {
  const raw = process.env.GSC_MCP_MAX_BODY_BYTES?.trim();
  const parsed = raw ? Number(raw) : 1024 * 1024;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1024 * 1024;
}

export function isLoopbackHost(host: string): boolean {
  return host === '127.0.0.1' || host === 'localhost' || host === '::1';
}
