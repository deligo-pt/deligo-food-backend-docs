import Link from "next/link";
import deligoLogo from "../../../public/brand/deligo-logo.png";
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
      aria-label="DeliGo Backend Docs — home"
    >
      {/*
        Brand mark supplied at public/brand/deligo-logo.png — used as-is. The
        artwork is a self-contained rounded tile (magenta ground, white "D"),
        so it reads correctly on both the light and dark page backgrounds
        without any extra container styling.
      */}
      {/* eslint-disable-next-line @next/next/no-img-element -- next/image is intentionally unused in this app (see next.config.ts) */}
      <img
        src={deligoLogo.src}
        width={28}
        height={28}
        alt="DeliGo logo"
        className="size-7 shrink-0 rounded-[7px]"
      />
      <span className="flex flex-col leading-none">
        <span className="text-[0.9375rem] font-semibold tracking-tight text-fg">
          DeliGo <span className="text-fg-muted">Backend Docs</span>
        </span>
        {subtitle && (
          <span className="mt-0.5 text-[0.6875rem] tracking-wide text-fg-subtle uppercase">
            Backend Engineering Documentation
          </span>
        )}
      </span>
    </Link>
  );
}
