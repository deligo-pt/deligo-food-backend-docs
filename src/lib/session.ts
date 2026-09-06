/**
 * Stateless session token.
 *
 * A compact, HMAC-SHA256-signed value stored in an httpOnly cookie — no
 * server-side session store and no third-party dependency. It is verifiable
 * both in `proxy.ts` (runs before rendering) and in route handlers through the
 * Web Crypto API, which is available in every Next.js server runtime.
 *
 * This module is intentionally free of `next/headers` so it can be imported
 * from the proxy. Cookie plumbing lives in `./auth` (server-only).
 */

export const SESSION_COOKIE = "deligo_docs_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days

const SUBJECT = "docs";

export interface SessionPayload {
  /** Constant subject — this is a shared-access portal, not per-user auth. */
  sub: string;
  /**
   * Auth epoch the token was minted under (`DOCS_AUTH_VERSION`). A token is
   * only accepted while this still equals the server's current value, so
   * bumping the env var revokes every outstanding session at once — without
   * rotating `DOCS_SESSION_SECRET`.
   */
  ver: number;
  /** Issued-at, seconds since epoch. */
  iat: number;
  /** Expiry, seconds since epoch. */
  exp: number;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecode(value: string): Uint8Array<ArrayBuffer> {
  const padded = value
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function readSecret(): string | null {
  const secret = process.env.DOCS_SESSION_SECRET?.trim();
  return secret && secret.length >= 16 ? secret : null;
}

/**
 * The current auth version from `DOCS_AUTH_VERSION` — a positive integer that
 * acts as a global session epoch. Returns `null` when the variable is missing
 * or not a positive integer, which makes both signing and verification fail
 * closed (nobody can sign in, every existing token is rejected).
 */
export function currentAuthVersion(): number | null {
  const raw = process.env.DOCS_AUTH_VERSION?.trim();
  if (!raw || !/^\d{1,9}$/.test(raw)) return null;
  const value = Number(raw);
  return Number.isInteger(value) && value >= 1 ? value : null;
}

async function importKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

/**
 * Sign a fresh session token stamped with the current `DOCS_AUTH_VERSION`, or
 * `null` when `DOCS_SESSION_SECRET` or `DOCS_AUTH_VERSION` is missing/invalid
 * (the site then stays locked — fail closed).
 */
export async function signSessionToken(now: number = Date.now()): Promise<string | null> {
  const secret = readSecret();
  const version = currentAuthVersion();
  if (!secret || version === null) return null;

  const issuedAt = Math.floor(now / 1000);
  const payload: SessionPayload = {
    sub: SUBJECT,
    ver: version,
    iat: issuedAt,
    exp: issuedAt + SESSION_MAX_AGE_SECONDS,
  };

  const body = base64UrlEncode(encoder.encode(JSON.stringify(payload)));
  const key = await importKey(secret);
  const signature = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, encoder.encode(body)),
  );
  return `${body}.${base64UrlEncode(signature)}`;
}

/**
 * Verify a token and return its payload, or `null` if it is missing, malformed,
 * has a bad signature, or has expired. `crypto.subtle.verify` performs the
 * signature comparison in constant time.
 */
export async function verifySessionToken(
  token: string | undefined | null,
): Promise<SessionPayload | null> {
  if (!token) return null;
  const secret = readSecret();
  if (!secret) return null;
  const version = currentAuthVersion();
  if (version === null) return null;

  const separator = token.indexOf(".");
  if (separator <= 0 || separator === token.length - 1) return null;
  const body = token.slice(0, separator);
  const signaturePart = token.slice(separator + 1);

  let signature: Uint8Array<ArrayBuffer>;
  try {
    signature = base64UrlDecode(signaturePart);
  } catch {
    return null;
  }

  const key = await importKey(secret);
  let valid: boolean;
  try {
    valid = await crypto.subtle.verify(
      "HMAC",
      key,
      signature,
      encoder.encode(body),
    );
  } catch {
    return null;
  }
  if (!valid) return null;

  let payload: SessionPayload;
  try {
    payload = JSON.parse(decoder.decode(base64UrlDecode(body))) as SessionPayload;
  } catch {
    return null;
  }

  if (
    payload.sub !== SUBJECT ||
    // Reject tokens minted under a different (or absent) auth version. An old
    // token from before this field existed has `ver === undefined` and fails
    // the type check, so it is rejected too.
    typeof payload.ver !== "number" ||
    payload.ver !== version ||
    typeof payload.exp !== "number" ||
    payload.exp * 1000 <= Date.now()
  ) {
    return null;
  }

  return payload;
}
