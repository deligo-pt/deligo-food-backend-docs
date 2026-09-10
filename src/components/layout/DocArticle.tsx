import type { ReactNode } from "react";
import type { TocItem } from "@/types";
import { TableOfContents } from "./TableOfContents";


export function DocArticle({
  toc = [],
  children,
}: {
  toc?: TocItem[];
  children: ReactNode;
}) {
  const hasToc = toc.length >= 2;

  return (
    <div
      className={
        "mx-auto grid w-full max-w-6xl grid-cols-1 gap-x-12 gap-y-8 px-4 py-9 sm:px-8 xl:py-12 " +
        (hasToc ? "xl:grid-cols-[minmax(0,1fr)_14rem]" : "")
      }
    >
      <article className="w-full max-w-180 min-w-0">{children}</article>

      {hasToc && (
        <aside className="hidden xl:block">
          <div className="sticky top-20 max-h-[calc(100dvh-6rem)] overflow-y-auto pb-8 custom-scroll">
            <TableOfContents items={toc} />
          </div>
        </aside>
      )}
    </div>
  );
}
