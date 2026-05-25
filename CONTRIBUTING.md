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

- Tokens are accepted via headers only, never via query strings or the URL — preserve this invariant.
- Don't log token values or include them in error messages.
- If you find a security issue, please open a private security advisory on GitHub instead of a public issue.

## Commit messages

Short, present-tense, lowercase first letter for the subject — e.g. `add gap parameter to svg renderer`. Reference issues with `#123` when applicable.

## Releasing

The project deploys via `pnpm deploy` (Wrangler). Main is the deploy branch.
