import { RepoFacts } from './models';
import { buildArchitecture, buildDebt, ImpactReport } from './reports';

export type NarrativeKind = 'architecture' | 'docs' | 'debt' | 'impact';

export interface NarrativeRequest {
  kind: NarrativeKind;
  repo: {
    name: string;
    description: string;
    languages: string[];
    frameworks: string[];
    totalFiles: number;
    estimatedLoc: number;
    readme: string;
  };
  areas: { name: string; layer: string; files: number; dependsOn: string[] }[];
  findings: { ruleId: string; title: string; severity: string; file: string; line: number }[];
  endpoints: { method: string; path: string; file: string }[];
  debt: { score: number; grade: string };
  impact?: { target: string; change: string; dependents: string[]; tests: string[]; risk: string };
}

export interface Narrative {
  source: 'ai' | 'fallback';
  headline: string;
  paragraphs: string[];
  bullets: string[];
}

const cut = (s: string, n: number) => (s.length > n ? s.slice(0, n) : s);

/** Compact, size-bounded facts for the AI endpoint. Never includes file contents. */
export function buildNarrativeRequest(
  kind: NarrativeKind,
  facts: RepoFacts,
  impact?: { report: ImpactReport; change: string },
): NarrativeRequest {
  const arch = buildArchitecture(facts);
  const debt = buildDebt(facts);
  return {
    kind,
    repo: {
      name: cut(facts.fullName, 100),
      description: cut(facts.description, 300),
      languages: facts.languages.slice(0, 6).map((l) => l.name),
      frameworks: facts.frameworks.slice(0, 12),
      totalFiles: facts.totalFiles,
      estimatedLoc: facts.estimatedLoc,
      readme: cut(facts.readmeExcerpt, 900),
    },
    areas: arch.components.slice(0, 8).map((c) => ({
      name: cut(c.name, 80),
      layer: c.layer,
      files: c.fileCount,
      dependsOn: c.dependsOn.slice(0, 5).map((d) => cut(d.name, 80)),
    })),
    findings: facts.findings.slice(0, 15).map((f) => ({
      ruleId: f.ruleId,
      title: f.title,
      severity: f.severity,
      file: cut(f.file, 200),
      line: f.line,
    })),
    endpoints: facts.endpoints
      .slice(0, 20)
      .map((e) => ({ method: e.method, path: cut(e.path, 120), file: cut(e.file, 200) })),
    debt: { score: debt.score, grade: debt.grade },
    impact: impact
      ? {
          target: cut(impact.report.target, 200),
          change: cut(impact.change, 500),
          dependents: impact.report.dependents.slice(0, 15).map((p) => cut(p, 200)),
          tests: impact.report.tests.slice(0, 10).map((p) => cut(p, 200)),
          risk: impact.report.risk,
        }
      : undefined,
  };
}
