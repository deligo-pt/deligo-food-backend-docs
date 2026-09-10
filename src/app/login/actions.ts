"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { authConfigured, checkPassword, endSession, startSession } from "@/lib/auth";
import { clearLoginAttempts, registerLoginAttempt } from "@/lib/login-rate-limit";
import { safeNextPath } from "@/lib/safe-redirect";

export interface LoginState {
  error?: string;
}

/**
 * Shown for a wrong password AND for a throttled attempt — identical on purpose,
 * so the response never reveals the rate limiter's state or timing.
 */
const INVALID_CREDENTIALS = "Incorrect password.";

/**
 * Randomised delay that blunts online password guessing. Applied on every
 * rejected attempt (wrong password or throttled) so neither is faster than the
 * other.
 */
function guessGuardDelay(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 220 + Math.random() * 200));
}

/**
 * Best-effort client identifier for per-client login throttling. Never contains
 * credentials.
 *
 * Only values a trusted reverse proxy sets are used. The documented nginx config
 * (see DEPLOYMENT.md) sends `X-Real-IP: $remote_addr` and rewrites
 * `X-Forwarded-For` to `$remote_addr`, both overwriting anything the client
 * sent, so `X-Real-IP` is preferred. The *leftmost* `X-Forwarded-For` entry is
 * attacker-controlled — a client can prepend arbitrary values and mint a fresh
 * throttle bucket per request — so it is never used; the *rightmost* entry (the
 * hop the nearest proxy appended) is the safe fallback. With no proxy headers at
 * all (e.g. a request straight to the loopback port) every caller shares one
 * bucket rather than getting a free bucket from a spoofed header. nginx's own
 * `limit_req`, keyed on the unforgeable TCP peer address, is the backstop for
 * the direct-access case.
 */
async function loginClientKey(): Promise<string> {
  const h = await headers();

  const realIp = h.get("x-real-ip")?.trim();
  if (realIp) return realIp;

  const forwardedFor = h.get("x-forwarded-for");
  if (forwardedFor) {
    const parts = forwardedFor.split(",");
    const rightmost = parts[parts.length - 1]?.trim();
    if (rightmost) return rightmost;
  }

  return "unknown";
}

export async function login(
  _prevState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  if (!authConfigured()) {
    return { error: "Authentication is not configured on this server." };
  }

  // Count this attempt before any async work, so a burst of concurrent guesses
  // is throttled instead of all slipping past the fixed delay.
  const clientKey = await loginClientKey();
  if (!registerLoginAttempt(clientKey).ok) {
    await guessGuardDelay();
    return { error: INVALID_CREDENTIALS };
  }

  const password = formData.get("password");
  const next = safeNextPath(
    typeof formData.get("next") === "string"
      ? (formData.get("next") as string)
      : "/",
  );

  const valid = await checkPassword(password);
  await guessGuardDelay();

  if (!valid) {
    return { error: INVALID_CREDENTIALS };
  }

  if (!(await startSession())) {
    return { error: "Authentication is not configured on this server." };
  }

  // Successful sign-in — forget this client's earlier failures.
  clearLoginAttempts(clientKey);
  redirect(next);
}

export async function logout(): Promise<void> {
  await endSession();
  redirect("/login");
}
