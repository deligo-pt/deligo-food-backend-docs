"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "./Logo";
import { ThemeToggle } from "./ThemeToggle";
import { LogoutButton } from "./LogoutButton";
import { SearchButton } from "@/components/search/SearchButton";
import { useScrolled } from "@/lib/use-scrolled";
import { cn } from "@/lib/cn";

const NAV = [
  { href: "/docs", label: "Docs" },
  { href: "/changelog", label: "Change Log" },
  { href: "/decisions", label: "Decisions" },
];

export function Header({
  onMenuClick,
  showMenuButton = false,
}: {
  onMenuClick?: () => void;
  showMenuButton?: boolean;
}) {
  const pathname = usePathname();
  const scrolled = useScrolled(4);

  return (
    <header
      className={cn(
        "sticky top-0 z-40 border-b bg-bg/75 backdrop-blur-md transition-colors duration-200",
        scrolled ? "border-border shadow-card" : "border-transparent",
      )}
    >
      <div className="mx-auto flex h-14 max-w-[100rem] items-center gap-2 px-4 sm:gap-3 sm:px-6">
        {showMenuButton && (
          <button
            type="button"
            onClick={onMenuClick}
            aria-label="Open navigation"
            className="-ml-1 flex size-9 items-center justify-center rounded-lg text-fg-muted transition-colors hover:bg-bg-subtle hover:text-fg lg:hidden"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
              <path d="M3 6h18M3 12h18M3 18h18" />
            </svg>
          </button>
        )}

        <Logo subtitle={false} className="shrink-0" />

        <nav className="ml-3 hidden items-center gap-0.5 text-sm md:flex">
          {NAV.map((item) => {
            const active =
              item.href === "/docs"
                ? pathname === "/docs" || pathname.startsWith("/docs/")
                : pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "rounded-md px-2.5 py-1.5 transition-colors",
                  active
                    ? "text-fg"
                    : "text-fg-muted hover:bg-bg-subtle hover:text-fg",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2 sm:gap-2.5">
          <SearchButton />
          <ThemeToggle />
          {/*
            On docs pages the mobile drawer carries "Sign out", so the header
            icon is hidden below `sm` to keep the row from overflowing. On the
            home / 404 pages there is no drawer, so it stays visible.
          */}
          <LogoutButton className={showMenuButton ? "hidden sm:flex" : undefined} />
        </div>
      </div>
    </header>
  );
}
