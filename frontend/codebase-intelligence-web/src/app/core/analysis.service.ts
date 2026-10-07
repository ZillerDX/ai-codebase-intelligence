import { Injectable, computed, signal } from '@angular/core';
import { analyzeRepository } from './analyzer';
import { GitHubClient, GitHubError } from './github-client';
import { AnalysisProgress, FACTS_SCHEMA_VERSION, RepoFacts, RepoRef } from './models';
import { repoKey } from './repo-input';

export interface AnalysisFailure {
  title: string;
  message: string;
  kind: GitHubError['kind'] | 'unexpected';
  resetAt?: Date;
}

export type AnalysisState =
  | { status: 'idle' }
  | { status: 'loading'; ref: RepoRef; progress: AnalysisProgress }
  | { status: 'ready'; ref: RepoRef; facts: RepoFacts; fromCache: boolean }
  | { status: 'error'; ref: RepoRef; failure: AnalysisFailure };

export interface RecentRepo {
  key: string;
  fullName: string;
  analyzedAt: string;
}

const CACHE_PREFIX = 'codepulse:v1:';
const INDEX_KEY = `${CACHE_PREFIX}index`;
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const MAX_RECENT = 5;

export function describeFailure(error: unknown): AnalysisFailure {
  if (error instanceof GitHubError) {
    switch (error.kind) {
      case 'not-found':
        return {
          kind: error.kind,
          title: "We couldn't find that repository",
          message: error.message,
        };
      case 'rate-limit': {
        const when = error.resetAt
          ? ` You can try again after ${error.resetAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`
          : '';
        return {
          kind: error.kind,
          title: 'GitHub is limiting anonymous requests',
          message: `${error.message}${when} Adding a free GitHub token under "Advanced options" raises the limit.`,
          resetAt: error.resetAt,
        };
      }
      case 'network':
        return { kind: error.kind, title: "We couldn't reach GitHub", message: error.message };
      case 'empty':
        return { kind: error.kind, title: 'This repository looks empty', message: error.message };
      case 'forbidden':
        return { kind: error.kind, title: 'GitHub refused the request', message: error.message };
      default:
        return {
          kind: error.kind,
          title: 'Something went wrong talking to GitHub',
          message: error.message,
        };
    }
  }
  console.error('Unexpected analysis error', error);
  return {
    kind: 'unexpected',
    title: 'Something went wrong',
    message:
      'The analysis stopped unexpectedly. Please try again; if it keeps happening, try a different repository.',
  };
}

@Injectable({ providedIn: 'root' })
export class AnalysisService {
  readonly state = signal<AnalysisState>({ status: 'idle' });
  readonly facts = computed(() => {
    const s = this.state();
    return s.status === 'ready' ? s.facts : null;
  });

  /** Optional GitHub token. Kept in memory only and sent only to api.github.com. */
  readonly token = signal('');

  private requestId = 0;

  async open(ref: RepoRef, options: { branch?: string; force?: boolean } = {}): Promise<void> {
    const id = ++this.requestId;
    const key = this.cacheKey(ref, options.branch);

    if (!options.force) {
      const cached = this.readCache(key);
      if (cached) {
        this.state.set({ status: 'ready', ref, facts: cached, fromCache: true });
        return;
      }
    }

    this.state.set({ status: 'loading', ref, progress: { step: 0, total: 4, label: 'Starting' } });
    try {
      const facts = await analyzeRepository(ref, new GitHubClient({ token: this.token() }), {
        branch: options.branch,
        onProgress: (progress) => {
          if (id === this.requestId) this.state.set({ status: 'loading', ref, progress });
        },
      });
      if (id !== this.requestId) return;
      this.writeCache(key, facts);
      this.state.set({ status: 'ready', ref, facts, fromCache: false });
    } catch (error) {
      if (id !== this.requestId) return;
      this.state.set({ status: 'error', ref, failure: describeFailure(error) });
    }
  }

  recent(): RecentRepo[] {
    try {
      const raw = localStorage.getItem(INDEX_KEY);
      return raw ? (JSON.parse(raw) as RecentRepo[]) : [];
    } catch (e) {
      console.warn('Could not read recent repositories', e);
      return [];
    }
  }

  private cacheKey(ref: RepoRef, branch?: string): string {
    return `${CACHE_PREFIX}${repoKey(ref)}@${branch ?? 'default'}`;
  }

  private readCache(key: string): RepoFacts | null {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const facts = JSON.parse(raw) as RepoFacts;
      const age = Date.now() - new Date(facts.analyzedAt).getTime();
      if (facts.schemaVersion !== FACTS_SCHEMA_VERSION || !(age >= 0 && age < CACHE_TTL_MS))
        return null;
      return facts;
    } catch (e) {
      console.warn('Ignoring unreadable cached analysis', e);
      return null;
    }
  }

  private writeCache(key: string, facts: RepoFacts): void {
    try {
      localStorage.setItem(key, JSON.stringify(facts));
      const entry: RecentRepo = { key, fullName: facts.fullName, analyzedAt: facts.analyzedAt };
      const next = [entry, ...this.recent().filter((r) => r.key !== key)].slice(0, MAX_RECENT);
      localStorage.setItem(INDEX_KEY, JSON.stringify(next));
    } catch (e) {
      console.warn('Could not cache the analysis (storage full or unavailable)', e);
    }
  }
}
