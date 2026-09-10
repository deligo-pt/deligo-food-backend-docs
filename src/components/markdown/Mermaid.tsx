"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useTheme } from "next-themes";

/**
 * Render a Mermaid diagram found in the source documentation.
 *
 * Mermaid is loaded lazily (client-only) and re-rendered when the colour theme
 * changes. Legacy `\n` line breaks in node labels are converted to `<br/>`.
 */
export function Mermaid({ chart }: { chart: string }) {
  const { resolvedTheme } = useTheme();
  const [svg, setSvg] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const rawId = useId();
  const domId = "mermaid-" + rawId.replace(/[^a-zA-Z0-9]/g, "");
  const mountedTheme = useRef<string | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    mountedTheme.current = resolvedTheme;

    (async () => {
      try {
        const mermaid = (await import("mermaid")).default;
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: "strict",
          theme: resolvedTheme === "dark" ? "dark" : "default",
          fontFamily: "inherit",
          flowchart: { htmlLabels: true, curve: "basis" },
        });
        const source = chart.replace(/\\n/g, "<br/>");
        const { svg: rendered } = await mermaid.render(domId, source);
        if (!cancelled) {
          setSvg(rendered);
          setFailed(false);
        }
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [chart, resolvedTheme, domId]);

  if (failed) {
    return (
      <pre className="not-prose overflow-x-auto rounded-lg border border-border bg-bg-subtle p-4 text-xs text-fg-muted">
        <code>{chart}</code>
      </pre>
    );
  }

  const wrapperClass =
    "mermaid-diagram not-prose my-6 overflow-x-auto rounded-lg border border-border bg-bg-subtle p-4 custom-scroll";

  if (svg) {
    return (
      <div
        className={wrapperClass}
        role="img"
        aria-label="Diagram"
        dangerouslySetInnerHTML={{ __html: svg }}
      />
    );
  }

  return (
    <div className={wrapperClass} aria-hidden>
      <span className="block py-6 text-center text-xs text-fg-subtle">
        Rendering diagram…
      </span>
    </div>
  );
}
