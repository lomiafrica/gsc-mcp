import { GscApiError } from './errors.js';

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: {
    maxAttempts?: number;
    baseDelayMs?: number;
    signal?: AbortSignal;
  } = {},
): Promise<T> {
  const maxAttempts = options.maxAttempts ?? 4;
  const baseDelayMs = options.baseDelayMs ?? 500;
  let attempt = 0;
  let lastError: Error = new Error('Retry attempts exhausted');

  while (attempt < maxAttempts) {
    if (options.signal?.aborted) {
      throw new Error('Request aborted');
    }
    try {
      return await fn();
    } catch (error) {
      lastError =
        error instanceof Error ? error : new Error('Unexpected retry failure');
      const retryable = error instanceof GscApiError && error.retryable;
      attempt += 1;
      if (!retryable || attempt >= maxAttempts) {
        throw error;
      }
      const jitter = Math.floor(Math.random() * baseDelayMs);
      const delay = baseDelayMs * 2 ** (attempt - 1) + jitter;
      await sleep(delay, options.signal);
    }
  }

  throw lastError;
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        reject(new Error('Request aborted'));
      },
      { once: true },
    );
  });
}

export async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (true) {
      const current = nextIndex;
      nextIndex += 1;
      if (current >= items.length) {
        return;
      }
      results[current] = await mapper(items[current]!, current);
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    () => worker(),
  );
  await Promise.all(workers);
  return results;
}
