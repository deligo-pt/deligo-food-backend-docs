import Link from "next/link";
import { cn } from "@/lib/cn";

export function Logo({
  className,
  subtitle = true,
}: {
  className?: string;
  subtitle?: boolean;
}) {
  return (
    <Link
      href="/"
      className={cn("group flex items-center gap-2.5", className)}
      aria-label="Deligo Engineering — home"
    >
      <span className="flex size-7 items-center justify-center rounded-md bg-accent text-accent-fg">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M4 7.5 12 3l8 4.5v9L12 21l-8-4.5v-9Z"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
          <path d="M12 12 4 7.5M12 12v9M12 12l8-4.5" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
        </svg>
      </span>
      <span className="flex flex-col leading-none">
        <span className="text-[0.9375rem] font-semibold tracking-tight text-fg">
          Deligo <span className="text-fg-muted">Engineering</span>
        </span>
        {subtitle && (
          <span className="mt-0.5 text-[0.6875rem] tracking-wide text-fg-subtle uppercase">
            Backend Documentation
          </span>
        )}
      </span>
    </Link>
  );
}
