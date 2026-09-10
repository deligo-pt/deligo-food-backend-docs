"use client";

import { useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";

/** A `<pre>` wrapper that adds a language label and a copy-to-clipboard button. */
export function CodeBlock({
  children,
  language,
}: {
  children: ReactNode;
  language?: string;
}) {
  const preRef = useRef<HTMLPreElement>(null);
  const [copied, setCopied] = useState(false);

  async function copy() {
    const text = preRef.current?.innerText ?? "";
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard unavailable */
    }
  }

  return (
    <div className="group not-prose relative my-5">
      {language && language !== "text" && (
        <span className="absolute top-2.5 left-3 z-10 text-[0.625rem] font-medium tracking-wide text-fg-subtle uppercase select-none">
          {language}
        </span>
      )}
      <button
        type="button"
        onClick={copy}
        aria-label="Copy code"
        className={cn(
          "absolute top-2 right-2 z-10 flex items-center gap-1 rounded-md border border-border bg-bg-elevated px-2 py-1 text-[0.6875rem] text-fg-muted opacity-0 transition-opacity",
          "group-hover:opacity-100 focus-visible:opacity-100",
        )}
      >
        {copied ? <CheckIcon /> : <CopyIcon />}
        {copied ? "Copied" : "Copy"}
      </button>
      <pre
        ref={preRef}
        className={cn(
          "overflow-x-auto rounded-lg border border-border bg-bg-subtle p-4 text-[0.8125rem] leading-relaxed custom-scroll",
          language && language !== "text" ? "pt-8" : "",
        )}
      >
        {children}
      </pre>
    </div>
  );
}

function CopyIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-success" aria-hidden>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}
