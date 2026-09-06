"use client";

import { useSyncExternalStore } from "react";

const noop = () => () => {};

/**
 * `false` during SSR and the first client render, `true` afterwards.
 *
 * Uses `useSyncExternalStore` (rather than a `useState`+`useEffect` mount flag)
 * so it stays hydration-safe and lint-clean.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
}
