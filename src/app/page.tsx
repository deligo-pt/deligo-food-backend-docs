import Link from "next/link";
import type { ReactNode } from "react";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { HomeSearch } from "@/components/home/HomeSearch";
import { LinkCard } from "@/components/ui/LinkCard";
import { Badge, toneForType } from "@/components/ui/Badge";
import {
  docsAvailable,
  getAllDocs,
  getDocCategories,
  getRecentlyUpdatedDocs,
} from "@/lib/docs";
import { getChangelogEntries } from "@/lib/changelog";
import { getDecisions } from "@/lib/decisions";
import { formatDate, sectionLabel } from "@/lib/format";
import { SITE } from "@/lib/config";

const QUICK_ACCESS_ICONS = [
  <IconTerminal key="0" />,
  <IconDatabase key="1" />,
  <IconPlug key="2" />,
  <IconServer key="3" />,
];

export default function HomePage() {
  const available = docsAvailable();
  const categories = available ? getDocCategories() : [];
  const recentChanges = available ? getChangelogEntries().slice(0, 5) : [];
  const recentlyUpdated = available ? getRecentlyUpdatedDocs(5) : [];
  const changeCount = available ? getChangelogEntries().length : 0;
  const decisionCount = available ? getDecisions().length : 0;
  const docCount = available ? getAllDocs().length : 0;
  const hasDocs = docCount > 0;

  // Quick-access cards are the first document of each of the first few folders —
  // no document names are hardcoded.
  const quickAccess = categories
    .filter((cat) => cat.docs[0])
    .slice(0, 4)
    .map((cat, i) => ({
      label: sectionLabel(cat.slug, cat.label),
      doc: cat.docs[0],
      icon: QUICK_ACCESS_ICONS[i],
    }));

  return (
    <div className="flex min-h-full flex-col">
      <Header />

      <main
        id="main-content"
        className="mx-auto w-full max-w-6xl flex-1 px-4 py-12 sm:px-6 sm:py-14"
      >
        {/* Identity */}
        <section className="animate-fade-in-up max-w-2xl">
          <p className="flex items-center gap-2 text-[0.6875rem] font-semibold tracking-[0.16em] text-fg-subtle uppercase">
            <span className="size-1.5 rounded-full bg-accent" aria-hidden />
            Internal Engineering Portal
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-fg text-balance sm:text-[2.5rem] sm:leading-[1.1]">
            Deligo Engineering
          </h1>
          <p className="mt-3.5 text-[0.975rem] leading-relaxed text-fg-muted text-pretty">
            {SITE.description}
          </p>

          <div className="mt-6">
            <HomeSearch />
          </div>

          {available && (
            <dl className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-xs text-fg-subtle">
              <Stat value={docCount} label="documents" />
              <Stat value={changeCount} label="logged changes" />
              <Stat value={decisionCount} label="decisions" />
            </dl>
          )}
        </section>

        {(!available || (!hasDocs && changeCount === 0 && decisionCount === 0)) && (
          <p className="mt-10 rounded-lg border border-dashed border-border bg-bg-subtle p-4 text-sm text-fg-muted">
            No documentation yet. Add Markdown files under{" "}
            <code className="rounded bg-bg-inset px-1 py-0.5">content/docs/</code>{" "}
            and they will be discovered and rendered automatically.
          </p>
        )}

        {available && (hasDocs || changeCount > 0 || decisionCount > 0) && (
          <>
            {/* Quick access */}
            {quickAccess.length > 0 && (
              <section className="mt-14">
                <SectionHeading>Quick access</SectionHeading>
                <div className="stagger mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {quickAccess.map((item) => (
                    <LinkCard
                      key={item.doc.href}
                      href={item.doc.href}
                      eyebrow={item.label}
                      icon={item.icon}
                      title={item.doc.title}
                      description={item.doc.description}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Categories + activity */}
            <div className="mt-14 grid gap-x-12 gap-y-10 lg:grid-cols-[minmax(0,1fr)_19rem]">
              {hasDocs && (
              <section>
                <SectionHeading>Documentation categories</SectionHeading>
                <ul className="mt-4 divide-y divide-border overflow-hidden rounded-xl border border-border">
                  {categories.map((cat) => (
                    <li key={cat.slug}>
                      <Link
                        href={cat.docs[0]?.href ?? "/docs"}
                        className="group flex items-center gap-4 px-4 py-3 transition-colors hover:bg-bg-subtle"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="text-sm font-medium text-fg group-hover:text-accent">
                            {sectionLabel(cat.slug, cat.label)}
                          </span>
                          <span className="mt-0.5 line-clamp-1 text-xs text-fg-subtle">
                            {cat.docs.map((d) => d.title).join(" · ")}
                          </span>
                        </span>
                        <span className="shrink-0 text-[0.6875rem] tabular-nums text-fg-subtle">
                          {cat.docs.length}
                        </span>
                        <ChevIcon className="shrink-0 text-fg-subtle transition-transform group-hover:translate-x-0.5" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
              )}

              <aside className="flex flex-col gap-9">
                <section>
                  <div className="flex items-baseline justify-between">
                    <SectionHeading>Recent changes</SectionHeading>
                    <Link
                      href="/changelog"
                      className="text-xs font-medium text-accent transition-opacity hover:opacity-80"
                    >
                      All entries →
                    </Link>
                  </div>
                  <ul className="mt-4 flex flex-col">
                    {recentChanges.length === 0 && (
                      <li className="py-2 text-[0.8125rem] text-fg-subtle">
                        No entries yet.
                      </li>
                    )}
                    {recentChanges.map((entry) => (
                      <li key={entry.id}>
                        <Link
                          href={`/changelog#${entry.id}`}
                          className="group -mx-2 block rounded-lg px-2 py-2.5 transition-colors hover:bg-bg-subtle"
                        >
                          <span className="flex items-center gap-2 text-[0.6875rem] text-fg-subtle">
                            <time dateTime={entry.date} className="tabular-nums">
                              {formatDate(entry.date)}
                            </time>
                            {entry.type && (
                              <Badge tone={toneForType(entry.type)}>
                                {entry.type}
                              </Badge>
                            )}
                          </span>
                          <span className="mt-1 line-clamp-2 text-[0.8125rem] leading-snug text-fg-muted group-hover:text-fg">
                            {entry.title}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>

                {recentlyUpdated.length > 0 && (
                  <section>
                    <SectionHeading>Recently updated</SectionHeading>
                    <ul className="mt-4 flex flex-col gap-0.5">
                      {recentlyUpdated.map((doc) => (
                        <li key={doc.href}>
                          <Link
                            href={doc.href}
                            className="group -mx-2 flex items-baseline justify-between gap-3 rounded-lg px-2 py-1.5 transition-colors hover:bg-bg-subtle"
                          >
                            <span className="line-clamp-1 text-[0.8125rem] text-fg-muted group-hover:text-accent">
                              {doc.title}
                            </span>
                            <time
                              dateTime={doc.lastModified ?? undefined}
                              className="shrink-0 text-[0.6875rem] tabular-nums text-fg-subtle"
                            >
                              {formatDate(doc.lastModified)}
                            </time>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
              </aside>
            </div>

            {/* Logs */}
            <section className="mt-14 grid gap-3 sm:grid-cols-2">
              <LinkCard
                href="/changelog"
                eyebrow="Change Log"
                icon={<IconHistory />}
                title="What changed and when"
                description={`${changeCount} curated entries with date, module, type and status filters kept in the URL.`}
              />
              <LinkCard
                href="/decisions"
                eyebrow="Decision Log"
                icon={<IconCompass />}
                title="Why it was built this way"
                description={`${decisionCount} architectural decisions with context, alternatives and consequences.`}
              />
            </section>
          </>
        )}
      </main>

      <Footer />
    </div>
  );
}

function SectionHeading({ children }: { children: ReactNode }) {
  return (
    <h2 className="text-[0.6875rem] font-semibold tracking-[0.14em] text-fg-subtle uppercase">
      {children}
    </h2>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="text-sm font-semibold tabular-nums text-fg">{value}</span>
      <span>{label}</span>
    </div>
  );
}

/* --- icons --- */
function ChevIcon({ className }: { className?: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}
function IconTerminal() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="m4 17 6-6-6-6M12 19h8" />
    </svg>
  );
}
function IconDatabase() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <ellipse cx="12" cy="5" rx="8" ry="3" />
      <path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" />
    </svg>
  );
}
function IconPlug() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 22v-5M9 8V2M15 8V2M5 8h14v3a7 7 0 0 1-14 0V8Z" />
    </svg>
  );
}
function IconServer() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="4" width="18" height="7" rx="1.5" />
      <rect x="3" y="13" width="18" height="7" rx="1.5" />
      <path d="M7 7.5h.01M7 16.5h.01" />
    </svg>
  );
}
function IconHistory() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 3v6h6M3.5 9a9 9 0 1 0 2.3-3.3L3 9M12 7v5l4 2" />
    </svg>
  );
}
function IconCompass() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="m16 8-2 6-6 2 2-6 6-2Z" />
    </svg>
  );
}
