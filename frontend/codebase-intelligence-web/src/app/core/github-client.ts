import { RepoRef, TreeFile } from './models';

export type GitHubErrorKind =
  'not-found' | 'rate-limit' | 'forbidden' | 'network' | 'empty' | 'other';

export class GitHubError extends Error {
  constructor(
    readonly kind: GitHubErrorKind,
    message: string,
    readonly resetAt?: Date,
  ) {
    super(message);
  }
}

export interface RepoMeta {
  fullName: string;
  description: string;
  htmlUrl: string;
  defaultBranch: string;
  stars: number;
  forks: number;
  openIssues: number;
  license: string | null;
  pushedAt: string;
  primaryLanguage: string | null;
  size: number;
  archived: boolean;
}

export interface TreeResult {
  files: TreeFile[];
  truncated: boolean;
}

export interface GitHubClientOptions {
  token?: string;
  fetchFn?: typeof fetch;
  timeoutMs?: number;
}

const API = 'https://api.github.com';
const RAW = 'https://raw.githubusercontent.com';

function encodePath(path: string): string {
  return path.split('/').map(encodeURIComponent).join('/');
}

export class GitHubClient {
  private readonly token?: string;
  private readonly fetchFn: typeof fetch;
  private readonly timeoutMs: number;

  constructor(options: GitHubClientOptions = {}) {
    this.token = options.token?.trim() || undefined;
    this.fetchFn = options.fetchFn ?? ((...args) => fetch(...args));
    this.timeoutMs = options.timeoutMs ?? 20000;
  }

  private async request(url: string, useAuth: boolean): Promise<Response> {
    const headers: Record<string, string> = {};
    if (useAuth) {
      headers['Accept'] = 'application/vnd.github+json';
      if (this.token) {
        headers['Authorization'] = `Bearer ${this.token}`;
      }
    }
    try {
      return await this.fetchFn(url, { headers, signal: AbortSignal.timeout(this.timeoutMs) });
    } catch (e) {
      throw new GitHubError(
        'network',
        'Could not reach GitHub. Check your connection and try again.',
      );
    }
  }

  private async failure(res: Response, what: string): Promise<GitHubError> {
    if (res.status === 404) {
      return new GitHubError(
        'not-found',
        `${what} was not found. Check the name, or the repository may be private.`,
      );
    }
    const remaining = res.headers.get('x-ratelimit-remaining');
    if (res.status === 429 || (res.status === 403 && remaining === '0')) {
      const reset = Number(res.headers.get('x-ratelimit-reset'));
      const resetAt = reset ? new Date(reset * 1000) : undefined;
      return new GitHubError(
        'rate-limit',
        'GitHub rate limit reached for anonymous requests.',
        resetAt,
      );
    }
    if (res.status === 401 || res.status === 403) {
      return new GitHubError(
        'forbidden',
        'GitHub refused the request. If you entered a token, check that it is valid.',
      );
    }
    return new GitHubError('other', `GitHub returned an unexpected error (${res.status}).`);
  }

  private async json<T>(path: string, what: string): Promise<T> {
    const res = await this.request(`${API}${path}`, true);
    if (!res.ok) {
      throw await this.failure(res, what);
    }
    return (await res.json()) as T;
  }

  async getRepo(ref: RepoRef): Promise<RepoMeta> {
    const data = await this.json<Record<string, unknown>>(
      `/repos/${encodeURIComponent(ref.owner)}/${encodeURIComponent(ref.repo)}`,
      `Repository ${ref.owner}/${ref.repo}`,
    );
    const license = data['license'] as { spdx_id?: string; name?: string } | null;
    return {
      fullName: String(data['full_name'] ?? `${ref.owner}/${ref.repo}`),
      description: String(data['description'] ?? ''),
      htmlUrl: String(data['html_url'] ?? `https://github.com/${ref.owner}/${ref.repo}`),
      defaultBranch: String(data['default_branch'] ?? 'main'),
      stars: Number(data['stargazers_count'] ?? 0),
      forks: Number(data['forks_count'] ?? 0),
      openIssues: Number(data['open_issues_count'] ?? 0),
      license:
        license?.spdx_id && license.spdx_id !== 'NOASSERTION'
          ? license.spdx_id
          : (license?.name ?? null),
      pushedAt: String(data['pushed_at'] ?? ''),
      primaryLanguage: (data['language'] as string | null) ?? null,
      size: Number(data['size'] ?? 0),
      archived: Boolean(data['archived']),
    };
  }

  async getLanguages(ref: RepoRef): Promise<Record<string, number>> {
    try {
      return await this.json<Record<string, number>>(
        `/repos/${encodeURIComponent(ref.owner)}/${encodeURIComponent(ref.repo)}/languages`,
        'Languages',
      );
    } catch (e) {
      if (e instanceof GitHubError && e.kind === 'rate-limit') throw e;
      return {};
    }
  }

  async getTree(ref: RepoRef, branch: string): Promise<TreeResult> {
    const data = await this.json<{
      tree?: { type: string; path: string; size?: number }[];
      truncated?: boolean;
    }>(
      `/repos/${encodeURIComponent(ref.owner)}/${encodeURIComponent(ref.repo)}/git/trees/${encodePath(branch)}?recursive=1`,
      `Branch "${branch}"`,
    );
    const files = (data.tree ?? [])
      .filter((item) => item.type === 'blob')
      .map((item) => ({ path: item.path, size: item.size ?? 0 }));
    if (files.length === 0) {
      throw new GitHubError('empty', `No files were found on branch "${branch}".`);
    }
    return { files, truncated: Boolean(data.truncated) };
  }

  /** Total merged pull requests; null when the search API is unavailable. */
  async countMergedPullRequests(ref: RepoRef): Promise<number | null> {
    try {
      const q = encodeURIComponent(`repo:${ref.owner}/${ref.repo} is:pr is:merged`);
      const data = await this.json<{ total_count?: number }>(
        `/search/issues?q=${q}&per_page=1`,
        'Pull requests',
      );
      return typeof data.total_count === 'number' ? data.total_count : null;
    } catch {
      return null;
    }
  }

  /** Contributor count from the pagination header; null on failure. */
  async countContributors(ref: RepoRef): Promise<number | null> {
    try {
      const res = await this.request(
        `${API}/repos/${encodeURIComponent(ref.owner)}/${encodeURIComponent(ref.repo)}/contributors?per_page=1&anon=1`,
        true,
      );
      if (!res.ok) return null;
      const link = res.headers.get('link');
      const last = link ? /[?&]page=(\d+)>;\s*rel="last"/.exec(link) : null;
      if (last) return Number(last[1]);
      const body = (await res.json()) as unknown[];
      return Array.isArray(body) ? body.length : null;
    } catch {
      return null;
    }
  }

  /** Raw file text, or null when missing or larger than maxBytes. */
  async getRaw(
    ref: RepoRef,
    branch: string,
    path: string,
    maxBytes = 150_000,
  ): Promise<string | null> {
    try {
      const res = await this.request(
        `${RAW}/${encodeURIComponent(ref.owner)}/${encodeURIComponent(ref.repo)}/${encodePath(branch)}/${encodePath(path)}`,
        false,
      );
      if (!res.ok) return null;
      const text = await res.text();
      return text.length > maxBytes ? null : text;
    } catch {
      return null;
    }
  }
}
