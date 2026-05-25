# Contributing to ContribScope

Thanks for taking the time to contribute!

## Setup

```bash
pnpm install
pnpm dev
```

The dev server runs at <http://localhost:8787>.

## Before opening a PR

```bash
pnpm check     # typecheck + tests
```

Both must pass. CI runs the same command on every PR.

## Code style

- TypeScript strict mode is on. Don't `// @ts-ignore` — fix the type instead.
- No new dependencies unless the PR explains why a built-in won't do.
- Keep error paths typed (see `GitHubErrorKind` in [`src/github.ts`](src/github.ts)).
- The web UI lives entirely in [`src/public/index.html`](src/public/index.html). Edit it as a real HTML file; it gets bundled into the Worker as a text import.

## Adding a new query parameter

1. Add the field to `ImageQuery` in [`src/types.ts`](src/types.ts).
2. Parse and validate it in [`src/query.ts`](src/query.ts).
3. Consume it in [`src/svg.ts`](src/svg.ts) or [`src/github.ts`](src/github.ts).
4. Add unit tests in [`src/__tests__/`](src/__tests__/).
5. Document it in the API table in [`README.md`](README.md).

## Security

- Tokens are accepted via the `X-GitHub-Token` / `Authorization: Bearer` headers only. Requests that include a `token`-shaped query parameter (`token`, `access_token`, `github_token`, `auth`, `apikey`, `api_key`) are actively rejected with a `400 bad_request` — preserve this invariant when touching `src/index.ts`.
- Never `console.log` request bodies, headers, or env values — they end up in Cloudflare's request logs and stay there.
- Never include the token (or any header value) in an error message body.
- Found a vulnerability? Don't open a public issue — follow [SECURITY.md](SECURITY.md) to report privately via GitHub Security Advisories.

## Commit messages

This repo uses [Conventional Commits](https://www.conventionalcommits.org/). Examples:

```bash
feat: add gap parameter to svg renderer
fix(github): retry once on transient 502
docs: clarify token model in README
refactor(query): split parseRepo out of parseImageQuery
chore: bump wrangler to 4.95
ci: cache pnpm store across runs
```

Common types: `feat`, `fix`, `docs`, `refactor`, `perf`, `test`, `chore`, `ci`, `build`. Scope is optional. Reference issues with `#123` in the body, not the subject.

## Releasing

The project deploys via `pnpm deploy` (Wrangler). `main` is the deploy branch — anything merged there is releasable.
