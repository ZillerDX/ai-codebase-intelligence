import {
  DetectedEndpoint,
  Finding,
  FindingCategory,
  ScannedFile,
  Severity,
  TreeFile,
} from './models';

// ---------- path classification ----------

const IGNORED_DIRS =
  /(^|\/)(node_modules|bower_components|vendor|dist|build|out|bin|obj|target|coverage|\.git|\.next|\.nuxt|\.angular|\.venv|venv|__pycache__|third_party|thirdparty|site-packages|Pods|\.gradle|\.idea|\.vs)\//i;
const BINARY_EXT =
  /\.(png|jpe?g|gif|svg|ico|webp|bmp|pdf|zip|gz|tgz|tar|7z|rar|jar|war|dll|exe|so|dylib|class|woff2?|ttf|otf|eot|mp[34]|mov|avi|wasm|bin|pyc|lock|map|snap|psd|ai|sketch)$/i;

const CODE_EXT = new Set([
  'ts',
  'tsx',
  'js',
  'jsx',
  'mjs',
  'cjs',
  'vue',
  'svelte',
  'cs',
  'py',
  'java',
  'kt',
  'kts',
  'go',
  'rs',
  'rb',
  'php',
  'swift',
  'c',
  'cc',
  'cpp',
  'h',
  'hpp',
  'm',
  'scala',
  'sql',
  'sh',
  'ps1',
  'dart',
  'lua',
  'ex',
  'exs',
  'razor',
  'cshtml',
]);
const CONFIG_EXT = new Set([
  'json',
  'yml',
  'yaml',
  'toml',
  'ini',
  'properties',
  'config',
  'env',
  'xml',
]);
const CONFIG_NAME = /(appsettings|config|settings|secrets?|credentials?|docker-compose|\.env)/i;
const GENERATED =
  /(\.min\.|\.bundle\.|\.generated\.|\.g\.cs$|\.designer\.|\.d\.ts$|-lock\.|\.pb\.go$|_pb2\.py$)/i;

export function extensionOf(path: string): string {
  const name = path.split('/').pop() ?? '';
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : '';
}

export function isIgnoredPath(path: string): boolean {
  return IGNORED_DIRS.test(path) || BINARY_EXT.test(path);
}

/** Number of source (code) files we read; config files we also read are not counted. */
export function scannedCodeCount(scanned: { path: string }[]): number {
  return scanned.filter((s) => isCodeFile(s.path)).length;
}

export function isTestPath(path: string): boolean {
  return (
    /(^|\/)(tests?|__tests__|specs?|e2e|fixtures?|mocks?|__mocks__|testdata)\//i.test(path) ||
    /\.(test|spec)\.[a-z]+$/i.test(path) ||
    /Tests?\.(cs|java|kt)$/.test(path) ||
    /_test\.(go|py|rb)$/.test(path) ||
    /(^|\/)test_[^/]+\.py$/.test(path)
  );
}

function isDocOrExample(path: string): boolean {
  return (
    /\.(md|mdx|rst|txt)$/i.test(path) || /(^|\/)(docs?|examples?|samples?|demo|demos)\//i.test(path)
  );
}

export function isCodeFile(path: string): boolean {
  return CODE_EXT.has(extensionOf(path)) && !GENERATED.test(path);
}

function isConfigFile(path: string): boolean {
  return CONFIG_EXT.has(extensionOf(path)) && CONFIG_NAME.test(path.split('/').pop() ?? '');
}

/** Drops vendored/build output and binaries. */
export function filterTree(files: TreeFile[]): TreeFile[] {
  return files.filter((f) => !isIgnoredPath(f.path));
}

// ---------- file selection ----------

const MAX_FILE_BYTES = 150_000;

