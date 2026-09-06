import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type Tone = "neutral" | "accent" | "success" | "warning" | "danger" | "info";

const TONES: Record<Tone, string> = {
  neutral: "bg-bg-inset text-fg-muted border-border",
  accent: "bg-accent-subtle text-accent border-accent-border",
  success: "bg-success-subtle text-success border-transparent",
  warning: "bg-warning-subtle text-warning border-transparent",
  danger: "bg-danger-subtle text-danger border-transparent",
  info: "bg-info-subtle text-info border-transparent",
};

/** Map a changelog "Type" value to a tone. */
export function toneForType(type: string | null | undefined): Tone {
  switch ((type ?? "").toUpperCase()) {
    case "FEATURE":
      return "accent";
    case "BUG_FIX":
      return "success";
    case "BREAKING_CHANGE":
      return "danger";
    case "SECURITY":
      return "warning";
    case "REFACTOR":
    case "CHANGE":
      return "info";
    default:
      return "neutral";
  }
}

const DOT: Record<Tone, string> = {
  neutral: "bg-border-strong",
  accent: "bg-accent",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
  info: "bg-info",
};

/** Background-colour class for a timeline dot, keyed by changelog type. */
export function dotClassForType(type: string | null | undefined): string {
  return DOT[toneForType(type)];
}

export function Badge({
  children,
  tone = "neutral",
  className,
  title,
}: {
  children: ReactNode;
  tone?: Tone;
  className?: string;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[0.6875rem] font-medium tracking-wide uppercase whitespace-nowrap",
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
