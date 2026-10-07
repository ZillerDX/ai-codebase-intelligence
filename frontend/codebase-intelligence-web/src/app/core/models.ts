export interface RepoRef {
  owner: string;
  repo: string;
}

export type Severity = 'critical' | 'major' | 'minor';

export type FindingCategory =
  'Security' | 'Stability and availability' | 'Code quality' | 'Maintainability';

export interface Finding {
  ruleId: string;
  title: string;
  severity: Severity;
  category: FindingCategory;
  file: string;
  line: number;
  description: string;
  recommendation: string;
  snippet: string;
}

export interface LanguageShare {
  name: string;
  bytes: number;
  percent: number;
}

export interface TreeFile {
  path: string;
  size: number;
}

export interface ScannedFile {
  path: string;
  lines: number;
  bytes: number;
}

export interface DetectedEndpoint {
  method: string;
  path: string;
  file: string;
  line: number;
}

export interface RepoFacts {
  schemaVersion: number;
  ref: RepoRef;
  fullName: string;
  description: string;
  htmlUrl: string;
  branch: string;
  stars: number;
  forks: number;
  openIssues: number;
  license: string | null;
  pushedAt: string;
  primaryLanguage: string | null;
  contributors: number | null;
  mergedPullRequests: number | null;
  languages: LanguageShare[];
  files: TreeFile[];
  totalFiles: number;
  treeTruncated: boolean;
  readmeExcerpt: string;
  frameworks: string[];
  scripts: Record<string, string>;
  hasTests: boolean;
  hasCi: boolean;
  hasDocker: boolean;
  scanned: ScannedFile[];
  skippedLargeFiles: number;
  codeFileCount: number;
  findings: Finding[];
  endpoints: DetectedEndpoint[];
  /** file path -> scanned files that mention it (by name) */
  references: Record<string, string[]>;
  todoCount: number;
  codeBytes: number;
  scannedLines: number;
  estimatedLoc: number;
  analyzedAt: string;
}

export const FACTS_SCHEMA_VERSION = 2;

export interface AnalysisProgress {
  step: number;
  total: number;
  label: string;
}

export type ResultSource = 'heuristic' | 'ai';