export function selectFilesToScan(
  files: TreeFile[],
  limit = 120,
): { selected: string[]; skippedLarge: number } {
  let skippedLarge = 0;
  const candidates: { path: string; score: number }[] = [];

  for (const f of files) {
    const code = isCodeFile(f.path);
    const config = !code && isConfigFile(f.path);
    if (!code && !config) continue;
    if (f.size === 0) continue;
    if (f.size > MAX_FILE_BYTES) {
      skippedLarge++;
      continue;
    }
    const depth = f.path.split('/').length;
    let score = 40 - Math.min(depth, 8) * 4;
    if (
      /(^|\/)(src|app|apps|lib|core|server|api|controllers?|services?|pkg|cmd|internal|packages)\//i.test(
        f.path,
      )
    )
      score += 20;
    if (isTestPath(f.path)) score -= 30;
    if (config) score += 5;
    score += Math.min(f.size / 2000, 15);
    candidates.push({ path: f.path, score });
  }

  candidates.sort((a, b) => b.score - a.score || a.path.localeCompare(b.path));
  return { selected: candidates.slice(0, limit).map((c) => c.path), skippedLarge };
}

// ---------- rules ----------

interface Rule {
  id: string;
  title: string;
  severity: Severity;
  category: FindingCategory;
  description: string;
  recommendation: string;
  appliesTo: 'code' | 'any';
  skipTestsAndDocs: boolean;
  matches: (line: string) => boolean;
}

