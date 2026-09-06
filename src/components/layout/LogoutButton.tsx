"use client";

import { useFormStatus } from "react-dom";
import { logout } from "@/app/login/actions";
import { cn } from "@/lib/cn";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-label="Sign out"
      title="Sign out"
      className="flex size-9 items-center justify-center rounded-lg text-fg-muted transition-colors hover:bg-bg-subtle hover:text-fg disabled:opacity-60"
    >
      <svg
        width="17"
        height="17"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
      </svg>
    </button>
  );
}

/**
 * Sign-out control: a `<form>` bound to the `logout` Server Action, which
 * clears the session cookie and `redirect()`s to `/login`. `className`
 * controls responsive visibility where the button lives in the header.
 */
export function LogoutButton({ className }: { className?: string }) {
  return (
    <form action={logout} className={cn("flex", className)}>
      <SubmitButton />
    </form>
  );
}
