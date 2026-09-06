"use client";

import Link from "next/link";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import rehypeSlug from "rehype-slug";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import rehypeHighlight from "rehype-highlight";
import { resolveAssetSrc, resolveDocLink } from "@/lib/links";
import { CodeBlock } from "./CodeBlock";
import { Mermaid } from "./Mermaid";

const remarkPlugins = [remarkGfm];

const rehypePlugins = [
  rehypeRaw,
  rehypeSlug,
  [
    rehypeAutolinkHeadings,
    {
      behavior: "wrap",
      properties: { className: "heading-anchor no-underline" },
    },
  ],
  [rehypeHighlight, { detect: true, ignoreMissing: true, plainText: ["mermaid"] }],
] as const;

function langFromNode(node: unknown): string {
  const el = node as { children?: Array<{ properties?: { className?: unknown } }> };
  const cls = el?.children?.[0]?.properties?.className;
  const list = Array.isArray(cls) ? (cls as string[]) : [];
  const found = list.find((c) => c.startsWith("language-"));
  return found ? found.replace("language-", "") : "";
}

export function Markdown({
  content,
  currentSlug = [],
}: {
  content: string;
  currentSlug?: string[];
}) {
  const components: Components = {
    a({ node: _node, href, children, ...props }) {
      void _node;
      const { href: resolved, external } = resolveDocLink(href, currentSlug);
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

    code({ node: _node, className, children, ...props }) {
      void _node;
      if (className?.includes("language-mermaid")) {
        return <Mermaid chart={String(children).replace(/\n$/, "")} />;
      }
      return (
        <code className={className} {...props}>
          {children}
        </code>
      );
    },

    pre({ children, node }) {
      const lang = langFromNode(node);
      if (lang === "mermaid") return <>{children}</>;
      return <CodeBlock language={lang || "text"}>{children}</CodeBlock>;
    },

    table({ node: _node, children, ...props }) {
      void _node;
      return (
        <div className="not-prose my-6 overflow-x-auto rounded-lg border border-border custom-scroll">
          <table
            className="w-full border-collapse text-left text-[0.85rem] [&_td]:border-t [&_td]:border-border [&_td]:px-3.5 [&_td]:py-2 [&_th]:border-b [&_th]:border-border-strong [&_th]:bg-bg-subtle [&_th]:px-3.5 [&_th]:py-2 [&_th]:font-semibold"
            {...props}
          >
            {children}
          </table>
        </div>
      );
    },

    img({ node: _node, src, ...props }) {
      void _node;
      const resolved = resolveAssetSrc(typeof src === "string" ? src : undefined, currentSlug);
      // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
      return <img loading="lazy" src={resolved} {...props} />;
    },
  };

  return (
    <div className="prose prose-deligo max-w-none">
      <ReactMarkdown
        remarkPlugins={remarkPlugins}
        rehypePlugins={rehypePlugins as never}
        urlTransform={(url) => url}
        components={components}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
