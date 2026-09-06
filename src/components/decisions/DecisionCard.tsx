import type { Decision } from "@/types";
import { Badge } from "@/components/ui/Badge";
import { ProseInline } from "@/components/markdown/ProseInline";
import { formatDate } from "@/lib/format";

function statusTone(label: string | null) {
  switch ((label ?? "").toLowerCase()) {
    case "accepted":
      return "success" as const;
    case "superseded":
    case "deprecated":
      return "warning" as const;
    case "proposed":
      return "info" as const;
    default:
      return "neutral" as const;
  }
}

const SECONDARY_SECTIONS: { key: keyof Decision; label: string }[] = [
  { key: "reason", label: "Reason" },
  { key: "alternatives", label: "Alternatives" },
  { key: "consequences", label: "Consequences" },
];

export function DecisionCard({ decision }: { decision: Decision }) {
  const from = ["10-decision-log"];

  return (
    <article
      id={decision.id}
      className="scroll-mt-32 border-t border-border pt-9 first:border-t-0 first:pt-0"
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <time
          dateTime={decision.date}
          className="font-mono text-xs tabular-nums text-fg-subtle"
        >
          {formatDate(decision.date)}
        </time>
        {decision.status && (
          <Badge tone={statusTone(decision.statusLabel)}>
            {decision.status.length > 38
              ? (decision.statusLabel ?? decision.status)
              : decision.status}
          </Badge>
        )}
      </div>

      <h2 className="mt-2.5 text-[1.2rem] leading-snug font-semibold tracking-tight text-fg text-balance">
        <a href={`#${decision.id}`} className="hover:text-accent">
          {decision.title}
        </a>
      </h2>

      {decision.affectedModules.length > 0 && (
        <ul className="mt-2.5 flex flex-wrap gap-1.5">
          {decision.affectedModules.map((m) => (
            <li
              key={m}
              className="rounded border border-border bg-bg-subtle px-1.5 py-0.5 text-[0.6875rem] text-fg-muted"
            >
              {m}
            </li>
          ))}
        </ul>
      )}

      {(decision.context || decision.problem) && (
        <div className="mt-5 space-y-3">
          {decision.context && (
            <Field label="Context">
              <ProseInline content={decision.context} from={from} />
            </Field>
          )}
          {decision.problem && (
            <Field label="Problem">
              <ProseInline content={decision.problem} from={from} />
            </Field>
          )}
        </div>
      )}

      {decision.decision && (
        <div className="mt-5 rounded-xl border border-accent-border bg-accent-subtle/60 p-4">
          <p className="mb-1.5 flex items-center gap-1.5 text-[0.6875rem] font-semibold tracking-[0.12em] text-accent uppercase">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M20 6 9 17l-5-5" />
            </svg>
            Decision
          </p>
          <ProseInline content={decision.decision} from={from} className="text-fg" />
        </div>
      )}

      {SECONDARY_SECTIONS.some(({ key }) => decision[key]) && (
        <dl className="mt-5 space-y-4">
          {SECONDARY_SECTIONS.map(({ key, label }) => {
            const value = decision[key] as string | null;
            if (!value) return null;
            return (
              <div key={key}>
                <dt className="text-[0.6875rem] font-semibold tracking-[0.12em] text-fg-subtle uppercase">
                  {label}
                </dt>
                <dd className="mt-1.5">
                  <ProseInline content={value} from={from} />
                </dd>
              </div>
            );
          })}
        </dl>
      )}

      {decision.sourceReferences && (
        <details className="group mt-5">
          <summary className="inline-flex cursor-pointer items-center gap-1.5 text-xs font-medium text-fg-subtle transition-colors select-none hover:text-fg-muted">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="transition-transform group-open:rotate-90" aria-hidden>
              <path d="m9 6 6 6-6 6" />
            </svg>
            Source references
          </summary>
          <div className="mt-2.5 border-l-2 border-border pl-4">
            <ProseInline content={decision.sourceReferences} from={from} />
          </div>
        </details>
      )}
    </article>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-[0.6875rem] font-semibold tracking-[0.12em] text-fg-subtle uppercase">
        {label}
      </p>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}
