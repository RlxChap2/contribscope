import { describe, expect, it } from 'vitest';
import { dedupeContributors } from '../github';
import type { GitHubContributor, RepoRef } from '../types';

const repoA: RepoRef = { owner: 'acme', name: 'api', fullName: 'acme/api' };
const repoB: RepoRef = { owner: 'acme', name: 'sdk', fullName: 'acme/sdk' };

function contributor(login: string, contributions: number, type = 'User'): GitHubContributor {
  return {
    login,
    contributions,
    type,
    id: contributions,
    avatar_url: `https://github.com/${login}.png`,
    html_url: `https://github.com/${login}`,
  };
}

describe('dedupeContributors', () => {
  it('deduplicates contributors across repos and sums contributions', () => {
    const contributors = dedupeContributors(
      [
        { repo: repoA, contributor: contributor('octo', 4) },
        { repo: repoB, contributor: contributor('octo', 2) },
        { repo: repoB, contributor: contributor('mona', 5) },
      ],
      { excludeBots: true, sort: 'contributions', limit: 10 },
    );

    expect(contributors).toHaveLength(2);
    expect(contributors[0].login).toBe('octo');
    expect(contributors[0].contributions).toBe(6);
    expect(contributors[0].repoCount).toBe(2);
  });

  it('excludes bot contributors by default', () => {
    const contributors = dedupeContributors(
      [
        { repo: repoA, contributor: contributor('dependabot', 10, 'Bot') },
        { repo: repoA, contributor: contributor('human', 1) },
      ],
      { excludeBots: true, sort: 'contributions', limit: 10 },
    );

    expect(contributors.map((item) => item.login)).toEqual(['human']);
  });
});
