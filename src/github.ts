import type { Bindings, Contributor, GitHubContributor, GitHubRepo, ImageQuery, RepoRef } from './types';
import { mapLimit } from './utils';

const GITHUB_API = 'https://api.github.com';
const MAX_CONTRIBUTOR_PAGES = 5;
const PAGE_SIZE = 100;

export type GitHubErrorKind = 'rate_limit' | 'not_found' | 'unauthorized' | 'forbidden' | 'network' | 'unknown';

export class GitHubApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly kind: GitHubErrorKind = 'unknown',
    readonly resetAt?: Date,
    readonly resource?: string,
  ) {
    super(message);
  }
}

export type AuthOptions = { token?: string };

function getHeaders(env: Bindings, auth?: AuthOptions): HeadersInit {
  const headers: HeadersInit = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'ContribScope',
  };

  const token = auth?.token || env.GITHUB_TOKEN;
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
}

function isRateLimited(response: Response): boolean {
  if (response.status !== 403 && response.status !== 429) return false;
  const remaining = response.headers.get('x-ratelimit-remaining');
  return remaining === '0';
}

function rateLimitResetDate(response: Response): Date | undefined {
  const reset = response.headers.get('x-ratelimit-reset');
  if (!reset) return undefined;
  const seconds = Number(reset);
  return Number.isFinite(seconds) ? new Date(seconds * 1000) : undefined;
}

async function fetchJson<T>(url: string, env: Bindings, auth?: AuthOptions, resource?: string): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, { headers: getHeaders(env, auth) });
  } catch (error) {
    throw new GitHubApiError(`Network error reaching GitHub${resource ? ` for ${resource}` : ''}`, 0, 'network', undefined, resource);
  }

  if (response.ok) return response.json() as Promise<T>;

  if (isRateLimited(response)) {
    const reset = rateLimitResetDate(response);
    const hasToken = Boolean(auth?.token || env.GITHUB_TOKEN);
    const limit = hasToken ? '5000/hr' : '60/hr';
    const resetText = reset ? ` Resets at ${reset.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.` : '';
    const tokenHint = hasToken ? '' : ' Add a GitHub token to raise the limit to 5000/hr.';
    throw new GitHubApiError(`GitHub rate limit reached (${limit}).${resetText}${tokenHint}`, response.status, 'rate_limit', reset, resource);
  }

  if (response.status === 401) {
    throw new GitHubApiError('GitHub token is invalid or expired.', 401, 'unauthorized', undefined, resource);
  }

  if (response.status === 404) {
    throw new GitHubApiError(resource ? `Not found on GitHub: ${resource}` : 'Not found on GitHub.', 404, 'not_found', undefined, resource);
  }

  if (response.status === 403) {
    throw new GitHubApiError(resource ? `GitHub denied access to ${resource}.` : 'GitHub denied the request.', 403, 'forbidden', undefined, resource);
  }

  throw new GitHubApiError(
    `GitHub request failed (${response.status})${resource ? ` for ${resource}` : ''}.`,
    response.status,
    'unknown',
    undefined,
    resource,
  );
}

async function fetchPaged<T>(url: URL, env: Bindings, maxItems: number, maxPages = 10, auth?: AuthOptions, resource?: string) {
  const items: T[] = [];

  for (let page = 1; page <= maxPages && items.length < maxItems; page += 1) {
    url.searchParams.set('per_page', String(PAGE_SIZE));
    url.searchParams.set('page', String(page));

    const pageItems = await fetchJson<T[]>(url.toString(), env, auth, resource);
    items.push(...pageItems);

    if (pageItems.length < PAGE_SIZE) break;
  }

  return items.slice(0, maxItems);
}

function repoFromFullName(fullName: string): RepoRef {
  const [owner, name] = fullName.split('/');
  return { owner, name, fullName };
}

async function getReposForOwner(kind: 'org' | 'user', owner: string, query: ImageQuery, env: Bindings, auth?: AuthOptions) {
  const path = kind === 'org' ? `/orgs/${owner}/repos` : `/users/${owner}/repos`;
  const url = new URL(`${GITHUB_API}${path}`);
  url.searchParams.set('type', kind === 'org' ? 'public' : 'owner');
  url.searchParams.set('sort', 'updated');

  const repos = await fetchPaged<GitHubRepo>(url, env, query.maxRepos, Math.ceil(query.maxRepos / PAGE_SIZE), auth, `${kind}:${owner}`);

  return repos
    .filter((repo) => !repo.private && !repo.archived && !repo.disabled)
    .filter((repo) => query.includeForks || !repo.fork)
    .map((repo) => repoFromFullName(repo.full_name));
}

async function getContributorsForRepo(repo: RepoRef, env: Bindings, auth?: AuthOptions) {
  const url = new URL(`${GITHUB_API}/repos/${repo.owner}/${repo.name}/contributors`);
  url.searchParams.set('anon', 'false');

  return fetchPaged<GitHubContributor>(url, env, PAGE_SIZE * MAX_CONTRIBUTOR_PAGES, MAX_CONTRIBUTOR_PAGES, auth, repo.fullName);
}

function isBotContributor(contributor: GitHubContributor) {
  const login = contributor.login?.toLowerCase() || '';
  return contributor.type === 'Bot' || login.endsWith('[bot]') || login === 'dependabot';
}

export function dedupeContributors(
  entries: Array<{ repo: RepoRef; contributor: GitHubContributor }>,
  options: Pick<ImageQuery, 'excludeBots' | 'sort' | 'limit'>,
): Contributor[] {
  const contributors = new Map<string, Contributor>();

  for (const { repo, contributor } of entries) {
    if (!contributor.login) continue;
    if (options.excludeBots && isBotContributor(contributor)) continue;

    const key = contributor.login.toLowerCase();
    const existing = contributors.get(key);

    if (existing) {
      existing.contributions += contributor.contributions;
      if (!existing.repos.includes(repo.fullName)) {
        existing.repos.push(repo.fullName);
        existing.repoCount = existing.repos.length;
      }
      continue;
    }

    contributors.set(key, {
      login: contributor.login,
      id: contributor.id,
      avatarUrl: contributor.avatar_url,
      htmlUrl: contributor.html_url,
      contributions: contributor.contributions,
      repoCount: 1,
      repos: [repo.fullName],
      type: contributor.type,
    });
  }

  const sorted = [...contributors.values()].sort((a, b) => {
    if (options.sort === 'login') return a.login.localeCompare(b.login);
    if (options.sort === 'repos') {
      const repoWeight = b.repoCount - a.repoCount;
      if (repoWeight !== 0) return repoWeight;
    }

    const contributionWeight = b.contributions - a.contributions;
    if (contributionWeight !== 0) return contributionWeight;

    return a.login.localeCompare(b.login);
  });

  return sorted.slice(0, options.limit);
}

export async function collectContributors(query: ImageQuery, env: Bindings, auth?: AuthOptions): Promise<Contributor[]> {
  const repos =
    query.mode === 'org' && query.owner
      ? await getReposForOwner('org', query.owner, query, env, auth)
      : query.mode === 'user' && query.owner
        ? await getReposForOwner('user', query.owner, query, env, auth)
        : query.repos;

  const results = await mapLimit(repos, 4, async (repo) => {
    const contributors = await getContributorsForRepo(repo, env, auth);
    return contributors.map((contributor) => ({ repo, contributor }));
  });

  return dedupeContributors(results.flat(), query);
}
