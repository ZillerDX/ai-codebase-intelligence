import {
  DetectedEndpoint,
  Finding,
  FindingCategory,
  LanguageShare,
  RepoFacts,
  Severity,
} from './models';
import { baseName, isCodeFile, isGenericName, isTestPath, scannedCodeCount } from './scanner';
import { plural } from './format';

// ---------- shared helpers ----------

export function countBySeverity(findings: Finding[]): Record<Severity, number> {
  const counts: Record<Severity, number> = { critical: 0, major: 0, minor: 0 };
  for (const f of findings) counts[f.severity]++;
  return counts;
}

export function countByCategory(findings: Finding[]): { label: FindingCategory; count: number }[] {
  const map = new Map<FindingCategory, number>();
  for (const f of findings) map.set(f.category, (map.get(f.category) ?? 0) + 1);
  return [...map.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);
}

// ---------- technical debt ----------

export interface DebtPenalty {
  label: string;
  penalty: number;
  detail: string;
}

export interface DebtTarget {
  file: string;
  score: number;
  reasons: string[];
}

export interface DebtReport {
  score: number;
  grade: 'Healthy' | 'Fair' | 'Needs attention' | 'At risk';
  penalties: DebtPenalty[];
  effortHours: number;
  targets: DebtTarget[];
  roadmap: string[];
}

const SEVERITY_WEIGHT: Record<Severity, number> = { critical: 5, major: 2, minor: 0.5 };

export function gradeFor(score: number): DebtReport['grade'] {
  if (score >= 80) return 'Healthy';
  if (score >= 60) return 'Fair';
  if (score >= 40) return 'Needs attention';
  return 'At risk';
}

export function buildDebt(facts: RepoFacts): DebtReport {
  const rule = facts.findings.filter((f) => f.ruleId !== 'MAINT-LARGE');
  const large = facts.findings.filter((f) => f.ruleId === 'MAINT-LARGE');
  const counts = countBySeverity(rule);
  const density = facts.scannedLines > 0 ? (facts.todoCount / facts.scannedLines) * 1000 : 0;

  const penalties: DebtPenalty[] = [
    {
      label: 'Critical findings',
      penalty: Math.min(30, counts.critical * 5),
      detail: `${counts.critical} × 5 points (max 30)`,
    },
    {
      label: 'Major findings',
      penalty: Math.min(20, counts.major * 2),
      detail: `${counts.major} × 2 points (max 20)`,
    },
    {
      label: 'Minor findings',
      penalty: Math.min(10, counts.minor * 0.5),
      detail: `${counts.minor} × 0.5 points (max 10)`,
    },
    {
      label: 'Large files',
      penalty: Math.min(15, large.length * 2),
      detail: `${large.length} files over 800 lines × 2 points (max 15)`,
    },
    {
      label: 'TODO / FIXME density',
      penalty: Math.min(10, Math.round(density * 10) / 10),
      detail: `${density.toFixed(1)} per 1,000 lines (max 10)`,
    },
    {
      label: 'Automated tests',
      penalty: facts.hasTests ? 0 : 15,
      detail: facts.hasTests ? 'Test files found' : 'No test files or folders detected (15 points)',
    },
    {
      label: 'CI configuration',
      penalty: facts.hasCi ? 0 : 5,
      detail: facts.hasCi ? 'CI configuration found' : 'No workflow or pipeline file detected (5 points)',
    },
  ];
  const total = penalties.reduce((sum, p) => sum + p.penalty, 0);
  const score = Math.max(0, Math.round(100 - total));

  const effort = counts.critical * 2 + counts.major * 1 + counts.minor * 0.25 + large.length * 4;
  const effortHours = Math.round(effort * 2) / 2;

  const byFile = new Map<string, { score: number; reasons: Map<string, number> }>();
  for (const f of facts.findings) {
    const entry = byFile.get(f.file) ?? { score: 0, reasons: new Map<string, number>() };
    entry.score += SEVERITY_WEIGHT[f.severity];
    entry.reasons.set(f.title, (entry.reasons.get(f.title) ?? 0) + 1);
    byFile.set(f.file, entry);
  }
  const targets: DebtTarget[] = [...byFile.entries()]
    .sort((a, b) => b[1].score - a[1].score || a[0].localeCompare(b[0]))
    .slice(0, 8)
    .map(([file, e]) => ({
      file,
      score: e.score,
      reasons: [...e.reasons.entries()].map(([title, n]) => (n > 1 ? `${title} (×${n})` : title)),
    }));

  const roadmap: string[] = [];
  if (counts.critical > 0) {
    const first = facts.findings.find((f) => f.severity === 'critical');
    roadmap.push(
      `Fix the ${plural(counts.critical, 'critical finding')} first${first ? `, starting with ${first.file}:${first.line}` : ''}.`,
    );
  }
  if (counts.major > 0)
    roadmap.push(
      `Review the ${plural(counts.major, 'major finding')} and fix the ones that touch user input or credentials.`,
    );
  if (large.length > 0)
    roadmap.push(
      `Split the ${plural(large.length, 'large file')}, starting with ${large[0].file}.`,
    );
  if (!facts.hasTests) roadmap.push('Add automated tests; none were detected in the repository.');
  if (!facts.hasCi) roadmap.push('Add a CI workflow so tests and builds run on every change.');
  if (facts.todoCount >= 20)
    roadmap.push(
      `Triage the ${plural(facts.todoCount, 'TODO/FIXME comment')} found in the scanned files.`,
    );
  if (roadmap.length === 0)
    roadmap.push(
      'No urgent actions found in the scanned files. Keep tests and CI running as the code grows.',
    );

  return { score, grade: gradeFor(score), penalties, effortHours, targets, roadmap };
}