const PLACEHOLDER =
  /^(your|my|xxx|x{3,}|changeme|change_me|example|placeholder|dummy|test|sample|todo|replace|insert|<|\$\{|%|\{\{|\*{3,}|\.{3,}|none|null|undefined|true|false)/i;
const SECRET_ASSIGN =
  /(api[_-]?key|apikey|secret|passwd|password|pwd|token|private[_-]?key|access[_-]?key|client[_-]?secret|auth[_-]?token)\s*["']?\s*[:=]\s*["']([^"'\s]{8,})["']/i;

function looksLikeSecret(line: string): boolean {
  if (
    /process\.env|os\.environ|getenv|Environment\.GetEnvironmentVariable|import\.meta\.env|\bconfig\.|settings\./i.test(
      line,
    )
  )
    return false;
  if (/AKIA[0-9A-Z]{16}/.test(line)) return true;
  if (/-----BEGIN (RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/.test(line)) return true;
  const m = SECRET_ASSIGN.exec(line);
  if (!m) return false;
  const value = m[2];
  if (PLACEHOLDER.test(value)) return false;
  if (!/[A-Za-z]/.test(value) || !/\d/.test(value)) return false;
  if (/^(.)\1+$/.test(value)) return false;
  return true;
}

const RULES: Rule[] = [
  {
    id: 'SEC-SECRET',
    title: 'Possible hardcoded secret',
    severity: 'critical',
    category: 'Security',
    description:
      'A credential-looking value is written directly in the source, so anyone with read access to the repository can use it.',
    recommendation:
      'Move the value to an environment variable or secret manager, rotate it, and remove it from git history.',
    appliesTo: 'any',
    skipTestsAndDocs: true,
    matches: looksLikeSecret,
  },
  {
    id: 'SEC-SQL',
    title: 'SQL built by string concatenation',
    severity: 'critical',
    category: 'Security',
    description:
      'A SQL statement is assembled from strings and variables, which can allow SQL injection if any part comes from a user.',
    recommendation:
      'Use parameterized queries or the ORM query builder instead of concatenating values into SQL.',
    appliesTo: 'code',
    skipTestsAndDocs: true,
    matches: (line) =>
      /\b(select\s.+\sfrom|insert\s+into|update\s+\w+\s+set|delete\s+from)\b/i.test(line) &&
      /(["'`]\s*\+\s*\w|\w\s*\+\s*["'`]|\$\{[^}]+\}|\{\w+\}["']\s*\)?|%s|\.format\(|f["'])/i.test(
        line,
      ) &&
      !/^\s*(\/\/|#|\*|--)/.test(line),
  },
  {
    id: 'SEC-EVAL',
    title: 'Dynamic code execution',
    severity: 'major',
    category: 'Security',
    description:
      'eval or new Function runs text as code, which is dangerous when the text can be influenced by input.',
    recommendation:
      'Replace with a data-driven approach (a lookup table, JSON.parse, or a safe expression parser).',
    appliesTo: 'code',
    skipTestsAndDocs: true,
    matches: (line) =>
      /(^|[^.\w])eval\s*\(|new\s+Function\s*\(/.test(line) && !/^\s*(\/\/|#|\*)/.test(line),
  },
  {
    id: 'SEC-HTML',
    title: 'Unsafe HTML injection',
    severity: 'major',
    category: 'Security',
    description:
      'Writing raw HTML into the page can allow cross-site scripting (XSS) when the content is not sanitised.',
    recommendation:
      "Render text with the framework's safe bindings, or sanitise the HTML before inserting it.",
    appliesTo: 'code',
    skipTestsAndDocs: true,
    matches: (line) =>
      /\.innerHTML\s*=(?!=)|dangerouslySetInnerHTML|bypassSecurityTrust(Html|Script|Url|ResourceUrl)|v-html=/.test(
        line,
      ),
  },
  {
    id: 'SEC-TLS',
    title: 'Certificate verification disabled',
    severity: 'major',
    category: 'Security',
    description:
      'Turning off TLS certificate checks allows man-in-the-middle attacks on outgoing requests.',
    recommendation:
      'Keep verification enabled; trust a custom CA explicitly if you need to talk to an internal service.',
    appliesTo: 'code',
    skipTestsAndDocs: true,
    matches: (line) =>
      /rejectUnauthorized\s*:\s*false|verify\s*=\s*False|InsecureSkipVerify\s*:\s*true|ServerCertificateValidationCallback\s*=|NODE_TLS_REJECT_UNAUTHORIZED\s*=\s*['"]?0/.test(
        line,
      ),
  },
  {
    id: 'SEC-HASH',
    title: 'Weak hash algorithm',
    severity: 'major',
    category: 'Security',
    description:
      'MD5 and SHA-1 are broken for security purposes such as password storage or signatures.',
    recommendation: 'Use SHA-256 or better for integrity, and bcrypt/scrypt/argon2 for passwords.',
    appliesTo: 'code',
    skipTestsAndDocs: true,
    matches: (line) =>
      /createHash\(\s*['"](md5|sha1)['"]\s*\)|\b(MD5|SHA1)\.Create\(|hashlib\.(md5|sha1)\(|MessageDigest\.getInstance\(\s*"(MD5|SHA-?1)"/i.test(
        line,
      ),
  },
  {
    id: 'SEC-CORS',
    title: 'CORS allows any origin',
    severity: 'minor',
    category: 'Security',
    description: "Allowing every origin lets any website call this API from a visitor's browser.",
    recommendation: 'List the specific origins that need access instead of using a wildcard.',
    appliesTo: 'code',
    skipTestsAndDocs: true,
    matches: (line) =>
      /AllowAnyOrigin\s*\(|Access-Control-Allow-Origin['"]?\s*[:,]\s*['"]\*['"]|origin\s*:\s*['"]\*['"]/i.test(
        line,
      ),
  },
  {
    id: 'STAB-CATCH',
    title: 'Error silently swallowed',
    severity: 'minor',
    category: 'Stability and availability',
    description:
      'An empty catch block hides failures, so problems are invisible until they cause something worse.',
    recommendation:
      'Log the error or handle it explicitly; if ignoring is intended, say why in a comment.',
    appliesTo: 'code',
    skipTestsAndDocs: true,
    matches: (line) =>
      /catch\s*(\([^)]*\))?\s*\{\s*\}|except(\s+[\w.]+)?(\s+as\s+\w+)?\s*:\s*pass\b|rescue\s*(=>\s*\w+)?\s*;?\s*end\b/.test(
        line,
      ),
  },
];

export const RULE_CATALOG: { id: string; title: string; severity: Severity }[] = [
  ...RULES.map((r) => ({ id: r.id, title: r.title, severity: r.severity })),
  { id: 'MAINT-LARGE', title: 'Very large file (over 800 lines)', severity: 'minor' },
];

const TODO_PATTERN = /\b(TODO|FIXME|HACK|XXX)\b/;

// ---------- endpoint detection ----------

const ENDPOINT_LIMIT_PER_FILE = 40;

function joinPath(prefix: string, path: string): string {
  const p = [prefix, path]
    .filter((s) => s !== '')
    .join('/')
    .replace(/\/{2,}/g, '/');
  return p.startsWith('/') ? p : `/${p}`;
}

export function detectEndpoints(path: string, lines: string[]): DetectedEndpoint[] {
  if (isTestPath(path) || isDocOrExample(path)) return [];
  const ext = extensionOf(path);
  const out: DetectedEndpoint[] = [];
  const add = (method: string, p: string, i: number) => {
    if (out.length < ENDPOINT_LIMIT_PER_FILE)
      out.push({ method: method.toUpperCase(), path: p, file: path, line: i + 1 });
  };

  let nestPrefix = '';
  let aspPrefix = '';
  let springPrefix = '';
  const className = (path.split('/').pop() ?? '').replace(/\.\w+$/, '');

  lines.forEach((line, i) => {
    let m: RegExpExecArray | null;

    if (['ts', 'js', 'mjs', 'cjs', 'tsx', 'jsx'].includes(ext)) {
      if ((m = /@Controller\(\s*['"`]([^'"`]*)['"`]/.exec(line))) nestPrefix = m[1];
      if (
        (m =
          /\b(?:app|router|server|api|route|routes|fastify|r)\.(get|post|put|patch|delete)\(\s*['"`]([^'"`]+)['"`]/i.exec(
            line,
          ))
      ) {
        add(m[1], joinPath('', m[2]), i);
      } else if (
        (m = /@(Get|Post|Put|Patch|Delete)\(\s*(?:['"`]([^'"`]*)['"`])?\s*\)/.exec(line))
      ) {
        add(m[1], joinPath(nestPrefix, m[2] ?? ''), i);
      }
    } else if (ext === 'cs') {
      if ((m = /\[Route\(\s*"([^"]*)"\s*\)\]/.exec(line)) && aspPrefix === '') {
        aspPrefix = m[1].replace(
          /\[controller\]/i,
          className.replace(/Controller$/, '').toLowerCase(),
        );
      }
      if ((m = /\[Http(Get|Post|Put|Patch|Delete)(?:\(\s*"([^"]*)"\s*\))?\]/.exec(line))) {
        add(m[1], joinPath(aspPrefix, m[2] ?? ''), i);
      } else if ((m = /\.Map(Get|Post|Put|Patch|Delete)\(\s*"([^"]+)"/.exec(line))) {
        add(m[1], joinPath('', m[2]), i);
      }
    } else if (ext === 'py') {
      if ((m = /@\w+\.(get|post|put|patch|delete)\(\s*['"]([^'"]+)['"]/.exec(line))) {
        add(m[1], joinPath('', m[2]), i);
      } else if (
        (m = /@\w+\.route\(\s*['"]([^'"]+)['"](?:.*methods\s*=\s*\[\s*['"](\w+)['"])?/.exec(line))
      ) {
        add(m[2] ?? 'get', joinPath('', m[1]), i);
      }
    } else if (ext === 'java' || ext === 'kt') {
      if (
        (m = /@RequestMapping\(\s*(?:value\s*=\s*)?\{?\s*"([^"]*)"/.exec(line)) &&
        springPrefix === ''
      )
        springPrefix = m[1];
      if (
        (m =
          /@(Get|Post|Put|Patch|Delete)Mapping(?:\(\s*(?:value\s*=\s*|path\s*=\s*)?"([^"]*)")?/.exec(
            line,
          ))
      ) {
        add(m[1], joinPath(springPrefix, m[2] ?? ''), i);
      }
    } else if (ext === 'go') {
      if ((m = /HandleFunc\(\s*"([^"]+)"/.exec(line))) add('ANY', joinPath('', m[1]), i);
      else if ((m = /\.(GET|POST|PUT|PATCH|DELETE)\(\s*"([^"]+)"/.exec(line)))
        add(m[1], joinPath('', m[2]), i);
    }
  });
  return out;
}

// ---------- scanning one file ----------

export interface FileScan {
  scanned: ScannedFile;
  findings: Finding[];
  todoCount: number;
  endpoints: DetectedEndpoint[];
}

const MAX_PER_RULE_PER_FILE = 3;

export function countCodeLines(text: string): number {
  let n = 0;
  for (const line of text.split('\n')) {
    if (line.trim() !== '') n++;
  }
  return n;
}

export function scanFile(path: string, text: string): FileScan {
  const lines = text.split(/\r?\n/);
  const bytes = text.length;
  const nonBlank = countCodeLines(text);
  const scanned: ScannedFile = { path, lines: nonBlank, bytes };
  const findings: Finding[] = [];
  let todoCount = 0;

  const avgLen = bytes / Math.max(lines.length, 1);
  if (avgLen > 300) {
    return { scanned, findings, todoCount, endpoints: [] };
  }

  const code = isCodeFile(path);
  const skipForRules = isTestPath(path) || isDocOrExample(path);
  const perRule = new Map<string, number>();

  lines.forEach((line, i) => {
    if (line.length > 600) return;
    if (code && TODO_PATTERN.test(line)) todoCount++;
    for (const rule of RULES) {
      if (rule.appliesTo === 'code' && !code) continue;
      if (rule.skipTestsAndDocs && skipForRules) continue;
      if ((perRule.get(rule.id) ?? 0) >= MAX_PER_RULE_PER_FILE) continue;
      if (rule.matches(line)) {
        perRule.set(rule.id, (perRule.get(rule.id) ?? 0) + 1);
        findings.push({
          ruleId: rule.id,
          title: rule.title,
          severity: rule.severity,
          category: rule.category,
          file: path,
          line: i + 1,
          description: rule.description,
          recommendation: rule.recommendation,
          snippet: redact(line.trim()).slice(0, 160),
        });
      }
    }
  });

  if (code && !skipForRules && nonBlank > 800) {
    findings.push({
      ruleId: 'MAINT-LARGE',
      title: nonBlank > 1500 ? 'Very large file' : 'Large file',
      severity: nonBlank > 1500 ? 'major' : 'minor',
      category: 'Maintainability',
      file: path,
      line: 1,
      description: `This file has ${nonBlank.toLocaleString('en-US')} non-blank lines. Large files are hard to review, test and change safely.`,
      recommendation: 'Split it by responsibility into smaller modules or classes.',
      snippet: `${nonBlank.toLocaleString('en-US')} lines`,
    });
  }

  const endpoints = code ? detectEndpoints(path, lines) : [];
  return { scanned, findings, todoCount, endpoints };
}

/** Hides most of a secret value so reports never reproduce a live credential. */
function redact(line: string): string {
  return line
    .replace(SECRET_ASSIGN, (full, _key: string, value: string) =>
      full.replace(value, `${value.slice(0, 3)}…`),
    )
    .replace(/AKIA[0-9A-Z]{16}/g, 'AKIA…');
}

// ---------- reference graph ----------

const AMBIGUOUS_NAMES = new Set([
  'index',
  'main',
  'app',
  'util',
  'utils',
  'types',
  'type',
  'common',
  'config',
  'constants',
  'helpers',
  'helper',
  'mod',
  'init',
  '__init__',
  'program',
  'startup',
  'readme',
  'test',
  'tests',
  'setup',
  'base',
  'models',
  'model',
  'service',
  'services',
  'style',
  'styles',
  'global',
  'default',
  'props',
  'route',
  'routes',
  'server',
  'client',
  'page',
  'layout',
  'lib',
  'core',
  'shared',
  'interfaces',
  'schema',
  'schemas',
  'api',
  'data',
  'store',
]);

export function isGenericName(name: string): boolean {
  return name.length < 4 || AMBIGUOUS_NAMES.has(name.toLowerCase());
}

export function baseName(path: string): string {
  return (path.split('/').pop() ?? '').replace(/\.[^.]+$/, '');
}

/** PascalCase names (OrderService) are distinctive; plain words (error, user, parser) are not. */
function isDistinctiveName(name: string): boolean {
  return /^[A-Z][A-Za-z0-9]*[a-z][A-Za-z0-9]*$/.test(name) && name.length >= 5;
}

/**
 * How a file's text must mention `name` to count as a reference.
 * Distinctive class-like names match as whole words. Plain words only count inside an import path
 * ("./error", "../lib/error.js") or a Python import, so ordinary uses of the word do not create links.
 */
function mentionPattern(name: string): RegExp {
  const n = escapeRegExp(name);
  if (isDistinctiveName(name)) {
    return new RegExp(`(^|[^A-Za-z0-9_])${n}([^A-Za-z0-9_]|$)`);
  }
  const quotedPath =
    String.raw`["'\x60][^"'\x60\n]*[/\\.]` + n + String.raw`(\.[A-Za-z0-9]+)?["'\x60]`;
  const pythonImport =
    String.raw`(^|\n)\s*(from\s+[\w.]*\b` +
    n +
    String.raw`\b[\w.]*\s+import|from\s+[\w.]+\s+import\s+[^\n]*\b` +
    n +
    String.raw`\b|import\s+[^\n]*\b` +
    n +
    String.raw`\b)`;
  return new RegExp(`${quotedPath}|${pythonImport}`);
}

/**
 * For each scanned file, the other scanned files that refer to it by name.
 * This approximates "who depends on this file" without parsing every language.
 */
export function buildReferences(texts: Map<string, string>): Record<string, string[]> {
  const nameCount = new Map<string, number>();
  for (const path of texts.keys()) {
    const n = baseName(path).toLowerCase();
    nameCount.set(n, (nameCount.get(n) ?? 0) + 1);
  }

  const result: Record<string, string[]> = {};
  for (const target of texts.keys()) {
    const name = baseName(target);
    const lower = name.toLowerCase();
    if (isGenericName(name) || (nameCount.get(lower) ?? 0) > 1) continue;
    if (!isCodeFile(target)) continue;

    const pattern = mentionPattern(name);
    const mentions: string[] = [];
    for (const [other, text] of texts) {
      if (other === target) continue;
      if (text.includes(name) && pattern.test(text)) mentions.push(other);
    }
    if (mentions.length > 0) result[target] = mentions;
  }
  return result;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ---------- manifests and frameworks ----------

const MANIFEST_NAMES =
  /(^|\/)(package\.json|requirements\.txt|pyproject\.toml|pom\.xml|build\.gradle(\.kts)?|go\.mod|Cargo\.toml|composer\.json|Gemfile|[^/]+\.csproj)$/;

export function selectManifests(files: TreeFile[], limit = 8): string[] {
  return files
    .map((f) => f.path)
    .filter((p) => MANIFEST_NAMES.test(p) && !IGNORED_DIRS.test(p) && p.split('/').length <= 4)
    .sort((a, b) => a.split('/').length - b.split('/').length || a.localeCompare(b))
    .slice(0, limit);
}

const NPM_FRAMEWORKS: Record<string, string> = {
  react: 'React',
  next: 'Next.js',
  vue: 'Vue',
  nuxt: 'Nuxt',
  '@angular/core': 'Angular',
  svelte: 'Svelte',
  express: 'Express',
  fastify: 'Fastify',
  koa: 'Koa',
  '@nestjs/core': 'NestJS',
  vite: 'Vite',
  webpack: 'Webpack',
  tailwindcss: 'Tailwind CSS',
  typescript: 'TypeScript',
  jest: 'Jest',
  vitest: 'Vitest',
  mocha: 'Mocha',
  cypress: 'Cypress',
  '@playwright/test': 'Playwright',
  prisma: 'Prisma',
  mongoose: 'Mongoose',
  electron: 'Electron',
  'react-native': 'React Native',
  rxjs: 'RxJS',
};

export interface ManifestInfo {
  frameworks: string[];
  scripts: Record<string, string>;
}

export function parseManifest(path: string, text: string): ManifestInfo {
  const frameworks = new Set<string>();
  const scripts: Record<string, string> = {};
  const file = path.split('/').pop() ?? '';

  if (file === 'package.json') {
    try {
      const pkg = JSON.parse(text) as {
        dependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
        scripts?: Record<string, string>;
      };
      for (const dep of Object.keys({ ...pkg.dependencies, ...pkg.devDependencies })) {
        const name = NPM_FRAMEWORKS[dep];
        if (name) frameworks.add(name);
      }
      for (const [k, v] of Object.entries(pkg.scripts ?? {}).slice(0, 12))
        scripts[`npm run ${k}`] = String(v);
    } catch {
      /* invalid package.json: ignore */
    }
  } else if (file.endsWith('.csproj')) {
    if (/Microsoft\.NET\.Sdk\.Web/.test(text)) frameworks.add('ASP.NET Core');
    const tfm = /<TargetFramework>net(\d+(?:\.\d+)?)<\/TargetFramework>/.exec(text);
    if (tfm) frameworks.add(`.NET ${tfm[1]}`);
    if (/EntityFrameworkCore/.test(text)) frameworks.add('Entity Framework Core');
    if (/xunit/i.test(text)) frameworks.add('xUnit');
    if (/NUnit/i.test(text)) frameworks.add('NUnit');
    if (/MediatR/.test(text)) frameworks.add('MediatR');
  } else if (file === 'requirements.txt' || file === 'pyproject.toml') {
    const map: [RegExp, string][] = [
      [/\bdjango\b/i, 'Django'],
      [/\bflask\b/i, 'Flask'],
      [/\bfastapi\b/i, 'FastAPI'],
      [/\bpytest\b/i, 'pytest'],
      [/\bnumpy\b/i, 'NumPy'],
      [/\bpandas\b/i, 'pandas'],
      [/\btorch\b/i, 'PyTorch'],
      [/\btensorflow\b/i, 'TensorFlow'],
      [/scikit-learn/i, 'scikit-learn'],
      [/\bsqlalchemy\b/i, 'SQLAlchemy'],
    ];
    for (const [re, name] of map) if (re.test(text)) frameworks.add(name);
  } else if (file === 'pom.xml' || file.startsWith('build.gradle')) {
    if (/spring-boot/i.test(text)) frameworks.add('Spring Boot');
    if (/junit/i.test(text)) frameworks.add('JUnit');
  } else if (file === 'go.mod') {
    if (/gin-gonic\/gin/.test(text)) frameworks.add('Gin');
    if (/labstack\/echo/.test(text)) frameworks.add('Echo');
    if (/gofiber\/fiber/.test(text)) frameworks.add('Fiber');
  } else if (file === 'Cargo.toml') {
    if (/\btokio\b/.test(text)) frameworks.add('Tokio');
    if (/actix-web/.test(text)) frameworks.add('Actix Web');
    if (/\baxum\b/.test(text)) frameworks.add('Axum');
  } else if (file === 'composer.json') {
    if (/laravel\/framework/.test(text)) frameworks.add('Laravel');
    if (/symfony\//.test(text)) frameworks.add('Symfony');
  } else if (file === 'Gemfile') {
    if (/\brails\b/.test(text)) frameworks.add('Ruby on Rails');
  }
  return { frameworks: [...frameworks], scripts };
}

// ---------- repository signals ----------

export function detectSignals(files: TreeFile[]): {
  hasTests: boolean;
  hasCi: boolean;
  hasDocker: boolean;
} {
  let hasTests = false;
  let hasCi = false;
  let hasDocker = false;
  for (const { path } of files) {
    if (!hasTests && isTestPath(path)) hasTests = true;
    if (
      !hasCi &&
      /(^|\/)(\.github\/workflows\/|\.gitlab-ci\.yml$|azure-pipelines\.yml$|Jenkinsfile$|\.circleci\/)/.test(
        path,
      )
    )
      hasCi = true;
    if (!hasDocker && /(^|\/)(Dockerfile|docker-compose[^/]*\.ya?ml)$/i.test(path))
      hasDocker = true;
  }
  return { hasTests, hasCi, hasDocker };
}

export function findReadme(files: TreeFile[]): string | null {
  const roots = files.filter(
    (f) => !f.path.includes('/') && /^readme(\.(md|markdown|rst|txt))?$/i.test(f.path),
  );
  return roots[0]?.path ?? null;
}

/** Plain-text excerpt of a README: no badges, HTML, images or code blocks. */
export function cleanReadme(text: string, maxChars = 900): string {
  const cleaned = text
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[!\[[^\]]*\]\([^)]*\)\]\([^)]*\)/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^#{1,6}\s*/gm, '')
    .replace(/[*_`>]/g, '')
    .replace(/\r/g, '');

  const paragraphs = cleaned
    .split(/\n{2,}/)
    .map((p) => p.replace(/\s+/g, ' ').trim())
    .filter((p) => p.length >= 40 && !/^[|\-=\s:]+$/.test(p));

  let out = '';
  for (const p of paragraphs) {
    if (out.length + p.length > maxChars) {
      if (out === '') out = p.slice(0, maxChars).trimEnd() + '…';
      break;
    }
    out += (out ? '\n\n' : '') + p;
  }
  return out;
}
