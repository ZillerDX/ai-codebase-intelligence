import { RepoRef } from './models';

const URL_PATTERN =
  /^(?:https?:\/\/|ssh:\/\/git@|git@)?(?:www\.)?github\.com[:/](?<owner>[^/\s]+)\/(?<repo>[^/\s?#]+)/i;
const OWNER_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/;
const REPO_PATTERN = /^[A-Za-z0-9._-]{1,100}$/;
const BRANCH_PATTERN = /^[A-Za-z0-9._/-]{1,200}$/;

export class RepoInputError extends Error {}

/** Parses "owner/repo", github.com URLs (with .git, /tree/...) and git@ links. */
export function parseRepoInput(input: string): RepoRef {
  const clean = (input ?? '').trim().replace(/\/+$/, '');
  if (!clean) {
    throw new RepoInputError(
      'Paste a GitHub link like https://github.com/owner/repo, or type owner/repo.',
    );
  }

  let owner: string;
  let repo: string;
  const match = URL_PATTERN.exec(clean);
  if (match?.groups) {
    owner = match.groups['owner'];
    repo = match.groups['repo'];
  } else {
    const parts = clean.split('/');
    if (parts.length !== 2) {
      throw new RepoInputError(
        'That does not look like a GitHub repository. Use owner/repo or a github.com link.',
      );
    }
    [owner, repo] = parts;
  }

  if (repo.toLowerCase().endsWith('.git')) {
    repo = repo.slice(0, -4);
  }

  if (!OWNER_PATTERN.test(owner) || !REPO_PATTERN.test(repo) || repo === '.' || repo === '..') {
    throw new RepoInputError(
      'The owner or repository name contains characters GitHub does not allow.',
    );
  }
  return { owner, repo };
}

export function validateBranch(branch: string): string {
  const value = branch.trim();
  if (
    !BRANCH_PATTERN.test(value) ||
    value.includes('..') ||
    value.startsWith('/') ||
    value.endsWith('/') ||
    value.includes('//')
  ) {
    throw new RepoInputError('That branch name is not valid.');
  }
  return value;
}

export function repoKey(ref: RepoRef): string {
  return `${ref.owner}/${ref.repo}`.toLowerCase();
}