// ---------- overview ----------

export interface Kpi {
  label: string;
  value: number | null;
  hint: string;
  estimated?: boolean;
}

export interface OverviewReport {
  kpis: Kpi[];
  languages: LanguageShare[];
  severity: Record<Severity, number>;
  categories: { label: FindingCategory; count: number }[];
  debt: DebtReport;
  takeaway: string;
  coverage: { scanned: number; codeFiles: number; exact: boolean; skippedLarge: number };
}

export function buildTakeaway(facts: RepoFacts, debt: DebtReport): string {
  const scanned = scannedCodeCount(facts.scanned);
  const rule = facts.findings.filter((f) => f.ruleId !== 'MAINT-LARGE');
  const largeFiles = facts.findings.length - rule.length;
  const sev = countBySeverity(rule);

  const parts: string[] = [];
  if (sev.critical) parts.push(plural(sev.critical, 'critical issue'));
  if (sev.major) parts.push(plural(sev.major, 'major issue'));
  if (sev.minor && parts.length === 0) parts.push(plural(sev.minor, 'minor issue'));

  let found = parts.length > 0 ? `found ${parts.join(' and ')}` : 'found no rule-based security or quality issues';
  if (largeFiles > 0) {
    found += parts.length > 0 ? `, plus ${plural(largeFiles, 'very large file')}` : `, but ${plural(largeFiles, 'file')} that ${largeFiles === 1 ? 'is' : 'are'} very large`;
  }
  return `We read ${scanned} of ${plural(facts.codeFileCount, 'source file')} and ${found}. Technical-debt score: ${debt.score}/100 (${debt.grade}).`;
}

