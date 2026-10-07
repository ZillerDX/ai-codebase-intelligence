import { describe, it, expect } from 'vitest';
import {
  buildReferences,
  cleanReadme,
  detectEndpoints,
  detectSignals,
  filterTree,
  parseManifest,
  scanFile,
  selectFilesToScan,
} from './scanner';

describe('scanFile rules', () => {
  const ruleIds = (path: string, text: string) =>
    scanFile(path, text).findings.map((f) => f.ruleId);

  it('flags a hardcoded secret but redacts the value', () => {
    const result = scanFile('src/config.ts', 'const apiKey = "sk9f8a7b6c5d4e3f2a1b";');
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0].ruleId).toBe('SEC-SECRET');
    expect(result.findings[0].severity).toBe('critical');
    expect(result.findings[0].snippet).not.toContain('sk9f8a7b6c5d4e3f2a1b');
  });

  it('ignores placeholders, env lookups and test files for secrets', () => {
    expect(ruleIds('src/a.ts', 'const password = "your-password-here";')).toEqual([]);
    expect(ruleIds('src/a.ts', 'const token = process.env.TOKEN ?? "abcd1234efgh";')).toEqual([]);
    expect(ruleIds('src/a.test.ts', 'const apiKey = "sk9f8a7b6c5d4e3f2a1b";')).toEqual([]);
    expect(ruleIds('README.md', 'password = "abc12345xyz"')).toEqual([]);
  });

  it('detects AWS access keys and private key headers', () => {
    expect(ruleIds('src/a.py', 'KEY = "AKIAABCDEFGHIJKLMNOP"')).toContain('SEC-SECRET');
    expect(ruleIds('src/a.py', '-----BEGIN RSA PRIVATE KEY-----')).toContain('SEC-SECRET');
  });

  it('detects SQL built from strings but not parameterised queries', () => {
    expect(ruleIds('src/db.ts', 'db.query("SELECT * FROM users WHERE id = " + id);')).toContain(
      'SEC-SQL',
    );
    expect(ruleIds('src/db.ts', 'db.query(`DELETE FROM items WHERE id = ${id}`);')).toContain(
      'SEC-SQL',
    );
    expect(
      ruleIds('src/db.ts', 'db.query("SELECT * FROM users WHERE id = $1", [id]);'),
    ).not.toContain('SEC-SQL');
  });

  it('detects eval, innerHTML, disabled TLS, weak hashes, wildcard CORS and empty catch', () => {
    expect(ruleIds('src/a.js', 'const r = eval(code);')).toContain('SEC-EVAL');
    expect(ruleIds('src/a.js', 'el.innerHTML = html;')).toContain('SEC-HTML');
    expect(ruleIds('src/a.js', 'https.request({ rejectUnauthorized: false })')).toContain(
      'SEC-TLS',
    );
    expect(ruleIds('src/a.js', "crypto.createHash('md5')")).toContain('SEC-HASH');
    expect(ruleIds('src/Startup.cs', 'builder.AllowAnyOrigin();')).toContain('SEC-CORS');
    expect(ruleIds('src/a.js', 'try { x(); } catch (e) {}')).toContain('STAB-CATCH');
    expect(ruleIds('src/a.py', '    except Exception: pass')).toContain('STAB-CATCH');
  });

  it('does not treat comparison or method names as eval', () => {
    expect(ruleIds('src/a.js', 'const x = evaluate(y); retrieval(z);')).not.toContain('SEC-EVAL');
  });

  it('reports line numbers and caps repeats per rule per file', () => {
    const text = Array.from({ length: 10 }, () => 'el.innerHTML = x;').join('\n');
    const findings = scanFile('src/a.js', text).findings;
    expect(findings).toHaveLength(3);
    expect(findings.map((f) => f.line)).toEqual([1, 2, 3]);
  });

  it('flags large files and counts only non-blank lines', () => {
    const text = Array.from({ length: 900 }, (_, i) => `const v${i} = ${i};`).join('\n') + '\n\n\n';
    const result = scanFile('src/big.ts', text);
    expect(result.scanned.lines).toBe(900);
    expect(result.findings.map((f) => f.ruleId)).toContain('MAINT-LARGE');
    const huge = scanFile(
      'src/huge.ts',
      Array.from({ length: 1600 }, (_, i) => `const v${i} = ${i};`).join('\n'),
    );
    expect(huge.findings.find((f) => f.ruleId === 'MAINT-LARGE')?.severity).toBe('major');
  });

  it('counts TODO/FIXME in code only and skips minified content', () => {
    expect(scanFile('src/a.ts', '// TODO fix\n// FIXME later\nconst a = 1;').todoCount).toBe(2);
    expect(scanFile('docs/a.md', 'TODO').todoCount).toBe(0);
    const minified = 'a=1;'.repeat(2000);
    expect(scanFile('src/a.js', minified + '\neval(x)').findings).toEqual([]);
  });
});

