import type { ReactNode } from "react";
import { DocsShell } from "@/components/layout/DocsShell";
import { getNavigation } from "@/lib/navigation";

export default function DocsGroupLayout({ children }: { children: ReactNode }) {
  const nav = getNavigation();
  return <DocsShell nav={nav}>{children}</DocsShell>;
}
