import { describe, expect, it } from 'vitest';
import { BadRequestError, parseImageQuery } from '../query';

describe('parseImageQuery', () => {
  it('parses a single repo', () => {
    const query = parseImageQuery(new URLSearchParams('repo=BonyanOSS/Bonyan-API'));

    expect(query.mode).toBe('repo');
    expect(query.repos).toHaveLength(1);
    expect(query.repos[0].fullName).toBe('BonyanOSS/Bonyan-API');
  });

  it('parses multiple repos from a comma-separated list', () => {
    const query = parseImageQuery(new URLSearchParams('repos=BonyanOSS/Bonyan-API,BonyanOSS/bonyan-sdk-js&limit=20'));

    expect(query.mode).toBe('repos');
    expect(query.limit).toBe(20);
    expect(query.repos.map((repo) => repo.fullName)).toEqual(['BonyanOSS/Bonyan-API', 'BonyanOSS/bonyan-sdk-js']);
  });

  it('rejects mixed source modes', () => {
    expect(() => parseImageQuery(new URLSearchParams('repo=a/b&org=BonyanOSS'))).toThrow(BadRequestError);
  });

  it('clamps visual controls', () => {
    const query = parseImageQuery(new URLSearchParams('org=BonyanOSS&limit=999&size=4&columns=999'));

    expect(query.limit).toBe(200);
    expect(query.size).toBe(24);
    expect(query.columns).toBe(24);
  });
});
