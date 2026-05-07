const MAX_REQUESTS = 60;
const WINDOW_MS = 60 * 1000;

const store = new Map<string, number[]>();

export function checkApiRateLimit(identifier: string): boolean {
  const now = Date.now();
  const windowStart = now - WINDOW_MS;
  const timestamps = (store.get(identifier) ?? []).filter((t) => t > windowStart);

  if (timestamps.length >= MAX_REQUESTS) return false;

  timestamps.push(now);
  store.set(identifier, timestamps);
  return true;
}
