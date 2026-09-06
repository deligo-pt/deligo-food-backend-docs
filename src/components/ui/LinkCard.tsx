import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function LinkCard({
  href,
  title,
  description,
  eyebrow,
  icon,
  className,
}: {
  href: string;
  title: string;
  description?: string | null;
  eyebrow?: string;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group relative flex flex-col gap-1.5 rounded-xl border border-border bg-bg-elevated p-5 transition-all duration-200",
        "hover:-translate-y-0.5 hover:border-border-strong hover:shadow-pop",
        className,
      )}
    >
      {(icon || eyebrow) && (
        <span className="mb-1 flex items-center gap-2.5">
          {icon && (
            <span className="flex size-8 items-center justify-center rounded-lg border border-border bg-bg-subtle text-fg-muted transition-colors group-hover:border-accent-border group-hover:bg-accent-subtle group-hover:text-accent">
              {icon}
            </span>
          )}
          {eyebrow && (
            <span className="text-[0.6875rem] font-semibold tracking-[0.11em] text-fg-subtle uppercase">
              {eyebrow}
            </span>
          )}
        </span>
      )}
      <span className="text-[0.95rem] font-semibold text-fg group-hover:text-accent">
        {title}
      </span>
      {description && (
        <span className="line-clamp-2 text-[0.8125rem] leading-relaxed text-fg-muted">
          {description}
        </span>
      )}
    </Link>
  );
}