describe('detectEndpoints', () => {
  const lines = (s: string) => s.split('\n');

  it('finds Express routes', () => {
    const eps = detectEndpoints(
      'src/routes.js',
      lines('app.get(\'/users\', h);\nrouter.post("/users/:id", h);'),
    );
    expect(eps.map((e) => `${e.method} ${e.path}`)).toEqual(['GET /users', 'POST /users/:id']);
    expect(eps[1].line).toBe(2);
  });

  it('finds ASP.NET controller actions with the route prefix', () => {
    const cs =
      '[Route("api/[controller]")]\npublic class OrdersController {\n[HttpGet("{id}")]\n[HttpPost]\n}';
    const eps = detectEndpoints('Controllers/OrdersController.cs', lines(cs));
    expect(eps.map((e) => `${e.method} ${e.path}`)).toEqual([
      'GET /api/orders/{id}',
      'POST /api/orders',
    ]);
  });

  it('finds Flask, FastAPI, Spring and Go routes', () => {
    expect(
      detectEndpoints('app.py', lines("@app.route('/hello')\n@router.post('/items')")).map(
        (e) => `${e.method} ${e.path}`,
      ),
    ).toEqual(['GET /hello', 'POST /items']);
    expect(
      detectEndpoints('A.java', lines('@RequestMapping("/api")\n@GetMapping("/ping")')).map(
        (e) => e.path,
      ),
    ).toEqual(['/api/ping']);
    expect(detectEndpoints('main.go', lines('http.HandleFunc("/health", h)'))[0].path).toBe(
      '/health',
    );
  });

  it('ignores tests', () => {
    expect(detectEndpoints('tests/a.test.js', lines("app.get('/x', h)"))).toEqual([]);
  });
});

describe('selectFilesToScan and filterTree', () => {
  it('drops vendored, build and binary files', () => {
    const files = filterTree([
      { path: 'src/a.ts', size: 10 },
      { path: 'node_modules/x/index.js', size: 10 },
      { path: 'dist/main.js', size: 10 },
      { path: 'logo.png', size: 10 },
      { path: 'package-lock.json', size: 10 },
    ]);
    expect(files.map((f) => f.path)).toEqual(['src/a.ts', 'package-lock.json']);
  });

  it('prefers shallow source files over tests, skips empty and huge files, honours the limit', () => {
    const { selected, skippedLarge } = selectFilesToScan(
      [
        { path: 'src/core/engine.ts', size: 4000 },
        { path: 'tests/engine.test.ts', size: 4000 },
        { path: 'a/b/c/d/e/deep.ts', size: 4000 },
        { path: 'src/empty.ts', size: 0 },
        { path: 'src/huge.ts', size: 900_000 },
        { path: 'README.md', size: 100 },
        { path: 'package-lock.json', size: 5000 },
      ],
      3,
    );
    expect(selected[0]).toBe('src/core/engine.ts');
    expect(selected).not.toContain('src/empty.ts');
    expect(selected).not.toContain('src/huge.ts');
    expect(selected).not.toContain('README.md');
    expect(selected).not.toContain('package-lock.json');
    expect(selected.length).toBeLessThanOrEqual(3);
    expect(skippedLarge).toBe(1);
  });
});

