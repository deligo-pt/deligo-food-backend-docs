import type { ReactNode } from "react";

/**
 * A `template` re-mounts on every navigation, so the CSS entrance animation
 * replays as the reader moves between documents. The persistent shell
 * (`layout.tsx`) stays mounted, so sidebar state and scroll position are kept.
 */
export default function DocsTemplate({ children }: { children: ReactNode }) {
  return <div className="animate-fade-in">{children}</div>;
}
