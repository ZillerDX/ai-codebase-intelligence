export interface FakeRepo {
  owner: string;
  repo: string;
  branch?: string;
  files: Record<string, string>;
  languages?: Record<string, number>;
  mergedPrs?: number;
  contributorsLastPage?: number;
  stars?: number;
}

export const SHOP_REPO: FakeRepo = {
  owner: 'acme',
  repo: 'shop',
  stars: 1234,
  mergedPrs: 42,
  contributorsLastPage: 7,
  languages: { TypeScript: 9000, HTML: 1000 },
  files: {
    'README.md':
      '# Shop\n\nA small demo shop API that lets customers browse products and place orders in plain words.\n',
    'package.json': JSON.stringify({
      dependencies: { express: '^5.0.0' },
      devDependencies: { vitest: '^4.0.0', typescript: '^6.0.0' },
      scripts: { start: 'node dist/server.js', test: 'vitest' },
    }),
    '.github/workflows/ci.yml': 'name: ci\n',
    'src/api/OrderController.ts': [
      "import { OrderService } from '../services/OrderService';",
      "app.get('/orders', list);",
      "app.post('/orders', create);",
      "const apiKey = 'sk9f8a7b6c5d4e3f2a1b';",
      'db.query("SELECT * FROM orders WHERE id = " + id);',
    ].join('\n'),
    'src/services/OrderService.ts': [
      "import { OrderRepository } from '../data/OrderRepository';",
      'export class OrderService { repo = new OrderRepository(); }',
      '// TODO cache results',
    ].join('\n'),
    'src/data/OrderRepository.ts':
      'export class OrderRepository { find() { try { x(); } catch (e) {} } }',
    'tests/order.test.ts':
      "import { OrderService } from '../src/services/OrderService';\ntest('x', () => {});",
    'node_modules/lib/index.js': 'module.exports = 1;',
    'logo.png': 'binary',
  },
};

/** A fetch that serves one fake repository the way api.github.com and raw.githubusercontent.com would. */
export function fakeFetch(repo: FakeRepo, calls: string[] = []): typeof fetch {
  const branch = repo.branch ?? 'main';
  const base = `/repos/${repo.owner}/${repo.repo}`;
  const json = (body: unknown, headers: Record<string, string> = {}) =>
    new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'content-type': 'application/json', ...headers },
    });
  const notFound = () => new Response('{"message":"Not Found"}', { status: 404 });

  return (async (input: RequestInfo | URL) => {
    const url = new URL(
      typeof input === 'string' ? input : input instanceof URL ? input.href : input.url,
    );
    calls.push(url.href);

    if (url.host === 'raw.githubusercontent.com') {
      const prefix = `/${repo.owner}/${repo.repo}/${branch}/`;
      if (!url.pathname.startsWith(prefix)) return notFound();
      const path = decodeURIComponent(url.pathname.slice(prefix.length));
      return path in repo.files ? new Response(repo.files[path], { status: 200 }) : notFound();
    }

    if (url.pathname === base) {
      return json({
        full_name: `${repo.owner}/${repo.repo}`,
        description: 'Demo shop',
        html_url: `https://github.com/${repo.owner}/${repo.repo}`,
        default_branch: branch,
        stargazers_count: repo.stars ?? 1,
        forks_count: 3,
        open_issues_count: 5,
        license: { spdx_id: 'MIT' },
        pushed_at: '2026-09-01T00:00:00Z',
        language: 'TypeScript',
        size: 100,
      });
    }
    if (url.pathname === `${base}/languages`) return json(repo.languages ?? {});
    if (url.pathname.startsWith(`${base}/git/trees/`)) {
      return json({
        truncated: false,
        tree: Object.entries(repo.files).map(([path, content]) => ({
          type: 'blob',
          path,
          size: content.length,
        })),
      });
    }
    if (url.pathname === '/search/issues') return json({ total_count: repo.mergedPrs ?? 0 });
    if (url.pathname === `${base}/contributors`) {
      const last = repo.contributorsLastPage;
      const link = last
        ? `<https://api.github.com/x?per_page=1&page=2>; rel="next", <https://api.github.com/x?per_page=1&page=${last}>; rel="last"`
        : undefined;
      return json([{ login: 'a' }], link ? { link } : {});
    }
    return notFound();
  }) as typeof fetch;
}
