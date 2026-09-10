import "server-only";

/**
 * In-memory, per-client fixed-window throttle for the `/login` Server Action.
 *
 * Scope: deliberately minimal and matched to the documented deployment — one
 * Node process behind an nginx reverse proxy (see `DEPLOYMENT.md`). State lives
 * in this process only: it is not shared across instances and is cleared on
 * restart. That is acceptable here (short window, rare restarts) and it is the
 * inner of two layers: the documented nginx config also runs `limit_req` on
 * `/login`, keyed on the unforgeable TCP peer address (see `DEPLOYMENT.md`).
 * This does not touch the
 * authentication/session architecture — it only decides whether a login attempt
 * is allowed to proceed.
 *
 * Concurrency: `registerLoginAttempt()` mutates the Map synchronously with no
 * `await`, so on Node's single-threaded event loop every attempt in a burst of
 * concurrent requests is counted before the async password check runs. This is
 * what a fixed artificial delay alone does not provide.
 */

/** Attempts (any outcome) allowed per window before further attempts are refused. */
const MAX_ATTEMPTS = 8;

/** Rolling window length, in milliseconds. */
const WINDOW_MS = 15 * 60 * 1000;

/** Hard ceiling on tracked client keys, to bound memory under attack. */
const MAX_KEYS = 20_000;

interface Bucket {
  count: number;
  /** Epoch ms at which this client's window resets. */
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

/** Drop expired buckets; as a last resort under flooding, clear everything. */
function sweep(now: number): void {
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
  if (buckets.size > MAX_KEYS) buckets.clear();
}

export interface RateLimitResult {
  /** Whether this attempt may proceed. */
  ok: boolean;
  /** Seconds until the client may retry (0 when `ok`). */
  retryAfterSeconds: number;
}

/**
 * Record one login attempt for `key` and report whether it is allowed. Call
 * exactly once per `login` invocation, before any credential validation.
 */
export function registerLoginAttempt(key: string): RateLimitResult {
  const now = Date.now();
  if (buckets.size >= MAX_KEYS / 2) sweep(now);

  let bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 0, resetAt: now + WINDOW_MS };
    buckets.set(key, bucket);
  }

  bucket.count += 1;

  if (bucket.count > MAX_ATTEMPTS) {
    return {
      ok: false,
      retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
    };
  }
  return { ok: true, retryAfterSeconds: 0 };
}

/** Forget a client's attempt history after a fully successful sign-in. */
export function clearLoginAttempts(key: string): void {
  buckets.delete(key);
}
