# ContribScope

> README-ready GitHub contributor images for any scope — one repo, many repos, an organization, or a user. Runs on Cloudflare Workers.

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/RlxChap2/contribscope)
[![CI](https://github.com/RlxChap2/contribscope/actions/workflows/ci.yml/badge.svg)](https://github.com/RlxChap2/contribscope/actions/workflows/ci.yml)
[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

ContribScope is a small TypeScript service that generates contributor avatar grids as SVGs. Unlike single-repo tools, it **deduplicates contributors across repositories** and sums their contribution counts.

## Why

- **Any scope** — single repo, multiple repos, an org, or a user's public projects
- **Deduplicated** — contributors that span repos appear once, with summed counts
- **Edge-rendered** — Cloudflare Workers + Hono, sub-second responses
- **Customizable** — size, shape, columns, limit, sort, bot filtering
- **README-friendly** — returns SVG, perfect for `<img>` tags

## Quick examples

```md
![React contributors](https://your-domain.com/image?repo=facebook/react)
```

```md
![Next.js stack contributors](https://your-domain.com/image?repos=vercel/next.js,vercel/swr)
```

```md
![Vercel org contributors](https://your-domain.com/image?org=vercel&limit=48)
```

```md
![sindresorhus contributors](https://your-domain.com/image?user=sindresorhus&limit=24)
```

## Web UI

Open the deployed URL in a browser and you get a dark-themed playground where you can:

- Switch between repo / repos / org / user modes
- Tweak limit, avatar size, and shape
- Copy the generated image URL
- Add a personal GitHub token (stored only in your browser)
- See real error messages (rate limit, not found, etc.)

## API

`GET /image?<params>`

Returns `image/svg+xml`. CORS-open, cacheable.

| Parameter | Type | Default | Description |
| --- | --- | --- | --- |
| `repo` | `owner/name` | — | Single repository. Repeatable. |
| `repos` | `owner/name,...` | — | Comma-separated repositories. |
| `org` | `string` | — | GitHub organization. Public repos are scanned. |
| `user` | `string` | — | GitHub username. Public owner repos are scanned. |
| `limit` | `int` | `100` | Max contributors. Range `1`–`200`. |
| `max_repos` | `int` | `100` | Max repos to scan for `org` / `user`. Range `1`–`500`. |
| `size` | `int` | `64` | Avatar pixel size. Range `24`–`128`. |
| `columns` | `int` | `12` | Avatars per row. Range `1`–`24`. |
| `gap` | `int` | `4` | Pixel gap between avatars. Range `0`–`24`. |
| `shape` | `rounded` / `circle` / `square` | `rounded` | Avatar shape. |
| `sort` | `contributions` / `repos` / `login` | `contributions` | Sort key. |
| `show_names` | `bool` | `false` | Render usernames under avatars. |
| `include_forks` | `bool` | `false` | Include forked repos in `org` / `user` scope. |
| `exclude_bots` | `bool` | `true` | Filter bot accounts. |
| `embed` | `bool` | `true` | Embed avatar bytes into the SVG (slower request, fully offline). |

Exactly one source is required: `repo`/`repos`, `org`, or `user`.

### Errors

| Status | `X-Error-Kind` | When |
| --- | --- | --- |
| `400` | `bad_request` | Missing or malformed input. |
| `401` | `unauthorized` | GitHub rejected the token. |
| `404` | `not_found` | Repo / org / user does not exist or is private. |
| `429` | `rate_limit` | GitHub rate limit hit. Resets at `X-Rate-Limit-Reset`. |
| `502` | `forbidden` / `network` / `unknown` | Upstream issue. |

The body of every error is still a valid SVG with the message, so it renders gracefully when embedded.

## GitHub tokens

GitHub limits unauthenticated requests to **60/hour per IP**. With a token, the limit is **5,000/hour per token**.

ContribScope supports two ways to provide a token:

### 1. Per-visitor token (recommended for public deployments)

Visitors click **"Add token"** in the web UI and paste their own [fine-grained read-only token](https://github.com/settings/personal-access-tokens/new). The token is:

- Stored only in their browser's `localStorage`
- Sent as the `X-GitHub-Token` header on preview requests
- **Never logged, persisted, or exposed in URLs**

Each visitor's quota is their own. This scales infinitely.

### 2. Server-side token (private/internal deployments)

Set `GITHUB_TOKEN` as a secret on your Worker:

```bash
wrangler secret put GITHUB_TOKEN
```

When set, this token is used as a **fallback** for visitors who haven't added their own.

> [!WARNING]
> For a **public** deployment, leaving `GITHUB_TOKEN` unset is safer.
> A shared server token gets exhausted quickly under traffic, and any
> abuse of your deployment is attributed to your GitHub account.

## Security model

- Tokens are accepted only via the `X-GitHub-Token` (or `Authorization: Bearer`) header — **never** via query string. Requests that include `token`, `access_token`, `github_token`, `auth`, `apikey`, or `api_key` as query parameters are rejected with `400 bad_request`, since the URL itself is captured by browser history, access logs, and shared caches.
- The server never logs the token contents (no `console.log` of credentials anywhere).
- Token-bearing responses are marked `Cache-Control: private` so they never share a cache entry across users.
- The HTML page sets a strict Content-Security-Policy (no third-party scripts, `frame-ancestors 'none'`, `base-uri 'self'`, `form-action 'self'`).
- Browser-side, the token sits in `localStorage` under `contribscope.token`. Clear it via **"Add token" → Clear**.
- Found a vulnerability? See [SECURITY.md](SECURITY.md).

## Local development

```bash
pnpm install
pnpm dev
```

Open <http://localhost:8787>. The image endpoint is at `/image`. The Worker also exposes `/health`.

> The local dev server runs without `GITHUB_TOKEN` — you'll hit the 60/hr unauthenticated limit fast. Add a token via the **"Add token"** button to test against the 5,000/hr limit.

## Tests

```bash
pnpm test          # unit tests
pnpm typecheck     # tsc --noEmit
pnpm check         # both
```

## Deploy

```bash
pnpm deploy
```

This pushes to Cloudflare Workers via Wrangler. See [`wrangler.toml`](wrangler.toml) for configuration.

## Project layout

```text
src/
  public/index.html  # the web UI (HTML + inline CSS + inline JS)
  globals.d.ts       # TS declaration for *.html imports
  index.ts           # Hono routes + error mapping + security headers
  html.ts            # imports index.html as a bundled string
  github.ts          # GitHub API client with typed errors
  query.ts           # query-param parsing and validation
  svg.ts             # SVG rendering + avatar embedding
  types.ts           # shared types
  utils.ts           # tiny helpers
  __tests__/         # vitest unit tests
```

## Comparison vs contrib.rocks

| Feature | ContribScope | contrib.rocks |
| --- | --- | --- |
| Multi-repo deduplication | ✓ | ✗ |
| Org / user scope | ✓ | ✗ |
| Self-host on Cloudflare Workers | ✓ | ✗ |
| TypeScript-only | ✓ | ✗ (Go + TS) |
| Bring-your-own token | ✓ | ✗ |
| Customizable shape / sort / bot filter | ✓ | Partial |

## License

[MIT](LICENSE) — do whatever, attribution appreciated.
