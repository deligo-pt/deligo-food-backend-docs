"use client";

import { useCallback, useEffect, useState } from "react";
import type { TocItem } from "@/types";
import { cn } from "@/lib/cn";

export function TableOfContents({ items }: { items: TocItem[] }) {
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    if (items.length === 0) return;

    const headings = items
      .map((i) => document.getElementById(i.id))
      .filter((el): el is HTMLElement => el !== null);
    if (headings.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActiveId(visible[0].target.id);
      },
      { rootMargin: "-84px 0px -68% 0px", threshold: [0, 1] },
    );

    headings.forEach((h) => observer.observe(h));
    return () => observer.disconnect();
  }, [items]);

  const jump = useCallback((e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    e.preventDefault();
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    history.replaceState(null, "", `#${id}`);
    setActiveId(id);
  }, []);

  if (items.length < 2) return null;

  return (
    <nav aria-label="On this page" className="text-sm">
      <p className="mb-3 pl-3 text-[0.6875rem] font-semibold tracking-[0.14em] text-fg-subtle uppercase">
        On this page
      </p>
      <ul className="flex flex-col border-l border-border">
        {items.map((item) => {
          const active = activeId === item.id;
          return (
            <li key={item.id}>
              <a
                href={`#${item.id}`}
                onClick={(e) => jump(e, item.id)}
                aria-current={active ? "location" : undefined}
                className={cn(
                  "-ml-px block border-l-2 py-1.25 text-[0.8125rem] leading-snug transition-colors",
                  item.depth === 3 ? "pl-6" : "pl-3",
                  active
                    ? "border-accent font-medium text-accent"
                    : "border-transparent text-fg-subtle hover:border-border-strong hover:text-fg-muted",
                )}
              >
                {item.text}
              </a>
            </li>
          );
        })}
      </ul>

      <button
        type="button"
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        className="mt-4 ml-3 inline-flex items-center gap-1.5 text-[0.75rem] text-fg-subtle transition-colors hover:text-fg-muted"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="m18 15-6-6-6 6" />
        </svg>
        Back to top
      </button>
    </nav>
  );
}
