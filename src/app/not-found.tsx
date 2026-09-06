import Link from "next/link";
import { Header } from "@/components/layout/Header";

export default function NotFound() {
  return (
    <div className="flex min-h-full flex-col">
      <Header />
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center px-4 py-24 text-center">
        <p className="text-[0.6875rem] font-semibold tracking-[0.16em] text-fg-subtle uppercase">
          404
        </p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight text-fg">
          Page not found
        </h1>
        <p className="mt-2 text-sm text-fg-muted">
          That documentation page doesn&rsquo;t exist. It may have been renamed or
          moved.
        </p>
        <div className="mt-6 flex gap-3">
          <Link
            href="/docs"
            className="rounded-lg bg-accent px-3.5 py-2 text-sm font-medium text-accent-fg transition-colors hover:bg-accent-hover"
          >
            Browse the docs
          </Link>
          <Link
            href="/"
            className="rounded-lg border border-border px-3.5 py-2 text-sm font-medium text-fg-muted transition-colors hover:bg-bg-subtle"
          >
            Go home
          </Link>
        </div>
      </main>
    </div>
  );
}
