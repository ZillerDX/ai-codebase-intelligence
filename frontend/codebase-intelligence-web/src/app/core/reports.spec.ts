import { beforeAll, describe, expect, it } from 'vitest';
import { analyzeRepository } from './analyzer';
import { GitHubClient } from './github-client';
import { RepoFacts } from './models';
import {
  buildArchitecture,
  buildDebt,
  buildDocs,
  buildImpact,
  buildOverview,
  buildSecurity,
  buildTakeaway,
  gradeFor,
} from './reports';
import { fakeFetch, SHOP_REPO } from './testing/fake-github';

let facts: RepoFacts;

beforeAll(async () => {
  facts = await analyzeRepository(
    { owner: 'acme', repo: 'shop' },
    new GitHubClient({ fetchFn: fakeFetch(SHOP_REPO) }),
  );
});

describe('buildDebt', () => {
  it('computes the score from the documented penalties', () => {
    const debt = buildDebt(facts);
    const byLabel = Object.fromEntries(debt.penalties.map((p) => [p.label, p.penalty]));
    expect(byLabel['Critical findings']).toBe(10);
    expect(byLabel['Minor findings']).toBe(0.5);
    expect(byLabel['Automated tests']).toBe(0);
    expect(byLabel['CI configuration']).toBe(0);
    const total = debt.penalties.reduce((n, p) => n + p.penalty, 0);
    expect(debt.score).toBe(Math.round(100 - total));
    expect(debt.grade).toBe(gradeFor(debt.score));
  });

  it('penalises missing tests and CI and never goes below zero', () => {
    const bare: RepoFacts = { ...facts, hasTests: false, hasCi: false, findings: [], todoCount: 0 };
    expect(buildDebt(bare).score).toBe(80);
    const awful: RepoFacts = {
      ...facts,
      hasTests: false,
      hasCi: false,
      todoCount: 10_000,
      findings: Array.from({ length: 100 }, () => ({ ...facts.findings[0] })),
    };
    expect(buildDebt(awful).score).toBeGreaterThanOrEqual(0);
  });

  it('ranks refactor targets by weighted findings and builds a roadmap from real data', () => {
    const debt = buildDebt(facts);
    expect(debt.targets[0].file).toBe('src/api/OrderController.ts');
    expect(debt.targets[0].reasons).toEqual(expect.arrayContaining(['Possible hardcoded secret']));
    expect(debt.roadmap[0]).toMatch(
      /Fix the 2 critical findings first, starting with src\/api\/OrderController\.ts:\d+/,
    );
    expect(debt.effortHours).toBe(4.5);
  });

  it('grades by threshold', () => {
    expect([gradeFor(95), gradeFor(70), gradeFor(50), gradeFor(10)]).toEqual([
      'Healthy',
      'Fair',
      'Needs attention',
      'At risk',
    ]);
  });
});

describe('buildOverview', () => {
  it('uses real numbers and marks exact line counts', () => {
    const overview = buildOverview(facts);
    expect(overview.kpis.map((k) => [k.label, k.value])).toEqual([
      ['Stars', 1234],
      ['Contributors', 7],
      ['Merged pull requests', 42],
      ['Lines of code', facts.scannedLines],
    ]);
    expect(overview.kpis[3].estimated).toBe(false);
    expect(overview.coverage).toMatchObject({ scanned: 4, codeFiles: 4, exact: true });
    expect(overview.severity).toEqual({ critical: 2, major: 0, minor: 1 });
    expect(overview.categories[0]).toEqual({ label: 'Security', count: 2 });
  });

  it('flags estimated line counts when not everything was read', () => {
    const partial: RepoFacts = { ...facts, scanned: facts.scanned.slice(0, 1) };
    expect(buildOverview(partial).kpis[3].estimated).toBe(true);
  });

  it('writes a plain-language takeaway', () => {
    expect(buildTakeaway(facts, buildDebt(facts))).toMatch(
      /^We read 4 of 4 source files and found 2 critical issues\. Technical-debt score: \d+\/100 \(\w[\w ]*\)\.$/,
    );
    const clean: RepoFacts = { ...facts, findings: [] };
    expect(buildTakeaway(clean, buildDebt(clean))).toContain(
      'found no rule-based security or quality issues',
    );
  });
});