export function buildOverview(facts: RepoFacts): OverviewReport {
  const debt = buildDebt(facts);
  const exact = facts.scanned.filter((s) => isCodeFile(s.path)).length >= facts.codeFileCount;
  return {
    kpis: [
      { label: 'Stars', value: facts.stars, hint: 'People who starred the repository on GitHub' },
      {
        label: 'Contributors',
        value: facts.contributors,
        hint: 'Accounts that have committed to the repository',
      },
      {
        label: 'Merged pull requests',
        value: facts.mergedPullRequests,
        hint: 'Pull requests merged over the life of the repository',
      },
      {
        label: 'Lines of code',
        value: facts.estimatedLoc,
        hint: exact
          ? 'Counted from every source file'
          : 'Counted in scanned files, estimated from file size for the rest',
        estimated: !exact,
      },
    ],
    languages: facts.languages,
    severity: countBySeverity(facts.findings),
    categories: countByCategory(facts.findings),
    debt,
    takeaway: buildTakeaway(facts, debt),
    coverage: {
      scanned: scannedCodeCount(facts.scanned),
      codeFiles: facts.codeFileCount,
      exact,
      skippedLarge: facts.skippedLargeFiles,
    },
  };
}

// ---------- architecture ----------

export interface ArchComponent {
  id: string;
  name: string;
  layer: string;
  fileCount: number;
  codeFileCount: number;
  topExtensions: string[];
  dependsOn: { name: string; links: number }[];
}

export interface ArchitectureReport {
  pattern: string;
  summary: string;
  components: ArchComponent[];
  mermaid: string;
  techStack: { label: string; value: string }[];
}

const CONTAINER_DIRS = new Set([
  'src',
  'app',
  'apps',
  'packages',
  'services',
  'lib',
  'libs',
  'backend',
  'frontend',
  'server',
  'client',
  'projects',
  'modules',
  'cmd',
  'internal',
  'pkg',
  'source',
  'sources',
]);

export function componentOf(path: string): string {
  const parts = path.split('/');
  if (parts.length === 1) return '(root files)';
  if (CONTAINER_DIRS.has(parts[0].toLowerCase()) && parts.length > 2)
    return `${parts[0]}/${parts[1]}`;
  return parts[0];
}

export function layerOf(name: string): string {
  const n = name.toLowerCase();
  if (/(^|\/)(tests?|__tests__|specs?|e2e)(\/|$)|\.tests?$/.test(n)) return 'Tests';
  if (/(^|\/)(docs?|documentation)(\/|$)/.test(n)) return 'Docs';
  if (
    /(^|[/.])(api|controllers?|routes?|handlers?|endpoints?|backend|server|cmd|functions?)(\/|$|\.)/.test(
      n,
    )
  )
    return 'API';
  if (
    /(^|[/.])(ui|views?|pages?|components?|frontend|client|web|public|assets|styles?|templates?|app|www)(\/|$|\.)/.test(
      n,
    )
  )
    return 'Interface';
  if (
    /(^|[/.])(data|db|database|models?|entities|repositor(y|ies)|migrations?|schemas?|store|persistence|dal)(\/|$|\.)/.test(
      n,
    )
  )
    return 'Data';
  if (
    /(^|[/.])(infra|infrastructure|deploy|ops|docker|k8s|helm|terraform|\.github|scripts?|tools?|build|ci|config)(\/|$|\.)/.test(
      n,
    )
  )
    return 'Infrastructure';
  if (
    /(^|[/.])(services?|domain|core|business|usecases?|lib|libs|src|internal|pkg|engine|logic|shared|common)(\/|$|\.)/.test(
      n,
    )
  )
    return 'Core logic';
  return 'Other';
}

function sanitizeLabel(text: string): string {
  return text.replace(/[^A-Za-z0-9 _./()+-]/g, '').slice(0, 40);
}