describe('buildReferences', () => {
  it('links files that mention each other by name and skips generic names', () => {
    const refs = buildReferences(
      new Map([
        ['src/OrderService.ts', 'export class OrderService {}'],
        [
          'src/OrderController.ts',
          "import { OrderService } from './OrderService'; new OrderService();",
        ],
        ['src/index.ts', 'export * from "./OrderController"; // index'],
        ['src/Other.ts', 'nothing here'],
      ]),
    );
    expect(refs['src/OrderService.ts']).toEqual(['src/OrderController.ts']);
    expect(refs['src/OrderController.ts']).toEqual(['src/index.ts']);
    expect(refs['src/index.ts']).toBeUndefined();
    expect(refs['src/Other.ts']).toBeUndefined();
  });

  it('does not match substrings of longer identifiers or duplicate base names', () => {
    const refs = buildReferences(
      new Map([
        ['a/Widget.ts', 'class Widget {}'],
        ['b/uses.ts', 'class WidgetFactory {}'],
        ['a/Thing.ts', ''],
        ['b/Thing.ts', ''],
        ['c/user.ts', 'Thing'],
      ]),
    );
    expect(refs['a/Widget.ts']).toBeUndefined();
    expect(refs['a/Thing.ts']).toBeUndefined();
  });
});

describe('buildReferences with plain-word file names', () => {
  it('links a lowercase file only through an import path or a Python import, not by the word alone', () => {
    const refs = buildReferences(
      new Map([
        ['app/routes/error.js', 'module.exports = {};'],
        ['app/routes/session.js', "const err = require('./error');"],
        ['app/routes/profile.js', "import handler from '../routes/error.js';"],
        ['app/data/user-dao.js', 'callback(new Error("an error occurred")); // error handling'],
        ['pkg/parser.py', 'def parse(): pass'],
        ['pkg/main_app.py', 'from pkg import parser\nparser.parse()'],
        ['pkg/other_app.py', 'parser = None  # not an import'],
      ]),
    );
    expect(refs['app/routes/error.js']?.sort()).toEqual([
      'app/routes/profile.js',
      'app/routes/session.js',
    ]);
    expect(refs['pkg/parser.py']).toEqual(['pkg/main_app.py']);
  });
});

describe('manifests and signals', () => {
  it('reads frameworks and scripts from package.json', () => {
    const info = parseManifest(
      'package.json',
      JSON.stringify({
        dependencies: { react: '^19', express: '^5' },
        devDependencies: { vitest: '^4' },
        scripts: { start: 'vite', test: 'vitest' },
      }),
    );
    expect(info.frameworks.sort()).toEqual(['Express', 'React', 'Vitest']);
    expect(info.scripts['npm run start']).toBe('vite');
  });

  it('survives invalid JSON and reads csproj, requirements and go.mod', () => {
    expect(parseManifest('package.json', '{oops').frameworks).toEqual([]);
    expect(
      parseManifest(
        'Api/Api.csproj',
        '<Project Sdk="Microsoft.NET.Sdk.Web"><TargetFramework>net10.0</TargetFramework></Project>',
      ).frameworks,
    ).toEqual(['ASP.NET Core', '.NET 10.0']);
    expect(parseManifest('requirements.txt', 'Flask==3\npytest').frameworks.sort()).toEqual([
      'Flask',
      'pytest',
    ]);
    expect(parseManifest('go.mod', 'require github.com/gin-gonic/gin v1').frameworks).toEqual([
      'Gin',
    ]);
  });

  it('detects tests, CI and Docker from paths', () => {
    expect(detectSignals([{ path: 'src/a.ts', size: 1 }])).toEqual({
      hasTests: false,
      hasCi: false,
      hasDocker: false,
    });
    expect(
      detectSignals([
        { path: 'src/a.spec.ts', size: 1 },
        { path: '.github/workflows/ci.yml', size: 1 },
        { path: 'Dockerfile', size: 1 },
      ]),
    ).toEqual({ hasTests: true, hasCi: true, hasDocker: true });
  });

  it('cleans README markup into a short plain excerpt', () => {
    const md =
      '# Title\n\n[![Build](x.svg)](y)\n\n<p align="center"><img src="a.png"></p>\n\nThis tool reviews [real repositories](https://x.y) and explains **what it finds** in plain words.\n\n```bash\nnpm i\n```\n\nSecond paragraph that is also long enough to be kept in the excerpt output.';
    const out = cleanReadme(md);
    expect(out).toContain(
      'This tool reviews real repositories and explains what it finds in plain words.',
    );
    expect(out).not.toContain('![');
    expect(out).not.toContain('npm i');
    expect(out.split('\n\n')).toHaveLength(2);
  });
});
