"use client";

import { useEffect, useState, type ReactNode } from "react";
import type { NavSection } from "@/types";
import { Header } from "./Header";
import { Sidebar } from "./Sidebar";
import { LogoutButton } from "./LogoutButton";
import { cn } from "@/lib/cn";

/**
 * Documentation layout: full-width header, a persistent left sidebar on desktop,
 * an off-canvas drawer on smaller screens, and the page content (which may add
 * its own right-hand table of contents).
 */
export function DocsShell({
  nav,
  children,
}: {
  nav: NavSection[];
  children: ReactNode;
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    document.body.style.overflow = drawerOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [drawerOpen]);

  return (
    <div className="flex min-h-full flex-col">
      <Header showMenuButton onMenuClick={() => setDrawerOpen(true)} />

      <div className="mx-auto flex w-full max-w-[100rem] flex-1">
        {/* Desktop sidebar */}
        <aside className="sticky top-14 hidden h-[calc(100dvh-3.5rem)] w-64 shrink-0 overflow-y-auto border-r border-border px-3 custom-scroll lg:block xl:w-70">
          <Sidebar nav={nav} />
        </aside>

        {/* Mobile drawer */}
        <div
          className={cn("fixed inset-0 z-50 lg:hidden", drawerOpen ? "" : "pointer-events-none")}
          aria-hidden={!drawerOpen}
        >
          <div
            className={cn(
              "absolute inset-0 bg-black/45 backdrop-blur-[2px] transition-opacity duration-200",
              drawerOpen ? "opacity-100" : "opacity-0",
            )}
            onClick={() => setDrawerOpen(false)}
          />
          <div
            className={cn(
              "absolute inset-y-0 left-0 flex w-70 max-w-[85vw] flex-col overflow-y-auto border-r border-border bg-bg-elevated px-3 shadow-float transition-transform duration-200 ease-out custom-scroll",
              drawerOpen ? "translate-x-0" : "-translate-x-full",
            )}
          >
            <div className="flex h-14 items-center justify-between pr-1 pl-3">
              <span className="text-[0.6875rem] font-semibold tracking-[0.16em] text-fg-subtle uppercase">
                Navigation
              </span>
              <div className="flex items-center">
                <LogoutButton />
                <button
                  type="button"
                  onClick={() => setDrawerOpen(false)}
                  aria-label="Close navigation"
                  className="flex size-9 items-center justify-center rounded-lg text-fg-muted transition-colors hover:bg-bg-subtle hover:text-fg"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                    <path d="M18 6 6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <Sidebar nav={nav} onNavigate={() => setDrawerOpen(false)} />
          </div>
        </div>

        <main id="main-content" className="min-w-0 flex-1">
          {children}
        </main>
      </div>
    </div>
  );
}
