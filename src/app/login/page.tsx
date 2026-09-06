import type { Metadata } from "next";
import { Suspense } from "react";
import { Logo } from "@/components/layout/Logo";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false, follow: false },
};

export default function LoginPage() {
  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center px-4 py-12">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center text-center">
          <Logo subtitle={false} />
          <h1 className="mt-6 text-lg font-semibold tracking-tight text-fg">
            Internal documentation
          </h1>
          <p className="mt-1.5 text-sm text-pretty text-fg-muted">
            This portal is private. Enter the access password to continue.
          </p>
        </div>

        <div className="mt-7 rounded-2xl border border-border bg-bg-elevated p-6 shadow-pop">
          <Suspense
            fallback={
              <div className="h-[168px] animate-pulse rounded-lg bg-bg-subtle" />
            }
          >
            <LoginForm />
          </Suspense>
        </div>

        <p className="mt-6 text-center text-xs text-fg-subtle">
          Deligo Engineering — authorized personnel only
        </p>
      </div>
    </main>
  );
}
