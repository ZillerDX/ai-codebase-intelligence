import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { AnalysisService, describeFailure } from './analysis.service';
import { GitHubError } from './github-client';
import { fakeFetch, SHOP_REPO } from './testing/fake-github';

describe('AnalysisService', () => {
  let service: AnalysisService;

  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal('fetch', fakeFetch(SHOP_REPO));
    TestBed.configureTestingModule({});
    service = TestBed.inject(AnalysisService);
  });

  afterEach(() => vi.unstubAllGlobals());

  it('analyses a repository and exposes the facts', async () => {
    await service.open({ owner: 'acme', repo: 'shop' });
    const state = service.state();
    expect(state.status).toBe('ready');
    expect(service.facts()?.fullName).toBe('acme/shop');
    expect(service.facts()?.findings.length).toBeGreaterThan(0);
  });

  it('reuses a cached analysis instead of calling GitHub again', async () => {
    await service.open({ owner: 'acme', repo: 'shop' });
    const spy = vi.fn(fakeFetch(SHOP_REPO));
    vi.stubGlobal('fetch', spy);

    await service.open({ owner: 'acme', repo: 'shop' });
    const state = service.state();
    expect(state.status === 'ready' && state.fromCache).toBe(true);
    expect(spy).not.toHaveBeenCalled();

    await service.open({ owner: 'acme', repo: 'shop' }, { force: true });
    expect(spy).toHaveBeenCalled();
  });

  it('keeps a short list of recently analysed repositories', async () => {
    await service.open({ owner: 'acme', repo: 'shop' });
    expect(service.recent().map((r) => r.fullName)).toEqual(['acme/shop']);
  });

  it('never writes the token to storage', async () => {
    service.token.set('ghp_supersecret');
    await service.open({ owner: 'acme', repo: 'shop' });
    const everything = JSON.stringify({ ...localStorage });
    expect(everything).not.toContain('ghp_supersecret');
  });

  it('turns a missing repository into a readable error state', async () => {
    await service.open({ owner: 'acme', repo: 'does-not-exist' });
    const state = service.state();
    expect(state.status).toBe('error');
    if (state.status === 'error') {
      expect(state.failure.kind).toBe('not-found');
      expect(state.failure.title).toContain("couldn't find");
    }
  });

  it('ignores a slow earlier request when a newer one finishes', async () => {
    const slow = (async (input: RequestInfo | URL, init?: RequestInit) => {
      await new Promise((r) => setTimeout(r, 30));
      return fakeFetch(SHOP_REPO)(input, init);
    }) as typeof fetch;
    vi.stubGlobal('fetch', slow);
    const first = service.open({ owner: 'acme', repo: 'shop' }, { branch: 'main' });
    vi.stubGlobal('fetch', fakeFetch({ ...SHOP_REPO, repo: 'other' }));
    await service.open({ owner: 'acme', repo: 'other' });
    await first;
    expect(service.facts()?.fullName).toBe('acme/other');
  });

  it('ignores corrupt or outdated cache entries', async () => {
    localStorage.setItem('codepulse:v1:acme/shop@default', '{not json');
    await service.open({ owner: 'acme', repo: 'shop' });
    const state = service.state();
    expect(state.status === 'ready' && state.fromCache).toBe(false);
  });
});

describe('describeFailure', () => {
  it('explains rate limits with the reset time and the token option', () => {
    const f = describeFailure(
      new GitHubError(
        'rate-limit',
        'GitHub rate limit reached for anonymous requests.',
        new Date(2030, 0, 1, 14, 5),
      ),
    );
    expect(f.title).toContain('limiting');
    expect(f.message).toContain('token');
    expect(f.message).toContain('try again after');
  });

  it('does not leak internals for unexpected errors', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const f = describeFailure(new TypeError('Cannot read properties of undefined'));
    expect(f.kind).toBe('unexpected');
    expect(f.message).not.toContain('undefined');
  });
});
