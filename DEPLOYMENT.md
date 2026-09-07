# Deployment — `https://docs.deligo.pt`

Production target for the Deligo engineering documentation portal.

## Architecture

```
                    ┌─────────────────────────────────────────────┐
  Internet  ──TLS──▶ │  Reverse proxy (nginx / Caddy)             │
  docs.deligo.pt     │  - terminates HTTPS (Let's Encrypt)        │
                    │  - proxy_pass → 127.0.0.1:3000            │
                    └───────────────┬─────────────────────────────┘
                                    │  HTTP (loopback only)
                    ┌───────────────▼─────────────────────────────┐
                    │  Node.js: `next start` (port 3000)          │
                    │  - src/proxy.ts gates every request         │
                    │  - renders Markdown from content/docs/**    │
                    └───────────────┬─────────────────────────────┘
                                    │  in-repo, read-only
                    ┌───────────────▼─────────────────────────────┐
                    │  content/docs/**   (committed to this repo) │
                    │  content/changelog.md, content/decisions.md │
                    └─────────────────────────────────────────────┘
```

* **Node server, not static export / not Vercel edge.** Authentication runs in
  `src/proxy.ts` (Next 16 proxy, Node runtime), so the app must run as a real
  Node process (`next start`). `output: export` is impossible; a Node platform
  or a plain VM both work.
* **Documentation ships inside this repository** under `content/`. There is no
  external docs repo, no clone step, and no doc-source environment variable.
  `git pull` + rebuild is the whole content-update path.
* **Content is never exposed as raw files by the running app.** Only rendered
  pages and the session-checked search index are served; there is no route that
  returns Markdown source or `.git`.
* Per-file "last updated" dates and history come from *this* repo's git log, so
  deploy with the `.git` directory present (a normal `git clone`, not a tarball).

## Environment variables (production)

| Variable | Required | Example | Notes |
| --- | --- | --- | --- |
| `NODE_ENV` | yes | `production` | Enables the `Secure` cookie flag. |
| `DOCS_ACCESS_PASSWORD` | yes | *(32+ random chars)* | Shared login password. Distribute out of band. |
| `DOCS_SESSION_SECRET` | yes | `openssl rand -base64 32` | HMAC key for the session cookie. Rotating it logs everyone out. |
| `DOCS_AUTH_VERSION` | yes | `1` | Session epoch (positive integer). Increment to revoke every existing session immediately, without rotating `DOCS_SESSION_SECRET`. |
| `PORT` | no | `3000` | Port for `next start`. |

The three `DOCS_*` values are the only configuration. Put them in the
platform's secret store / a root-only `/etc/deligo-docs.env`, **never** in the
repo. `.env*` (except `.env.example`) is git-ignored. There is no
documentation-source variable — content lives in `content/`.

## DNS

One record, pointing at the server that runs the reverse proxy:

```
docs.deligo.pt.   A     <server-ipv4>
docs.deligo.pt.   AAAA  <server-ipv6>      # if the host has one
```

(Or a `CNAME` to the platform hostname if deploying to a managed Node host.)
No other DNS entries are required. Do not change DNS until the server is up.

## Reverse proxy

TLS is terminated at the proxy; forward the real host and scheme so that
absolute redirects from `proxy.ts` stay on `https://docs.deligo.pt`.

**HSTS is set here, not in the app.** `Strict-Transport-Security` must only ever
be sent over HTTPS, and the app sits behind a plaintext loopback hop, so it
cannot know the external scheme with certainty. The TLS terminator is the right
place. `app/next.config.ts` deliberately omits it.

### nginx

```nginx
server {
    listen 443 ssl http2;
    server_name docs.deligo.pt;

    ssl_certificate     /etc/letsencrypt/live/docs.deligo.pt/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/docs.deligo.pt/privkey.pem;

    # HSTS — 2 years, include subdomains. Add `; preload` only once you are
    # certain every deligo.pt subdomain is HTTPS-only and you have submitted
    # the domain to hstspreload.org.
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains" always;

    location / {
        proxy_pass         http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header   Host              $host;
        proxy_set_header   X-Forwarded-Proto https;
        proxy_set_header   X-Forwarded-Host  $host;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   Upgrade           $http_upgrade;
        proxy_set_header   Connection        "upgrade";
    }
}

server {
    listen 80;
    server_name docs.deligo.pt;
    return 308 https://$host$request_uri;
}
```

> The application already emits `Content-Security-Policy`, `X-Frame-Options`,
> `X-Content-Type-Options` and `Referrer-Policy`; the proxy only needs to add
> HSTS. Do not let the proxy strip or override the app's headers.

### Caddy (equivalent)

