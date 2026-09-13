type Entry = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Entry>();
const WINDOW_MS = 60_000;
const MAX_ENTRIES = 10_000;

export function rateLimit(key: string, limit = 120) {
  const now = Date.now();
  const current = buckets.get(key);

  if (!current || current.resetAt <= now) {
    if (buckets.size >= MAX_ENTRIES) {
      for (const [entryKey, entry] of buckets) {
        if (entry.resetAt <= now) buckets.delete(entryKey);
      }
    }

    const resetAt = now + WINDOW_MS;
    buckets.set(key, { count: 1, resetAt });
    return { ok: true, remaining: limit - 1, resetAt };
  }

  current.count += 1;
  return {
    ok: current.count <= limit,
    remaining: Math.max(0, limit - current.count),
    resetAt: current.resetAt,
  };
}

export function clientKey(request: Request) {
  const forwarded = request.headers
    .get("x-forwarded-for")
    ?.split(",")[0]
    ?.trim();

  return forwarded || request.headers.get("x-real-ip") || "unknown";
}
