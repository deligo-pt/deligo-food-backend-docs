"use client";

import { useSyncExternalStore } from "react";

function subscribe(callback: () => void): () => void {
  window.addEventListener("scroll", callback, { passive: true });
  return () => window.removeEventListener("scroll", callback);
}

/**
 * Whether the window is scrolled past `threshold` pixels.
 *
 * Uses `useSyncExternalStore` so it needs no `useState`/`useEffect` pair and
 * stays hydration-safe (returns `false` on the server / first paint).
 */
export function useScrolled(threshold = 4): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.scrollY > threshold,
    () => false,
  );
}
