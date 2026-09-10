import Link from "next/link";
import { SITE } from "@/lib/config";

export function Footer() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-[100rem] flex-col gap-2 px-4 py-6 text-xs text-fg-subtle sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p>{SITE.name} — internal documentation. Authorized personnel only.</p>
        <nav className="flex gap-4">
          <Link href="/docs" className="hover:text-fg-muted">
            Docs
          </Link>
          <Link href="/changelog" className="hover:text-fg-muted">
            Change Log
          </Link>
          <Link href="/decisions" className="hover:text-fg-muted">
            Decisions
          </Link>
        </nav>
      </div>
    </footer>
  );
}
