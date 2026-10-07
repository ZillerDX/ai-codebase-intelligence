import { describe, it, expect } from 'vitest';
import { analyzeRepository, summarizeLanguages } from './analyzer';
import { GitHubClient, GitHubError } from './github-client';
import { AnalysisProgress } from './models';
import { fakeFetch, SHOP_REPO } from './testing/fake-github';

const ref = { owner: 'acme', repo: 'shop' };

describe('analyzeRepository', () => {
  it('builds real facts from the repository data', async () => {
    const progress: AnalysisProgress[] = [];
    const facts = await analyzeRepository(
      ref,
      new GitHubClient({ fetchFn: fakeFetch(SHOP_REPO) }),
      {
        onProgress: (p) => progress.push(p),
      },
    );

    expect(facts.fullName).toBe('acme/shop');
    expect(facts.stars).toBe(1234);
    expect(facts.license).toBe('MIT');
    expect(facts.contributors).toBe(7);
    expect(facts.mergedPullRequests).toBe(42);
    expect(facts.languages.map((l) => l.name)).toEqual(['TypeScript', 'HTML']);
    expect(facts.languages[0].percent).toBeCloseTo(90);

    // vendored and binary files are excluded from the tree
    expect(facts.files.map((f) => f.path)).not.toContain('node_modules/lib/index.js');
    expect(facts.files.map((f) => f.path)).not.toContain('logo.png');

    expect(facts.frameworks).toEqual(['Express', 'TypeScript', 'Vitest']);
    expect(facts.scripts['npm run start']).toBe('node dist/server.js');
    expect(facts.hasTests).toBe(true);
    expect(facts.hasCi).toBe(true);
    expect(facts.hasDocker).toBe(false);
    expect(facts.readmeExcerpt).toContain('A small demo shop API');

    const ids = facts.findings.map((f) => f.ruleId);
    expect(ids).toContain('SEC-SECRET');
    expect(ids).toContain('SEC-SQL');
    expect(ids).toContain('STAB-CATCH');
    expect(facts.findings[0].severity).toBe('critical');
    expect(facts.todoCount).toBe(1);

    expect(facts.endpoints.map((e) => `${e.method} ${e.path}`)).toEqual([
      'GET /orders',
      'POST /orders',
    ]);
    expect(facts.references['src/services/OrderService.ts']).toEqual(
      expect.arrayContaining(['src/api/OrderController.ts', 'tests/order.test.ts']),
    );
    expect(facts.references['src/data/OrderRepository.ts']).toEqual([
      'src/services/OrderService.ts',
    ]);

    // every code file was read, so the line count is exact
    expect(facts.codeFileCount).toBe(4);
    expect(facts.estimatedLoc).toBe(facts.scannedLines);
    expect(progress.at(0)?.step).toBe(1);
    expect(progress.at(-1)?.label).toMatch(/Scanning/);
  });

  it('estimates lines of code from bytes when not every file is read', async () => {
    const facts = await analyzeRepository(
      ref,
      new GitHubClient({ fetchFn: fakeFetch(SHOP_REPO) }),
      { maxScanFiles: 1 },
    );
    expect(facts.scanned).toHaveLength(1);
    expect(facts.estimatedLoc).toBeGreaterThan(facts.scannedLines);
  });

  it('only calls GitHub, never any other host', async () => {
    const calls: string[] = [];
    await analyzeRepository(ref, new GitHubClient({ fetchFn: fakeFetch(SHOP_REPO, calls) }));
    const hosts = new Set(calls.map((c) => new URL(c).host));
    expect([...hosts].sort()).toEqual(['api.github.com', 'raw.githubusercontent.com']);
  });

  it('reports a missing repository clearly', async () => {
    const client = new GitHubClient({ fetchFn: fakeFetch(SHOP_REPO) });
    await expect(analyzeRepository({ owner: 'acme', repo: 'nope' }, client)).rejects.toMatchObject({
      kind: 'not-found',
    });
  });

  it('reports rate limiting with a reset time', async () => {
    const limited = (async () =>
      new Response('{}', {
        status: 403,
        headers: { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': '1800000000' },
      })) as unknown as typeof fetch;
    const error = await analyzeRepository(ref, new GitHubClient({ fetchFn: limited })).catch(
      (e) => e,
    );
    expect(error).toBeInstanceOf(GitHubError);
    expect(error.kind).toBe('rate-limit');
    expect(error.resetAt?.getTime()).toBe(1800000000 * 1000);
  });

  it('reports network failures', async () => {
    const down = (async () => {
      throw new TypeError('Failed to fetch');
    }) as unknown as typeof fetch;
    await expect(analyzeRepository(ref, new GitHubClient({ fetchFn: down }))).rejects.toMatchObject(
      { kind: 'network' },
    );
  });

  it('sends the token only to the GitHub API, never to raw.githubusercontent.com', async () => {
    const seen: { url: string; auth?: string }[] = [];
    const inner = fakeFetch(SHOP_REPO);
    const spy = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const headers = (init?.headers ?? {}) as Record<string, string>;
      seen.push({ url: String(input), auth: headers['Authorization'] });
      return inner(input, init);
    }) as typeof fetch;
    await analyzeRepository(ref, new GitHubClient({ token: 'ghp_secret', fetchFn: spy }));
    expect(
      seen
        .filter((s) => s.url.includes('api.github.com'))
        .every((s) => s.auth === 'Bearer ghp_secret'),
    ).toBe(true);
    expect(
      seen
        .filter((s) => s.url.includes('raw.githubusercontent.com'))
        .every((s) => s.auth === undefined),
    ).toBe(true);
  });
});

describe('summarizeLanguages', () => {
  it('computes percentages and groups the tail as Other', () => {
    const langs = summarizeLanguages({ A: 50, B: 30, C: 10, D: 5, E: 5 }, 3);
    expect(langs.map((l) => l.name)).toEqual(['A', 'B', 'C', 'Other']);
    expect(langs[3].percent).toBeCloseTo(10);
    expect(summarizeLanguages({})).toEqual([]);
  });
});
