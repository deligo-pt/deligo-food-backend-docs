"use client";

import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { safeNextPath } from "@/lib/safe-redirect";
import { login, type LoginState } from "./actions";

const initialState: LoginState = {};

export function LoginForm() {
  const searchParams = useSearchParams();
  const next = safeNextPath(searchParams.get("next"));
  const [state, formAction, pending] = useActionState(login, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="next" value={next} />

      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className="text-sm font-medium text-fg">
          Access password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          autoFocus
          required
          aria-invalid={state.error ? true : undefined}
          aria-describedby={state.error ? "login-error" : undefined}
          className="rounded-lg border border-border bg-bg px-3 py-2 text-sm text-fg transition-colors outline-none placeholder:text-fg-subtle focus:border-accent-border focus:ring-2 focus:ring-ring"
          placeholder="Enter the shared password"
        />
      </div>

      {state.error && (
        <p
          id="login-error"
          role="alert"
          className="rounded-lg border border-danger-subtle bg-danger-subtle px-3 py-2 text-xs font-medium text-danger"
        >
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="mt-1 inline-flex items-center justify-center rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-fg transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
