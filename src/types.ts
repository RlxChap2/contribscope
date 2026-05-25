export type Bindings = {
  APP_NAME?: string;
  GITHUB_TOKEN?: string;
};

export type RepoRef = {
  owner: string;
  name: string;
  fullName: string;
};

export type ScopeMode = 'repo' | 'repos' | 'org' | 'user';
export type SortMode = 'contributions' | 'repos' | 'login';
export type AvatarShape = 'rounded' | 'circle' | 'square';

export type ImageQuery = {
  mode: ScopeMode;
  repos: RepoRef[];
  owner?: string;
  limit: number;
  size: number;
  gap: number;
  columns: number;
  sort: SortMode;
  shape: AvatarShape;
  showNames: boolean;
  embed: boolean;
  includeForks: boolean;
  excludeBots: boolean;
  maxRepos: number;
};

export type GitHubRepo = {
  name: string;
  full_name: string;
  fork: boolean;
  archived: boolean;
  disabled: boolean;
  private: boolean;
};

export type GitHubContributor = {
  login: string | null;
  id?: number;
  avatar_url: string;
  html_url: string;
  contributions: number;
  type?: string;
};

export type Contributor = {
  login: string;
  id?: number;
  avatarUrl: string;
  avatarHref?: string;
  htmlUrl: string;
  contributions: number;
  repoCount: number;
  repos: string[];
  type?: string;
};
