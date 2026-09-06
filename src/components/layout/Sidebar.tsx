"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { NavSection } from "@/types";
import { useHydrated } from "@/lib/use-hydrated";
import { cn } from "@/lib/cn";

const STORAGE_KEY = "deligo-docs:collapsed-sections";

function readCollapsed(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
  } catch {
    return new Set();
  }
}

export function Sidebar({
  nav,
  onNavigate,
}: {
  nav: NavSection[];
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const hydrated = useHydrated();
  const [collapsed, setCollapsed] = useState<Set<string>>(readCollapsed);
  const activeRef = useRef<HTMLAnchorElement>(null);

  // Bring the current page's sidebar entry into view on load / route change.
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [pathname]);

  const activeSection = useMemo(() => {
    for (const section of nav) {
      if (section.href && isActive(pathname, section.href)) return section.title;
      if (section.items.some((i) => isActive(pathname, i.href)))
        return section.title;
    }
    return null;
  }, [nav, pathname]);

  function toggle(title: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(title)) next.delete(title);
      else next.add(title);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]));
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  return (
    <nav
      aria-label="Documentation"
      className="flex flex-col gap-5 py-6 pr-1 text-sm"
    >
      <div className="flex items-center gap-2 px-3">
        <span className="size-1.5 rounded-full bg-accent" aria-hidden />
        <p className="text-[0.6875rem] font-semibold tracking-[0.16em] text-fg-subtle uppercase">
          Deligo Engineering
        </p>
      </div>

      <ul className="flex flex-col gap-1">
        {nav.map((section) => {
          const isLinkOnly = section.items.length === 0 && section.href;
          const open =
            !hydrated ||
            !collapsed.has(section.title) ||
            activeSection === section.title;
          const sectionActive = activeSection === section.title;

          if (isLinkOnly) {
            const active = isActive(pathname, section.href!);
            return (
              <li key={section.title}>
                <Link
                  ref={active ? activeRef : undefined}
                  href={section.href!}
                  onClick={onNavigate}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center rounded-lg px-3 py-2 text-[0.8125rem] font-medium transition-colors",
                    active
                      ? "bg-accent-subtle text-accent"
                      : "text-fg-muted hover:bg-bg-subtle hover:text-fg",
                  )}
                >
                  {section.title}
                </Link>
              </li>
            );
          }

          return (
            <li key={section.title} className="mt-1 first:mt-0">
              <button
                type="button"
                onClick={() => toggle(section.title)}
                aria-expanded={open}
                className={cn(
                  "flex w-full items-center justify-between rounded-md px-3 py-1.5 text-[0.6875rem] font-semibold tracking-[0.13em] uppercase transition-colors",
                  sectionActive
                    ? "text-fg"
                    : "text-fg-subtle hover:text-fg-muted",
                )}
              >
                <span>{section.title}</span>
                <ChevronIcon
                  className={cn(
                    "text-fg-subtle transition-transform duration-200",
                    open ? "" : "-rotate-90",
                  )}
                />
              </button>

              <div
                className={cn(
                  "grid transition-[grid-template-rows] duration-200 ease-out",
                  open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
                )}
              >
                <div className="overflow-hidden">
                  <ul className="mt-1.5 flex flex-col border-l border-border pl-3">
                    {section.items.map((item) => {
                      const active = isActive(pathname, item.href);
                      return (
                        <li key={item.href}>
                          <Link
                            ref={active ? activeRef : undefined}
                            href={item.href}
                            onClick={onNavigate}
                            aria-current={active ? "page" : undefined}
                            className={cn(
                              "-ml-px flex items-center rounded-r-md border-l-2 py-1.5 pl-3 text-[0.8125rem] transition-colors",
                              active
                                ? "border-accent bg-accent-subtle font-medium text-accent"
                                : "border-transparent text-fg-muted hover:border-border-strong hover:text-fg",
                            )}
                          >
                            {item.title}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function isActive(pathname: string, href: string): boolean {
  if (href === "/docs") return pathname === "/docs";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function ChevronIcon({ className }: { className?: string }) {
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
      className={className}
      aria-hidden
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}
