import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import { toString as mdToString } from "mdast-util-to-string";
import GithubSlugger from "github-slugger";
import type { Root, RootContent } from "mdast";
import type { TocItem } from "@/types";

function parse(markdown: string): Root {
  return unified().use(remarkParse).use(remarkGfm).parse(markdown) as Root;
}

/** The document's first level-1 heading, or null. */
export function getTitle(markdown: string): string | null {
  const tree = parse(markdown);
  for (const node of tree.children) {
    if (node.type === "heading" && node.depth === 1) {
      const text = mdToString(node).trim();
      if (text) return text;
    }
  }
  return null;
}

/**
 * Remove the leading level-1 heading (the title is rendered from metadata).
 * Tolerates a BOM and blank lines before it — e.g. the newline gray-matter
 * leaves after a frontmatter block — so a doc never shows its title twice.
 */
export function stripTitle(markdown: string): string {
  return markdown.replace(/^﻿?\s*#[ \t]+.+(?:\r?\n)+/, "");
}

/** First real paragraph as collapsed plain text, capped at ~`max` chars. */
export function firstParagraph(markdown: string, max = 240): string | null {
  const tree = parse(markdown);
  for (const node of tree.children) {
    if (node.type === "paragraph") {
      const text = mdToString(node).replace(/\s+/g, " ").trim();
      if (!text) continue;
      return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
    }
  }
  return null;
}

/**
 * Headings (depth 2–3) as a table of contents. The slug algorithm matches
 * `rehype-slug` (both use github-slugger) so anchors line up with the rendered
 * DOM ids.
 */
export function extractToc(markdown: string): TocItem[] {
  const tree = parse(markdown);
  const slugger = new GithubSlugger();
  const items: TocItem[] = [];
  for (const node of tree.children as RootContent[]) {
    if (node.type !== "heading") continue;
    if (node.depth < 2 || node.depth > 3) continue;
    const text = mdToString(node).trim();
    if (!text) continue;
    items.push({ depth: node.depth, text, id: slugger.slug(text) });
  }
  return items;
}

/**
 * Full plain-text extraction for the search index.
 *
 * `mdast-util-to-string` concatenates every text node with no separator, so a
 * heading run straight into the next paragraph ("OverviewThe core flow…").
 * Walk the block structure instead and join blocks with a space so search
 * excerpts read as real sentences.
 */
export function toPlainText(markdown: string): string {
  const tree = parse(markdown);
  return blocksToText(tree.children as RootContent[])
    .replace(/\s+/g, " ")
    .trim();
}

function blocksToText(nodes: RootContent[]): string {
  const parts: string[] = [];
  for (const node of nodes) {
    switch (node.type) {
      case "code":
        // Keep real code (identifiers are searchable) but drop Mermaid source:
        // its diagram/arrow syntax is noise in search excerpts.
        if (node.lang !== "mermaid") parts.push(node.value);
        break;
      case "heading":
      case "paragraph":
      case "blockquote":
        parts.push(mdToString(node));
        break;
      case "list":
        for (const item of node.children) parts.push(mdToString(item));
        break;
      case "table":
        for (const row of node.children) {
          parts.push(row.children.map((cell) => mdToString(cell)).join(" "));
        }
        break;
      default:
        if ("children" in node && Array.isArray(node.children)) {
          parts.push(blocksToText(node.children as RootContent[]));
        }
    }
  }
  return parts.filter(Boolean).join(" ");
}

/** All heading texts (any depth) — used to weight search matches. */
export function allHeadings(markdown: string): string[] {
  const tree = parse(markdown);
  const out: string[] = [];
  for (const node of tree.children) {
    if (node.type === "heading") {
      const text = mdToString(node).trim();
      if (text) out.push(text);
    }
  }
  return out;
}
