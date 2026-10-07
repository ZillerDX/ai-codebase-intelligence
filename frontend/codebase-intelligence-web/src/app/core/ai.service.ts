import { Injectable, signal } from '@angular/core';
import { Narrative, NarrativeRequest } from './ai-payload';

const BASE = 'http://localhost:5080/api/analysis/ai';

/**
 * Optional AI commentary from the local .NET backend. The app works fully without it;
 * it is only used when running on localhost with a backend that has a Gemini key.
 */
@Injectable({ providedIn: 'root' })
export class AiService {
  /** null = not checked yet */
  readonly available = signal<boolean | null>(null);

  private checking: Promise<boolean> | null = null;
  private readonly cache = new Map<string, Promise<Narrative | null>>();

  private isLocalHost(): boolean {
    const host = typeof window === 'undefined' ? '' : window.location.hostname;
    return host === 'localhost' || host === '127.0.0.1';
  }

  check(): Promise<boolean> {
    if (!this.isLocalHost()) {
      this.available.set(false);
      return Promise.resolve(false);
    }
    this.checking ??= this.fetchStatus().then((ok) => {
      this.available.set(ok);
      return ok;
    });
    return this.checking;
  }

  private async fetchStatus(): Promise<boolean> {
    try {
      const res = await fetch(`${BASE}/status`, { signal: AbortSignal.timeout(3000) });
      if (!res.ok) return false;
      const body = (await res.json()) as { configured?: boolean };
      return body.configured === true;
    } catch {
      return false;
    }
  }

  /** Returns null when AI is unavailable, failed, or only produced the backend's canned fallback. */
  narrative(cacheKey: string, request: NarrativeRequest): Promise<Narrative | null> {
    const existing = this.cache.get(cacheKey);
    if (existing) return existing;
    const promise = this.check().then((ok) => (ok ? this.post(request) : null));
    this.cache.set(cacheKey, promise);
    return promise;
  }

  private async post(request: NarrativeRequest): Promise<Narrative | null> {
    try {
      const res = await fetch(`${BASE}/narrative`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
        signal: AbortSignal.timeout(70_000),
      });
      if (!res.ok) return null;
      const body = (await res.json()) as Narrative;
      return body.source === 'ai' ? body : null;
    } catch (e) {
      console.warn('AI commentary unavailable', e);
      return null;
    }
  }
}
