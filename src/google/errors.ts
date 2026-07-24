export class GscApiError extends Error {
  readonly status: number;
  readonly reason?: string;
  readonly retryable: boolean;

  constructor(message: string, options: {
    status: number;
    reason?: string;
    retryable?: boolean;
  }) {
    super(message);
    this.name = 'GscApiError';
    this.status = options.status;
    this.reason = options.reason;
    this.retryable = options.retryable ?? false;
  }
}

export function sanitizeClientError(error: unknown): string {
  if (error instanceof GscApiError) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message.replace(/\/Users\/[^\s]+/g, '<path>');
  }
  return 'Unexpected Search Console error';
}

export async function parseGoogleError(response: Response): Promise<GscApiError> {
  let reason: string | undefined;
  let message = `Google Search Console API error (${response.status})`;

  try {
    const body = (await response.json()) as {
      error?: {
        message?: string;
        errors?: Array<{ reason?: string; message?: string }>;
      };
    };
    reason = body.error?.errors?.[0]?.reason;
    if (body.error?.message) {
      message = body.error.message;
    }
  } catch {
    // ignore parse failures
  }

  const retryable =
    response.status === 429 ||
    response.status >= 500 ||
    reason === 'rateLimitExceeded' ||
    reason === 'userRateLimitExceeded' ||
    reason === 'quotaExceeded' ||
    reason === 'backendError' ||
    reason === 'internalError';

  return new GscApiError(message, {
    status: response.status,
    reason,
    retryable,
  });
}
