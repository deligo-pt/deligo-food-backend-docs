# Deligo Engineering — Documentation Website

Internal, authenticated documentation portal for the **Deligo food-delivery
platform**.

Documentation content lives in **this repository** under `content/` and is
rendered directly — there is no separate docs repo and no sync step.

Production target: `https://docs.deligo.pt` (private — the whole site is behind
a shared-password session; see `DEPLOYMENT.md`).

---

## Stack

| Concern | Choice |
| --- | --- |
| Framework | Next.js 16 (App Router) + React 19 |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS v4 + `@tailwindcss/typography` |
| Markdown | `react-markdown` + `remark-gfm` + `rehype-raw` / `rehype-slug` / `rehype-autolink-headings` / `rehype-highlight`; frontmatter via `gray-matter` |
| Diagrams | `mermaid` (rendered client-side from ```` ```mermaid ```` blocks) |
| Theme | `next-themes` (light / dark / system, persisted) |
| Auth | stateless HMAC-signed session cookie + Next 16 `proxy.ts` gate |

---

## Getting started

```bash
pnpm install
cp .env.example .env.local     # set DOCS_ACCESS_PASSWORD / DOCS_SESSION_SECRET / DOCS_AUTH_VERSION
pnpm dev                       # http://localhost:3000
```

Add documentation as Markdown under `content/docs/`. The repo ships with that
directory empty.

### Scripts

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Development server |
| `pnpm build` | Production build (statically renders every doc page) |
| `pnpm start` | Serve the production build |
| `pnpm lint` | ESLint |
| `pnpm typecheck` | `tsc --noEmit` |

---

## Environment variables

| Variable | Required | Description |
| --- | --- | --- |
| `DOCS_ACCESS_PASSWORD` | Yes | Shared password for the `/login` page. |
| `DOCS_SESSION_SECRET` | Yes | HMAC key (≥16 chars) that signs the session cookie. |
| `DOCS_AUTH_VERSION` | Yes | Positive integer session epoch; increment to revoke all sessions. |

Any missing/invalid value keeps the site locked (fails closed). `.env.local` is
git-ignored; `.env.example` is committed. There is no documentation-source
variable.

---

## Content system

```
content/
  docs/            every *.md / *.mdx, discovered recursively
  changelog.md     optional — feeds /changelog
  decisions.md     optional — feeds /decisions
```

- **Discovery** — `lib/docs.ts` walks `content/docs/`. Each file becomes a page
  at `/docs/<path-without-extension>`; each top-level folder becomes a sidebar
  section. A leading numeric prefix (`03-modules`) orders the section and is
  stripped from its label. No file or folder names are hardcoded.
- **Overview** — a root `content/docs/README.md` or `index.md`, if present,
  renders as the `/docs` landing page.
- **Frontmatter** (optional, YAML) — `title`, `description`, `order`,
  `category`, `draft: true` / `published: false`. Unknown keys are preserved on
  `DocMeta.frontmatter` for future use.
- **Markdown** — headings, paragraphs, lists, tables, blockquotes, code blocks
  (highlighted), Mermaid, links (relative `.md` links resolve to routes),
  images, GFM.
- **Change Log / Decision Log** — parsed from the two convention files by
  `lib/changelog.ts` / `lib/decisions.ts`; filters live in the URL so a filtered
  view is server-rendered and shareable.
- **Search** — `GET /api/search-index` (authenticated, dynamic) returns a JSON
  index built from every source; the client fetches it once and ranks locally.

### Git history

`lib/git.ts` reads *this* repo's history:

- `getLastCommit(file)` / `getLastModified(file)` — the "last updated" line on
  each page (falls back to filesystem mtime, then nothing — never fabricated).
- `getFileHistory(file)` — full per-file commit list (`DocCommit[]`).
- `getChangedDocPaths()` — content files that differ from `HEAD` in the working
  tree (changed-document detection).

These back a future "View changes" / diff view; `DocMeta` carries `lastCommit`
and `getDocHistory(slug)` exposes the list. No diff UI is built yet.
