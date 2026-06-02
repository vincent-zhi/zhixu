export class TimeoutError extends Error {
  constructor(timeoutMs: number, nodeRef?: string) {
    const refSuffix = nodeRef ? ` (ref: ${nodeRef})` : "";
    super(`Operation timed out after ${timeoutMs}ms${refSuffix}`);
    this.name = "TimeoutError";
  }
}

export async function runWithTimeout<T>(
  operation: () => Promise<T>,
  timeoutMs: number
): Promise<T> {
  if (timeoutMs <= 0) return operation();

  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new TimeoutError(timeoutMs));
    }, timeoutMs);

    operation()
      .then((result) => {
        clearTimeout(timer);
        resolve(result);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

export async function runWithRetry<T>(
  operation: () => Promise<T>,
  options: { maxAttempts: number; timeoutMs: number }
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= options.maxAttempts; attempt++) {
    try {
      return await runWithTimeout(operation, options.timeoutMs);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}