export function buildArchitecture(facts: RepoFacts): ArchitectureReport {
  const groups = new Map<string, { files: number; code: number; ext: Map<string, number> }>();
  for (const f of facts.files) {
    const name = componentOf(f.path);
    const g = groups.get(name) ?? { files: 0, code: 0, ext: new Map<string, number>() };
    g.files++;
    if (isCodeFile(f.path)) {
      g.code++;
      const ext = (f.path.split('.').pop() ?? '').toLowerCase();
      g.ext.set(ext, (g.ext.get(ext) ?? 0) + 1);
    }
    groups.set(name, g);
  }

  const ranked = [...groups.entries()]
    .filter(([, g]) => g.code > 0 || g.files >= 3)
    .sort((a, b) => b[1].code - a[1].code || b[1].files - a[1].files || a[0].localeCompare(b[0]))
    .slice(0, 8);
  const names = new Set(ranked.map(([n]) => n));
  const idOf = new Map(ranked.map(([n], i) => [n, `n${i}`]));

  const edgeCounts = new Map<string, number>();
  for (const [target, referrers] of Object.entries(facts.references)) {
    const to = componentOf(target);
    if (!names.has(to)) continue;
    for (const r of referrers) {
      const from = componentOf(r);
      if (from === to || !names.has(from)) continue;
      const key = `${from}\u0000${to}`;
      edgeCounts.set(key, (edgeCounts.get(key) ?? 0) + 1);
    }
  }

  const components: ArchComponent[] = ranked.map(([name, g]) => ({
    id: idOf.get(name)!,
    name,
    layer: layerOf(name),
    fileCount: g.files,
    codeFileCount: g.code,
    topExtensions: [...g.ext.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([e]) => e),
    dependsOn: [...edgeCounts.entries()]
      .filter(([k]) => k.startsWith(`${name}\u0000`))
      .map(([k, links]) => ({ name: k.split('\u0000')[1], links }))
      .sort((a, b) => b.links - a.links),
  }));

  return {
    pattern: guessPattern(facts, components),
    summary: summarizeArchitecture(facts, components),
    components,
    mermaid: buildMermaid(components, edgeCounts),
    techStack: buildTechStack(facts),
  };
}

