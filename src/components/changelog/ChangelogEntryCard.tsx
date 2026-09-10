import Link from "next/link";
import type { ChangelogEntry } from "@/types";
import { Badge, toneForType } from "@/components/ui/Badge";
import { ProseInline } from "@/components/markdown/ProseInline";
import { formatDate } from "@/lib/format";
import { parseRelatedDocs } from "@/lib/related";

export function ChangelogEntryCard({ entry }: { entry: ChangelogEntry }) {
  const related = parseRelatedDocs(entry.relatedDocs, ["09-change-log"]);

  return (
    <article id={entry.id} className="scroll-mt-32">
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-2">
        <time
          dateTime={entry.date}
          className="font-mono text-xs tabular-nums text-fg-subtle"
        >
          {formatDate(entry.date)}
        </time>
        {entry.type && <Badge tone={toneForType(entry.type)}>{entry.type}</Badge>}
        {entry.status && <Badge tone="neutral">{entry.status}</Badge>}
        {entry.breaking && <Badge tone="danger">Breaking</Badge>}
      </div>

      <h3 className="mt-2.5 text-[1.05rem] leading-snug font-semibold tracking-tight text-fg text-balance">
        <a href={`#${entry.id}`} className="hover:text-accent">
          {entry.title}
        </a>
      </h3>

      {entry.modules.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {entry.modules.map((m) => (
            <li
              key={m}
              className="rounded border border-border bg-bg-subtle px-1.5 py-0.5 text-[0.6875rem] text-fg-muted"
            >
              {m}
            </li>
          ))}
        </ul>
      )}

      {entry.description && (
        <ProseInline
          className="mt-3.5"
          content={entry.description}
          from={["09-change-log"]}
        />
      )}

      {entry.technicalChanges.length > 0 && (
        <details className="group mt-3.5">
          <summary className="inline-flex cursor-pointer items-center gap-1.5 rounded-md text-xs font-medium text-fg-subtle transition-colors select-none hover:text-fg-muted">
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="transition-transform group-open:rotate-90"
              aria-hidden
            >
              <path d="m9 6 6 6-6 6" />
            </svg>
            {entry.technicalChanges.length} technical change
            {entry.technicalChanges.length === 1 ? "" : "s"}
          </summary>
          <ul className="mt-3 space-y-1.5 border-l-2 border-border pl-4 text-[0.8125rem] leading-relaxed text-fg-muted">
            {entry.technicalChanges.map((change, i) => (
              <li
                key={i}
                className="[&_code]:rounded [&_code]:bg-bg-inset [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[0.85em]"
              >
                <InlineCode text={change} />
              </li>
            ))}
          </ul>
        </details>
      )}

      {(entry.commit || entry.pullRequest || related.links.length > 0 || related.note) && (
        <dl className="mt-4 flex flex-col gap-1.5 text-xs">
          {entry.commit && (
            <MetaRow label="Commit">
              <code className="rounded bg-bg-inset px-1.5 py-0.5 font-mono text-[0.6875rem] text-fg-muted">
                {entry.commit}
              </code>
            </MetaRow>
          )}
          {entry.pullRequest && (
            <MetaRow label="Pull request">
              <PrLink value={entry.pullRequest} />
            </MetaRow>
          )}
          {(related.links.length > 0 || related.note) && (
            <MetaRow label="Related docs">
              <span className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
                {related.links.map((l) => (
                  <Link
                    key={l.href}
                    href={l.href}
                    className="rounded border border-border bg-bg-subtle px-1.5 py-0.5 text-[0.6875rem] font-medium text-fg-muted transition-colors hover:border-accent-border hover:text-accent"
                  >
                    {l.label}
                  </Link>
                ))}
                {related.note && (
                  <span className="text-fg-subtle">{related.note}</span>
                )}
              </span>
            </MetaRow>
          )}
        </dl>
      )}
    </article>
  );
}

function MetaRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-2.5">
      <dt className="w-24 shrink-0 pt-0.5 font-medium tracking-wide text-fg-subtle uppercase">
        {label}
      </dt>
      <dd className="min-w-0 flex-1">{children}</dd>
    </div>
  );
}

function PrLink({ value }: { value: string }) {
  const url = /^https?:\/\//i.test(value) ? value : null;
  if (url) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-accent underline decoration-accent-border underline-offset-2 hover:decoration-accent"
      >
        {value}
      </a>
    );
  }
  return <span className="text-fg-muted">{value}</span>;
}

/** Render single-backtick spans as <code> without a full markdown pass. */
function InlineCode({ text }: { text: string }) {
  const parts = text.split(/(`[^`]+`)/g);
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith("`") && part.endsWith("`") ? (
          <code key={i}>{part.slice(1, -1)}</code>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}