describe('buildArchitecture', () => {
  it('derives components, layers and dependencies from the real file tree', () => {
    const arch = buildArchitecture(facts);
    expect(arch.pattern).toBe('Web API (Express)');
    const byName = Object.fromEntries(arch.components.map((c) => [c.name, c]));
    expect(byName['src/api'].layer).toBe('API');
    expect(byName['src/data'].layer).toBe('Data');
    expect(byName['tests'].layer).toBe('Tests');
    expect(byName['src/api'].dependsOn).toEqual([{ name: 'src/services', links: 1 }]);
    expect(byName['src/services'].dependsOn).toEqual([{ name: 'src/data', links: 1 }]);
    expect(arch.mermaid).toMatch(/^graph LR/);
    expect(arch.mermaid).toContain('-->');
    expect(arch.summary).toContain('acme/shop');
    expect(arch.techStack.find((t) => t.label === 'Frameworks and tools')?.value).toContain(
      'Express',
    );
  });

  it('keeps diagram labels free of characters that could break the diagram', () => {
    const odd: RepoFacts = {
      ...facts,
      files: [{ path: 'we"ird[dir]/a.ts', size: 10 }],
      references: {},
    };
    const arch = buildArchitecture(odd);
    expect(arch.mermaid).not.toMatch(/\[dir\]/);
    expect(arch.mermaid).not.toContain('we"ird');
  });
});

describe('buildDocs and buildSecurity', () => {
  it('lists real run commands and detected endpoints', () => {
    const docs = buildDocs(facts);
    expect(docs.hasReadme).toBe(true);
    expect(docs.overview).toContain('demo shop API');
    expect(docs.gettingStarted.map((s) => s.command)).toEqual([
      'npm install',
      'npm start',
      'npm run test',
    ]);
    expect(docs.endpoints.map((e) => `${e.method} ${e.path}`)).toEqual([
      'GET /orders',
      'POST /orders',
    ]);
  });

  it('groups findings by rule', () => {
    const sec = buildSecurity(facts);
    expect(sec.counts).toEqual({ critical: 2, major: 0, minor: 1 });
    expect(sec.byRule.map((r) => r.ruleId).sort()).toEqual(['SEC-SECRET', 'SEC-SQL', 'STAB-CATCH']);
  });
});

describe('buildImpact', () => {
  it('finds real dependents and tests', () => {
    const impact = buildImpact(facts, 'src/services/OrderService.ts');
    expect(impact.traceable).toBe(true);
    expect(impact.dependents).toEqual(['src/api/OrderController.ts']);
    expect(impact.tests).toEqual(['tests/order.test.ts']);
    expect(impact.risk).toBe('medium');
    expect(impact.mermaid).toContain('graph LR');
  });

  it('follows one level of indirect dependents', () => {
    const impact = buildImpact(facts, 'src/data/OrderRepository.ts');
    expect(impact.dependents).toEqual(['src/services/OrderService.ts']);
    expect(impact.indirect).toEqual(['src/api/OrderController.ts']);
  });

  it('says so instead of guessing for unknown, non-code and generic files', () => {
    expect(buildImpact(facts, 'nope/Missing.ts')).toMatchObject({ inRepo: false, risk: 'unknown' });
    expect(buildImpact(facts, 'package.json')).toMatchObject({ traceable: false, risk: 'unknown' });
    const generic: RepoFacts = {
      ...facts,
      files: [...facts.files, { path: 'src/index.ts', size: 5 }],
      scanned: [...facts.scanned, { path: 'src/index.ts', lines: 1, bytes: 5 }],
    };
    const result = buildImpact(generic, 'src/index.ts');
    expect(result.traceable).toBe(false);
    expect(result.untraceableReason).toContain('too common');
  });

  it('raises the risk for entry points and bounds it by the number of dependents', () => {
    const many: RepoFacts = {
      ...facts,
      files: [...facts.files, { path: 'src/ConfigLoader.ts', size: 5 }],
      scanned: [...facts.scanned, { path: 'src/ConfigLoader.ts', lines: 1, bytes: 5 }],
      references: { 'src/ConfigLoader.ts': Array.from({ length: 12 }, (_, i) => `src/f${i}.ts`) },
    };
    expect(buildImpact(many, 'src/ConfigLoader.ts').risk).toBe('critical');
  });
});
