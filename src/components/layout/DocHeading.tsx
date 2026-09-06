import type { DocMeta } from "@/types";
import { formatDate } from "@/lib/format";
import { Breadcrumbs, type Crumb } from "./Breadcrumbs";

export function DocHeading({
  crumbs,
  title,
  description,
  meta,
}: {
  crumbs: Crumb[];
  title: string;
  description?: string | null;
  meta?: Pick<
    DocMeta,
    "lastModified" | "lastModifiedSource" | "category" | "relPath"
  >;
}) {
  const date = formatDate(meta?.lastModified);

  return (
    <header className="mb-9">
      <Breadcrumbs items={crumbs} />
      <h1 className="mt-3.5 text-[1.9rem] leading-[1.15] font-semibold tracking-tight text-fg text-balance sm:text-[2.15rem]">
        {title}
      </h1>
      {description && (
        <p className="mt-3.5 text-[1.0125rem] leading-relaxed text-fg-muted text-pretty">
          {description}
        </p>
      )}

      {(date || meta?.relPath) && (
        <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-fg-subtle">
          {date && (
            <span className="inline-flex items-center gap-1.5">
              <ClockIcon />
              <span>
                {meta?.lastModifiedSource === "git"
                  ? "Last updated"
                  : "File modified"}{" "}
                <time dateTime={meta?.lastModified ?? undefined} className="text-fg-muted">
                  {date}
                </time>
              </span>
            </span>
          )}
          {meta?.relPath && (
            <span className="inline-flex items-center gap-1.5">
              <FileIcon />
              <code className="font-mono text-[0.6875rem] text-fg-subtle">
                {meta.relPath}
              </code>
            </span>
          )}
        </div>
      )}
    </header>
  );
}

function ClockIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

function FileIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M14 3v4a1 1 0 0 0 1 1h4" />
      <path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2Z" />
    </svg>
  );
}
