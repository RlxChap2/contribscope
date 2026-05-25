import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { collectContributors, GitHubApiError } from './github';
import { renderHomePage } from './html';
import { BadRequestError, parseImageQuery } from './query';
import { renderMessageSvg, renderContributorsSvg, resolveAvatarImages } from './svg';
import type { Bindings } from './types';

const app = new Hono<{ Bindings: Bindings }>();

app.use('/image', cors({ origin: '*', exposeHeaders: ['X-Error-Kind', 'X-Error-Message'] }));

// Strict-but-workable CSP. The page bundles its own inline <style> and <script>,
// loads Google Fonts, and renders SVG previews + GitHub avatars as blobs.
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: blob: https://avatars.githubusercontent.com",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

app.get('/', (context) => {
  return context.html(renderHomePage(), 200, {
    'Content-Security-Policy': CSP,
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'interest-cohort=()',
  });
});

app.get('/health', (context) => {
  return context.json({
    ok: true,
    name: context.env.APP_NAME || 'ContribScope',
  });
});

// Tokens are accepted from request headers only — never from query strings,
// which would leak into browser history, server logs, and shared caches.
function extractToken(headers: Headers): string | undefined {
  const fromHeader = headers.get('x-github-token');
  if (fromHeader) return fromHeader.trim();
  const fromAuth = headers.get('authorization');
  if (fromAuth?.toLowerCase().startsWith('bearer ')) return fromAuth.slice(7).trim();
  return undefined;
}

app.get('/image', async (context) => {
  const url = new URL(context.req.url);
  const token = extractToken(context.req.raw.headers);

  try {
    const query = parseImageQuery(url.searchParams);
    const contributors = await collectContributors(query, context.env, { token });
    const contributorsWithImages = await resolveAvatarImages(contributors, query);
    const svg = renderContributorsSvg(contributorsWithImages, query);

    const cacheable = !token;
    return context.body(svg, 200, {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': cacheable ? 'public, max-age=3600, s-maxage=86400' : 'private, max-age=300',
    });
  } catch (error) {
    if (error instanceof BadRequestError) {
      return context.body(renderMessageSvg(error.message, 'error'), error.status, {
        'Content-Type': 'image/svg+xml; charset=utf-8',
        'Cache-Control': 'no-store',
        'X-Error-Kind': 'bad_request',
        'X-Error-Message': error.message,
      });
    }

    if (error instanceof GitHubApiError) {
      const status = error.kind === 'rate_limit' ? 429 : error.kind === 'not_found' ? 404 : error.kind === 'unauthorized' ? 401 : 502;

      return context.body(renderMessageSvg(error.message, 'error'), status, {
        'Content-Type': 'image/svg+xml; charset=utf-8',
        'Cache-Control': 'no-store',
        'X-Error-Kind': error.kind,
        'X-Error-Message': error.message,
        ...(error.resetAt ? { 'X-Rate-Limit-Reset': error.resetAt.toISOString() } : {}),
      });
    }

    const message = 'ContribScope could not render this image.';
    return context.body(renderMessageSvg(message, 'error'), 500, {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Error-Kind': 'unknown',
      'X-Error-Message': message,
    });
  }
});

export default app;
