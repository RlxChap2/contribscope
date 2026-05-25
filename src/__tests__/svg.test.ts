import { describe, expect, it } from 'vitest';
import { renderContributorsSvg, renderMessageSvg } from '../svg';
import type { Contributor, ImageQuery } from '../types';

const query: ImageQuery = {
  mode: 'repo',
  repos: [{ owner: 'acme', name: 'api', fullName: 'acme/api' }],
  limit: 100,
  size: 64,
  gap: 4,
  columns: 2,
  sort: 'contributions',
  shape: 'rounded',
  showNames: false,
  embed: false,
  includeForks: false,
  excludeBots: true,
  maxRepos: 100,
};

const contributors: Contributor[] = [
  {
    login: 'mona',
    avatarUrl: 'https://github.com/mona.png',
    avatarHref: 'https://github.com/mona.png',
    htmlUrl: 'https://github.com/mona',
    contributions: 3,
    repoCount: 1,
    repos: ['acme/api'],
  },
  {
    login: 'octo',
    avatarUrl: 'https://github.com/octo.png',
    avatarHref: 'https://github.com/octo.png',
    htmlUrl: 'https://github.com/octo',
    contributions: 2,
    repoCount: 1,
    repos: ['acme/api'],
  },
];

describe('renderContributorsSvg', () => {
  it('renders a correctly sized SVG grid', () => {
    const svg = renderContributorsSvg(contributors, query);

    expect(svg).toContain('width="132"');
    expect(svg).toContain('height="64"');
    expect(svg).toContain('mona');
    expect(svg).toContain('octo');
  });

  it('renders a message SVG for empty states', () => {
    expect(renderMessageSvg('No contributors found')).toContain('No contributors found');
  });
});
