# Security Policy

## Reporting a vulnerability

**Please do not open a public GitHub issue for security bugs.**

To report a vulnerability:

1. Go to <https://github.com/RlxChap2/contribscope/security/advisories/new>
2. Fill out the form. Include:
   - A clear description of the issue
   - Steps to reproduce (or a proof-of-concept)
   - The impact you believe it has (data exposure, token leakage, RCE, etc.)
   - Any suggested mitigation

You will get an acknowledgment within **72 hours**. Disclosure happens after a fix is shipped or, at the latest, 90 days after the report — whichever comes first.

## What is in scope

- Anything that leaks a GitHub token (visitor-supplied or operator-supplied)
- Anything that lets a request bypass the `X-GitHub-Token` header invariant
- Cross-site request forgery, clickjacking, or other browser-side attacks against the web UI
- Server-side request forgery via crafted query parameters
- Cache poisoning that returns one user's data to another
- Dependency vulnerabilities in `package.json` or `pnpm-lock.yaml`

## What is out of scope

- Rate limiting from GitHub's side (this is a deployment concern, see [README.md](README.md))
- Self-XSS that requires the victim to paste hostile content into the token field
- Reports based on a non-default Cloudflare Workers configuration
- Issues in third-party services (Cloudflare, GitHub) themselves

## Supported versions

Only the latest commit on `main` is supported. There are no backported fixes.

## Hardening notes for operators

- Do not set `GITHUB_TOKEN` on a public deployment unless you have aggressive caching in front of the Worker — your token will be exhausted quickly and any abuse is attributed to your account.
- Cloudflare Workers Observability logs the request URL. The Worker actively rejects token-shaped query parameters with `400` to keep them out of these logs, but custom proxies in front of the Worker may log differently.
- If you fork and add logging, do not log request headers — that includes `X-GitHub-Token`.
