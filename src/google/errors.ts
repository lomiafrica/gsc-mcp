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

interface GoogleErrorBody {
  error?: {
    message?: string;
    errors?: Array<{ reason?: string; message?: string }>;
  };
}

const QUOTA_PROJECT_HINT =
  ' Set GOOGLE_CLOUD_QUOTA_PROJECT to a GCP project with the Search Console API enabled.';

function withQuotaHint(message: string): string {
  if (
    /quota project|searchconsole\.googleapis\.com API requires|SERVICE_DISABLED/i.test(
      message,
    )
  ) {
    return `${message}${QUOTA_PROJECT_HINT}`;
  }
  return message;
}

export function sanitizeClientError(error: Error | string): string {
  if (error instanceof GscApiError) {
    return withQuotaHint(error.message);
  }
  if (error instanceof Error) {
    return withQuotaHint(error.message.replace(/\/Users\/[^\s]+/g, '<path>'));
  }
  return withQuotaHint(error);
}

export async function parseGoogleError(response: Response): Promise<GscApiError> {
  let reason: string | undefined;
  let message = `Google Search Console API error (${response.status})`;

  try {
    // SAFETY: Optional Google error fields are read defensively below.
    const body = (await response.json()) as GoogleErrorBody;
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
