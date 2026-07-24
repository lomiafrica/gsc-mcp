import { describe, expect, it } from 'vitest';

import { withRetry } from '../google/retry.js';
import { GscApiError } from '../google/errors.js';

describe('withRetry', () => {
  it('retries retryable errors', async () => {
    let attempts = 0;
    const value = await withRetry(async () => {
      attempts += 1;
      if (attempts < 2) {
        throw new GscApiError('rate limited', {
          status: 429,
          retryable: true,
        });
      }
      return 'ok';
    }, { maxAttempts: 3, baseDelayMs: 1 });
    expect(value).toBe('ok');
    expect(attempts).toBe(2);
  });

  it('does not retry validation failures', async () => {
    await expect(
      withRetry(async () => {
        throw new GscApiError('forbidden', {
          status: 403,
          retryable: false,
        });
      }, { maxAttempts: 3, baseDelayMs: 1 }),
    ).rejects.toThrow('forbidden');
  });
});