```
docs.deligo.pt {
    reverse_proxy 127.0.0.1:3000
    header Strict-Transport-Security "max-age=63072000; includeSubDomains"
}
```

## Platform requirements

* Node.js 20+ and `pnpm` (`corepack enable`).
* `git` on the server — used for per-file "last updated" dates and document
  history. Without it dates fall back to file mtime; nothing breaks.
* A process manager for `next start` (systemd unit or pm2).

## Deploy steps

```bash
# 0. one-time: DNS record, TLS cert (certbot), reverse-proxy vhost, secret file

# 1. get the code (with .git — history powers the "last updated" dates)
git clone <this-repo> /srv/deligo-docs && cd /srv/deligo-docs

# 2. load environment (secrets live here, root-only, not in the repo)
set -a && . /etc/deligo-docs.env && set +a
#   contains NODE_ENV, DOCS_ACCESS_PASSWORD, DOCS_SESSION_SECRET, DOCS_AUTH_VERSION

# 3. install and build
corepack enable
pnpm install --frozen-lockfile
pnpm build

# 4. run (behind the reverse proxy, loopback only)
pnpm start               # next start, PORT=3000
#   or: systemctl start deligo-docs   (see unit below)
```

### systemd unit (`/etc/systemd/system/deligo-docs.service`)

```ini
[Unit]
Description=Deligo docs portal (next start)
After=network.target

[Service]
Type=simple
WorkingDirectory=/srv/deligo-docs
EnvironmentFile=/etc/deligo-docs.env
ExecStart=/usr/bin/pnpm start
Restart=on-failure
User=deligo
Environment=PORT=3000

[Install]
WantedBy=multi-user.target
```

### Updating documentation

Documentation is edited in this repository under `content/` and published by
rebuilding. The `/docs/*` pages are statically generated at build time; the
`/changelog`, `/decisions` and `/api/search-index` routes read `content/` at
request time.

```bash
cd /srv/deligo-docs
git pull                       # brings in new/edited content and any code
pnpm install --frozen-lockfile # only if deps changed
pnpm build
systemctl restart deligo-docs
```

Automate by running the above from CI on every push to the default branch.

## Content system

* Every `*.md` / `*.mdx` file under `content/docs/` becomes a page at
  `/docs/<path-without-extension>`. Folders become sidebar sections (a numeric
  prefix like `03-` sets order and is stripped from the label). Nothing about
  specific files or folders is hardcoded.
* A root `content/docs/README.md` or `index.md`, if present, renders as the
  `/docs` landing page.
* Optional YAML frontmatter is honoured: `title`, `description`, `order`,
  `category`, and `draft: true` / `published: false` to hide a file. Any other
  keys are preserved and available to future features.
* Markdown support: headings, paragraphs, lists, tables, blockquotes, code
  blocks with highlighting, Mermaid (```mermaid fences), links (relative doc
  links are resolved to routes), images, and GFM.
* `content/changelog.md` and `content/decisions.md` feed the Change Log and
  Decision Log; both are optional and their pages show an empty state when the
  file is absent.

## Security / cache behaviour

* Every request passes through `src/proxy.ts`; anonymous → `/login` (or `401`
  for `/api/*`). `/login` is the only public route.
* `/api/search-index` is `force-dynamic` + session-checked; it is never a
  cacheable build artifact.
* `next.config.ts` sends `Cache-Control: private, no-store` + `X-Robots-Tag:
  noindex` on every rendered response; only immutable `/_next/` assets stay
  publicly cacheable. `robots.txt` disallows all.
* `next.config.ts` also sends a strict `Content-Security-Policy` (no
  `unsafe-eval`; `script-src`/`style-src` keep `'unsafe-inline'` — see the note
  in that file), `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, and
  `X-Content-Type-Options: nosniff`. `/docs-assets/*` keeps its own tighter
  per-response CSP. HSTS is added by the reverse proxy (see above).
* Rendered Markdown is sanitised with `rehype-sanitize` (GitHub's default
  schema): embedded raw HTML is limited to a safe tag/attribute set, and
  `javascript:` / `data:` URLs in links and images are stripped.
* Because the whole site is private, the reverse proxy must **not** add its own
  shared/`public` caching for `/` — leave caching to the app.
* Sessions are stateless (no server store). A session cookie / token lasts
  **24 hours** (`SESSION_MAX_AGE_SECONDS`); after that the token's signed `exp`
  fails and the user signs in again.
* Signing out clears the browser's cookie only. It cannot invalidate a token
  that was already copied off the device — that copy stays valid until its 24h
  `exp`. To revoke *everything* immediately (e.g. the shared password leaked, or
  a token was exfiltrated), increment `DOCS_AUTH_VERSION` and restart: every
  token minted under the old value is rejected on its next request.