function guessPattern(facts: RepoFacts, components: ArchComponent[]): string {
  const layers = new Set(components.map((c) => c.layer));
  const top = new Set(facts.files.map((f) => f.path.split('/')[0].toLowerCase()));
  const packagesDirs = components.filter((c) => /^(packages|apps|libs)\//.test(c.name)).length;
  if (packagesDirs >= 2) return 'Monorepo with several packages';
  if (components.filter((c) => /^services\//.test(c.name)).length >= 3)
    return 'Multiple services in one repository';
  if (
    (top.has('frontend') || top.has('client') || top.has('web')) &&
    (top.has('backend') || top.has('server') || top.has('api'))
  ) {
    return 'Full-stack application (separate frontend and backend)';
  }
  const fw = facts.frameworks;
  const spa = ['Angular', 'React', 'Vue', 'Svelte', 'Next.js', 'Nuxt'].find((f) => fw.includes(f));
  if (spa) return `Web application (${spa})`;
  const api = [
    'ASP.NET Core',
    'Express',
    'Fastify',
    'NestJS',
    'Django',
    'Flask',
    'FastAPI',
    'Spring Boot',
    'Gin',
    'Laravel',
    'Ruby on Rails',
  ].find((f) => fw.includes(f));
  if (api) return `Web API (${api})`;
  if (layers.has('API') && layers.has('Data')) return 'Layered application (API and data layers)';
  if (facts.primaryLanguage) return `${facts.primaryLanguage} project`;
  return 'Software project';
}

function summarizeArchitecture(facts: RepoFacts, components: ArchComponent[]): string {
  if (components.length === 0) return `${facts.fullName} has ${plural(facts.totalFiles, 'file')}.`;
  const biggest = components
    .slice(0, 3)
    .map((c) => `${c.name} (${plural(c.fileCount, 'file')})`)
    .join(', ');
  const links = components.reduce((n, c) => n + c.dependsOn.length, 0);
  const linkText =
    links > 0
      ? ` We traced ${plural(links, 'dependency link')} between these areas from file mentions.`
      : '';
  return `${facts.fullName} has ${plural(facts.totalFiles, 'file')} in ${plural(components.length, 'main area')}. The largest are ${biggest}.${linkText}`;
}

const LAYER_CLASS: Record<string, string> = {
  API: 'api',
  Interface: 'ui',
  'Core logic': 'core',
  Data: 'data',
  Tests: 'tests',
  Docs: 'other',
  Infrastructure: 'infra',
  Other: 'other',
};

const LAYER_STYLES = [
  'classDef api fill:#f6e3da,stroke:#b5472a,color:#2b2118',
  'classDef ui fill:#ebe6f5,stroke:#5a4a8a,color:#2b2118',
  'classDef core fill:#e3efe6,stroke:#3f6b4f,color:#2b2118',
  'classDef data fill:#f8ecd2,stroke:#b7791f,color:#2b2118',
  'classDef tests fill:#e6ecee,stroke:#5b6b73,color:#2b2118',
  'classDef infra fill:#f3ede2,stroke:#857868,color:#2b2118',
  'classDef other fill:#fffdf9,stroke:#d6cbb8,color:#2b2118',
];

// Clusters (subgraphs) are avoided on purpose: with edges that cross them Mermaid can produce huge layouts.
function buildMermaid(components: ArchComponent[], edgeCounts: Map<string, number>): string {
  if (components.length === 0) return '';
  const lines = ['graph LR'];
  for (const c of components) {
    lines.push(`  ${c.id}["${sanitizeLabel(c.name)}<br/>${sanitizeLabel(c.layer)} - ${c.fileCount} files"]:::${LAYER_CLASS[c.layer] ?? 'other'}`);
  }
  const idByName = new Map(components.map((c) => [c.name, c.id]));
  const edges = [...edgeCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 14);
  for (const [key] of edges) {
    const [from, to] = key.split('\u0000');
    const a = idByName.get(from);
    const b = idByName.get(to);
    if (a && b) lines.push(`  ${a} --> ${b}`);
  }
  lines.push(...LAYER_STYLES.map((l) => `  ${l}`));
  return lines.join('\n');
}

function buildTechStack(facts: RepoFacts): { label: string; value: string }[] {
  const out: { label: string; value: string }[] = [];
  if (facts.languages.length > 0) {
    out.push({
      label: 'Languages',
      value: facts.languages
        .filter((l) => l.name !== 'Other')
        .slice(0, 4)
        .map((l) => l.name)
        .join(', '),
    });
  }
  if (facts.frameworks.length > 0)
    out.push({ label: 'Frameworks and tools', value: facts.frameworks.join(', ') });
  out.push({ label: 'Tests', value: facts.hasTests ? 'Found' : 'Not found' });
  out.push({ label: 'CI', value: facts.hasCi ? 'Found' : 'Not found' });
  out.push({ label: 'Docker', value: facts.hasDocker ? 'Found' : 'Not found' });
  if (facts.license) out.push({ label: 'License', value: facts.license });
  return out;
}

// ---------- documentation ----------

export interface GettingStartedStep {
  command: string;
  note: string;
}

export interface DocsReport {
  hasReadme: boolean;
  overview: string;
  gettingStarted: GettingStartedStep[];
  endpoints: DetectedEndpoint[];
  structure: { name: string; layer: string; fileCount: number }[];
}

export function buildDocs(facts: RepoFacts): DocsReport {
  const paths = facts.files.map((f) => f.path);
  const has = (re: RegExp) => paths.some((p) => re.test(p));
  const steps: GettingStartedStep[] = [];

  if (has(/(^|\/)package\.json$/))
    steps.push({ command: 'npm install', note: 'Install dependencies (package.json)' });
  for (const key of ['start', 'dev', 'build', 'test']) {
    const script = facts.scripts[`npm run ${key}`];
    if (script)
      steps.push({ command: key === 'start' ? 'npm start' : `npm run ${key}`, note: script });
  }
  if (has(/\.csproj$/)) {
    steps.push({ command: 'dotnet restore', note: 'Restore .NET packages' });
    steps.push({ command: 'dotnet run', note: 'Run the application (from the project folder)' });
    if (facts.hasTests) steps.push({ command: 'dotnet test', note: 'Run the tests' });
  }
  if (has(/(^|\/)requirements\.txt$/))
    steps.push({ command: 'pip install -r requirements.txt', note: 'Install Python dependencies' });
  if (has(/(^|\/)pyproject\.toml$/) && !has(/(^|\/)requirements\.txt$/))
    steps.push({ command: 'pip install .', note: 'Install the Python project (pyproject.toml)' });
  if (has(/(^|\/)go\.mod$/))
    steps.push(
      { command: 'go run .', note: 'Run the Go program' },
      { command: 'go test ./...', note: 'Run the tests' },
    );
  if (has(/(^|\/)pom\.xml$/))
    steps.push({ command: 'mvn test', note: 'Build and test with Maven' });
  if (has(/(^|\/)Cargo\.toml$/))
    steps.push(
      { command: 'cargo run', note: 'Build and run' },
      { command: 'cargo test', note: 'Run the tests' },
    );
  if (facts.hasDocker)
    steps.push({
      command: 'docker compose up',
      note: 'Docker files were found; see the repository for the exact setup',
    });

  const endpoints = [...facts.endpoints].sort(
    (a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method),
  );
  const arch = buildArchitecture(facts);

  return {
    hasReadme: facts.readmeExcerpt !== '',
    overview: facts.readmeExcerpt || facts.description,
    gettingStarted: steps,
    endpoints,
    structure: arch.components.map((c) => ({
      name: c.name,
      layer: c.layer,
      fileCount: c.fileCount,
    })),
  };
}

// ---------- security ----------

export interface SecurityReport {
  findings: Finding[];
  counts: Record<Severity, number>;
  byRule: { ruleId: string; title: string; severity: Severity; count: number }[];
}

export function buildSecurity(facts: RepoFacts): SecurityReport {
  const byRule = new Map<
    string,
    { ruleId: string; title: string; severity: Severity; count: number }
  >();
  for (const f of facts.findings) {
    const entry = byRule.get(f.ruleId) ?? {
      ruleId: f.ruleId,
      title: f.title,
      severity: f.severity,
      count: 0,
    };
    entry.count++;
    byRule.set(f.ruleId, entry);
  }
  return {
    findings: facts.findings,
    counts: countBySeverity(facts.findings),
    byRule: [...byRule.values()].sort((a, b) => b.count - a.count),
  };
}

// ---------- what-if (impact) ----------

export type ImpactRisk = 'low' | 'medium' | 'high' | 'critical' | 'unknown';

export interface ImpactReport {
  target: string;
  inRepo: boolean;
  traceable: boolean;
  untraceableReason: string;
  dependents: string[];
  indirect: string[];
  tests: string[];
  siblings: number;
  risk: ImpactRisk;
  riskReasons: string[];
  mermaid: string;
  coverageNote: string;
}

const ENTRY_LIKE =
  /(^|\/)(program|startup|main|index|app|server|package|tsconfig|appsettings|settings|config|manage)[.\w-]*\.[a-z]+$/i;

function bump(risk: ImpactRisk): ImpactRisk {
  return risk === 'low'
    ? 'medium'
    : risk === 'medium'
      ? 'high'
      : risk === 'high'
        ? 'critical'
        : risk;
}

export function buildImpact(facts: RepoFacts, target: string): ImpactReport {
  const clean = target.trim().replace(/^\/+/, '');
  const inRepo = facts.files.some((f) => f.path === clean);
  const coverageNote = `Based on ${scannedCodeCount(facts.scanned)} of ${plural(facts.codeFileCount, 'source file')} that we read. Files we did not read are not counted.`;
  const empty = {
    target: clean,
    inRepo,
    dependents: [] as string[],
    indirect: [] as string[],
    tests: [] as string[],
    siblings: 0,
    riskReasons: [] as string[],
    mermaid: '',
    coverageNote,
  };

  if (!inRepo) {
    return {
      ...empty,
      traceable: false,
      untraceableReason: 'That file is not in the repository tree.',
      risk: 'unknown',
    };
  }

  const dir = clean.includes('/') ? clean.slice(0, clean.lastIndexOf('/')) : '';
  const siblings = facts.files.filter(
    (f) =>
      f.path !== clean &&
      (f.path.includes('/') ? f.path.slice(0, f.path.lastIndexOf('/')) : '') === dir,
  ).length;

  const name = baseName(clean);
  if (!isCodeFile(clean)) {
    return {
      ...empty,
      siblings,
      traceable: false,
      untraceableReason: 'Only source code files can be traced.',
      risk: 'unknown',
    };
  }
  const sameName = facts.scanned.filter(
    (s) => isCodeFile(s.path) && baseName(s.path).toLowerCase() === name.toLowerCase(),
  ).length;
  if (isGenericName(name) || sameName > 1) {
    return {
      ...empty,
      siblings,
      traceable: false,
      untraceableReason: `The name "${name}" is too common to trace by name, so we cannot tell which files depend on it.`,
      risk: 'unknown',
    };
  }
  const traceable = clean in facts.references || facts.scanned.some((s) => s.path === clean);
  if (!traceable) {
    return {
      ...empty,
      siblings,
      traceable: false,
      untraceableReason: 'We did not read this file, so we cannot tell what mentions it.',
      risk: 'unknown',
    };
  }

  const all = facts.references[clean] ?? [];
  const tests = all.filter(isTestPath);
  const dependents = all.filter((p) => !isTestPath(p));
  const seen = new Set<string>([clean, ...all]);
  const indirect: string[] = [];
  const indirectEdges: [string, string][] = [];
  for (const d of dependents) {
    for (const r of facts.references[d] ?? []) {
      if (!seen.has(r) && !isTestPath(r)) {
        seen.add(r);
        indirect.push(r);
        indirectEdges.push([r, d]);
      }
    }
  }

  let risk: ImpactRisk =
    dependents.length === 0
      ? 'low'
      : dependents.length <= 3
        ? 'medium'
        : dependents.length <= 10
          ? 'high'
          : 'critical';
  const reasons: string[] = [`${plural(dependents.length, 'file')} directly ${dependents.length === 1 ? 'mentions' : 'mention'} ${name}.`];
  if (indirect.length > 0)
    reasons.push(`${plural(indirect.length, 'more file')} ${indirect.length === 1 ? 'depends' : 'depend'} on those files.`);
  if (ENTRY_LIKE.test(clean)) {
    risk = bump(risk);
    reasons.push(
      'This looks like an entry point or shared configuration, so a change here has wider effects.',
    );
  }
  if (tests.length === 0)
    reasons.push('No scanned test file mentions it, so changes may not be covered by tests.');
  else reasons.push(`${plural(tests.length, 'test file')} ${tests.length === 1 ? 'mentions' : 'mention'} it and should be re-run.`);

  return {
    target: clean,
    inRepo,
    traceable: true,
    untraceableReason: '',
    dependents,
    indirect,
    tests,
    siblings,
    risk,
    riskReasons: reasons,
    mermaid: impactDiagram(clean, dependents, indirectEdges),
    coverageNote,
  };
}

function impactDiagram(
  target: string,
  dependents: string[],
  indirectEdges: [string, string][],
): string {
  const short = (p: string) => sanitizeLabel(p.split('/').slice(-2).join('/'));
  const lines = ['graph LR', `  T["${short(target)}"]`];
  const shown = dependents.slice(0, 8);
  shown.forEach((d, i) => lines.push(`  D${i}["${short(d)}"] --> T`));
  if (dependents.length > shown.length)
    lines.push(`  DM["+${dependents.length - shown.length} more"] --> T`);
  indirectEdges
    .filter(([, via]) => shown.includes(via))
    .slice(0, 6)
    .forEach(([r, via], i) => lines.push(`  I${i}["${short(r)}"] -.-> D${shown.indexOf(via)}`));
  if (shown.length === 0) lines.push('  N["Nothing we read mentions this file"] -.-> T');
  return lines.join('\n');
}
