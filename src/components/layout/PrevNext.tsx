import Link from "next/link";
import type { DocMeta } from "@/types";
import { cn } from "@/lib/cn";

export function PrevNext({
  prev,
  next,
}: {
  prev: DocMeta | null;
  next: DocMeta | null;
}) {
  if (!prev && !next) return null;

  return (
    <nav
      aria-label="Pagination"
      className="mt-14 grid gap-3 border-t border-border pt-8 sm:grid-cols-2"
    >
      {prev ? (
        <PagerLink doc={prev} direction="prev" />
      ) : (
        <span className="hidden sm:block" />
      )}
      {next && <PagerLink doc={next} direction="next" />}
    </nav>
  );
}

function PagerLink({
  doc,
  direction,
}: {
  doc: DocMeta;
  direction: "prev" | "next";
}) {
  const isNext = direction === "next";
  return (
    <Link
      href={doc.href}
      className={cn(
        "group flex flex-col gap-1.5 rounded-xl border border-border p-4 transition-all hover:border-border-strong hover:bg-bg-subtle",
        isNext ? "sm:items-end sm:text-right" : "",
      )}
    >
      <span className="flex items-center gap-1.5 text-[0.6875rem] font-medium tracking-[0.08em] text-fg-subtle uppercase">
        {!isNext && (
          <Arrow dir="left" className="transition-transform group-hover:-translate-x-0.5" />
        )}
        {isNext ? "Next" : "Previous"}
        {isNext && (
          <Arrow dir="right" className="transition-transform group-hover:translate-x-0.5" />
        )}
      </span>
      <span className="text-[0.9rem] font-medium text-fg group-hover:text-accent">
        {doc.title}
      </span>
      <span className="text-xs text-fg-subtle">{doc.category}</span>
    </Link>
  );
}

function Arrow({ dir, className }: { dir: "left" | "right"; className?: string }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn(dir === "left" ? "rotate-180" : "", className)}
      aria-hidden
    >
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}
