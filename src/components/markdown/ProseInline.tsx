import Link from "next/link";
import Markdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/cn";
import { resolveDocLink } from "@/lib/links";

const remarkPlugins = [remarkGfm];

/**
 * Compact markdown for short rich-text fields (Change Log descriptions, Decision
 * Log sections). Rendered on the **server** — `react-markdown`'s default export
 * is synchronous and hook-free — so these pages ship no markdown runtime to the
 * client. No raw HTML, no code fences, no diagrams (the log bodies contain
 * none); links to other docs are still rewritten to site routes.
 */
export function ProseInline({
  content,
  from = [],
  className,
}: {
  content: string;
  from?: string[];
  className?: string;
}) {
  const components: Components = {
    a({ node: _node, href, children, ...props }) {
      void _node;
      const { href: resolved, external } = resolveDocLink(href, from);
      if (external) {
        return (
          <a href={resolved} target="_blank" rel="noopener noreferrer" {...props}>
            {children}
          </a>
        );
      }
      return (
        <Link href={resolved} {...props}>
          {children}
        </Link>
      );
    },
  };

  return (
    <div className={cn("prose-inline", className)}>
      <Markdown
        remarkPlugins={remarkPlugins}
        urlTransform={(url: string) => url}
        components={components}
      >
        {content}
      </Markdown>
    </div>
  );
}
