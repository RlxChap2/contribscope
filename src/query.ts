import type { AvatarShape, ImageQuery, RepoRef, SortMode } from './types';
import { uniqueBy } from './utils';

export class BadRequestError extends Error {
  readonly status = 400;
}

const REPO_PATTERN = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const OWNER_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/;

function splitList(value: string | null) {
  if (!value) return [];
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseBool(value: string | null, fallback: boolean) {
  if (value === null) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

function parseNumber(value: string | null, fallback: number, min: number, max: number) {
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(parsed)));
}

function parseRepo(value: string): RepoRef {
  if (!REPO_PATTERN.test(value)) {
    throw new BadRequestError(`Invalid repo "${value}". Use owner/name.`);
  }

  const [owner, name] = value.split('/');
  return {
    owner,
    name,
    fullName: `${owner}/${name}`,
  };
}

function parseOwner(value: string, field: 'org' | 'user') {
  if (!OWNER_PATTERN.test(value)) {
    throw new BadRequestError(`Invalid ${field} "${value}".`);
  }

  return value;
}

function parseSort(value: string | null): SortMode {
  if (value === 'repos' || value === 'login' || value === 'contributions') return value;
  return 'contributions';
}

function parseShape(value: string | null): AvatarShape {
  if (value === 'circle' || value === 'square' || value === 'rounded') return value;
  return 'rounded';
}

export function parseImageQuery(params: URLSearchParams): ImageQuery {
  const repoInputs = [...params.getAll('repo'), ...splitList(params.get('repos'))].flatMap(splitList);
  const repos = uniqueBy(repoInputs.map(parseRepo), (repo) => repo.fullName.toLowerCase());
  const org = params.get('org')?.trim() || '';
  const user = params.get('user')?.trim() || '';

  const selectedModes = [repos.length > 0 ? 'repos' : '', org ? 'org' : '', user ? 'user' : ''].filter(Boolean);

  if (selectedModes.length === 0) {
    throw new BadRequestError('Provide repo, repos, org, or user.');
  }

  if (selectedModes.length > 1) {
    throw new BadRequestError('Use only one source type: repo/repos, org, or user.');
  }

  const mode = repos.length === 1 ? 'repo' : repos.length > 1 ? 'repos' : org ? 'org' : 'user';

  return {
    mode,
    repos,
    owner: org ? parseOwner(org, 'org') : user ? parseOwner(user, 'user') : undefined,
    limit: parseNumber(params.get('limit'), 100, 1, 200),
    size: parseNumber(params.get('size'), 64, 24, 128),
    gap: parseNumber(params.get('gap'), 4, 0, 24),
    columns: parseNumber(params.get('columns') || params.get('per_row'), 12, 1, 24),
    sort: parseSort(params.get('sort')),
    shape: parseShape(params.get('shape')),
    showNames: parseBool(params.get('show_names') || params.get('names'), false),
    embed: parseBool(params.get('embed'), true),
    includeForks: parseBool(params.get('include_forks'), false),
    excludeBots: parseBool(params.get('exclude_bots'), true),
    maxRepos: parseNumber(params.get('max_repos'), 100, 1, 500),
  };
}
