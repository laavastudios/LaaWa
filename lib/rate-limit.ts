type Entry = { count: number; resetAt: number };

const buckets = new Map<string, Entry>();
const WINDOW_MS = 60_000;
const MAX_ENTRIES = 10_000;

export function rateLimit(key: string, limit = 120) {
  const now = Date.now();
  const current = buckets.get(key);
  if (!current || current.resetAt <= now) {
    if (buckets.size >= MAX_ENTRIES) {
      for (const [k, value] of buckets) if (value.resetAt <= now) buckets.delete(k);
    }
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return { ok: true, remaining: limit - 1, resetAt: now + WINDOW_MS };
  }
  current.count += 1;
  return { ok: current.count <= limit, remaining: Math.max(0, limit - current.count), resetAt: current.resetAt };
}

export function clientKey(req: Request) {
  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || req.headers.get("x-real-ip") || "unknown";
}
