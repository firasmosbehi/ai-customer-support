export interface RetryOptions {
  retries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  factor?: number;
  shouldRetry?: (error: unknown, attempt: number) => boolean;
}

const sleep = async (ms: number): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, ms));
};

/**
 * Executes an async function with bounded exponential backoff retries.
 */
export const withRetry = async <T>(
  task: (attempt: number) => Promise<T>,
  options: RetryOptions = {}
): Promise<T> => {
  const retries = options.retries ?? 2;
  const baseDelayMs = options.baseDelayMs ?? 300;
  const maxDelayMs = options.maxDelayMs ?? 3000;
  const factor = options.factor ?? 2;

  let lastError: unknown;

  for (let attempt = 1; attempt <= retries + 1; attempt += 1) {
    try {
      return await task(attempt);
    } catch (error) {
      lastError = error;

      if (attempt > retries) {
        break;
      }

      if (options.shouldRetry && !options.shouldRetry(error, attempt)) {
        break;
      }

      const backoff = Math.min(baseDelayMs * factor ** (attempt - 1), maxDelayMs);
      const jitter = Math.floor(Math.random() * 120);
      await sleep(backoff + jitter);
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Retry operation failed");
};
