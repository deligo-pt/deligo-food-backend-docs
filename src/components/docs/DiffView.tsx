import { Fragment } from "react";
import type { DiffLineKind, DocDiff } from "@/types";
import { formatDate } from "@/lib/format";


export function DiffView({ diff }: { diff: DocDiff }) {
  const { commit } = diff;

  return (
    <div className="not-prose">
      <div className="mb-5 rounded-xl border border-border bg-bg-subtle p-4">
        <p className="text-sm font-medium text-fg">
          {commit.subject || "(no commit subject)"}
        </p>
        <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-fg-subtle">
          <code className="font-mono text-fg-muted">{commit.shortHash}</code>
          <span aria-hidden>·</span>
          <span>{commit.author}</span>
          <span aria-hidden>·</span>
          <time dateTime={commit.date}>{formatDate(commit.date)}</time>
          <span aria-hidden>·</span>
          <span>
            {diff.parentShortHash ? (
              <>
                compared with parent{" "}
                <code className="font-mono text-fg-muted">
                  {diff.parentShortHash}
                </code>
              </>
            ) : (
              "initial commit — whole file shown as added"
            )}
          </span>
        </p>
      </div>

      {diff.added && diff.parentShortHash && (
        <p className="mb-4 text-xs text-fg-subtle">
          This file was added in this commit.
        </p>
      )}

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full border-collapse font-mono text-[0.8125rem] leading-relaxed">
          <tbody>
            {diff.hunks.map((hunk, hi) => (
              <Fragment key={hi}>
                <tr className="bg-bg-inset text-fg-subtle">
                  <td colSpan={2} className="border-r border-border" />
                  <td className="px-3 py-1 whitespace-pre-wrap">
                    {`@@ -${hunk.oldStart},${hunk.oldLines} +${hunk.newStart},${hunk.newLines} @@`}
                    {hunk.section ? `  ${hunk.section}` : ""}
                  </td>
                </tr>
                {hunk.lines.map((line, li) => (
                  <tr key={li} className={rowClass(line.kind)}>
                    <td className="w-[1%] border-r border-border px-2 py-0.5 text-right align-top tabular-nums text-fg-subtle select-none">
                      {line.oldLine ?? ""}
                    </td>
                    <td className="w-[1%] border-r border-border px-2 py-0.5 text-right align-top tabular-nums text-fg-subtle select-none">
                      {line.newLine ?? ""}
                    </td>
                    <td className="py-0.5 pr-3 pl-3 align-top break-words whitespace-pre-wrap">
                      <span className={markerClass(line.kind)} aria-hidden>
                        {marker(line.kind)}{" "}
                      </span>
                      {line.text || " "}
                    </td>
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {diff.truncated && (
        <p className="mt-4 text-xs text-fg-subtle">
          This change is larger than the display limit and has been truncated.
        </p>
      )}
    </div>
  );
}

function rowClass(kind: DiffLineKind): string {
  if (kind === "add") return "bg-success-subtle";
  if (kind === "del") return "bg-danger-subtle";
  return "";
}

function markerClass(kind: DiffLineKind): string {
  if (kind === "add") return "text-success select-none";
  if (kind === "del") return "text-danger select-none";
  return "text-fg-subtle select-none";
}

function marker(kind: DiffLineKind): string {
  if (kind === "add") return "+";
  if (kind === "del") return "-";
  return " ";
}
