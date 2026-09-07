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
 * Best-effort client identifier for per-client login throttling. Behind the
 * documented nginx reverse proxy the leftmost `X-Forwarded-For` entry is the
 * real client; a direct/proxy-less request falls back to one shared bucket.
 * Never contains credentials.
 */
async function loginClientKey(): Promise<string> {
  const h = await headers();
  const forwardedFor = h.get("x-forwarded-for");
  const first = forwardedFor?.split(",")[0]?.trim();
  return first || h.get("x-real-ip")?.trim() || "unknown";
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
