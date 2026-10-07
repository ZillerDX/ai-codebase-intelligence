import { GitHubClient } from './github-client';
import {
  AnalysisProgress,
  DetectedEndpoint,
  FACTS_SCHEMA_VERSION,
  Finding,
  LanguageShare,
  RepoFacts,
  RepoRef,
  ScannedFile,
} from './models';
import {
  buildReferences,
  cleanReadme,
  detectSignals,
  filterTree,
  findReadme,
  isCodeFile,
  parseManifest,
  scanFile,
  selectFilesToScan,
  selectManifests,
} from './scanner';

export interface AnalyzeOptions {
  branch?: string;
  maxScanFiles?: number;
  concurrency?: number;
  onProgress?: (p: AnalysisProgress) => void;
}

const SEVERITY_RANK = { critical: 0, major: 1, minor: 2 } as const;
const MAX_FINDINGS = 250;
const MAX_STORED_FILES = 4000;
const MAX_ENDPOINTS = 150;
const DEFAULT_BYTES_PER_LINE = 36;
const TOTAL_STEPS = 4;

async function mapPool<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return results;
}

export function summarizeLanguages(
  bytesByLanguage: Record<string, number>,
  top = 8,
): LanguageShare[] {
  const entries = Object.entries(bytesByLanguage)
    .filter(([, b]) => b > 0)
    .sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((sum, [, b]) => sum + b, 0);
  if (total === 0) return [];
  const shown = entries
    .slice(0, top)
    .map(([name, bytes]) => ({ name, bytes, percent: (bytes / total) * 100 }));
  const rest = entries.slice(top).reduce((sum, [, b]) => sum + b, 0);
  if (rest > 0) shown.push({ name: 'Other', bytes: rest, percent: (rest / total) * 100 });
  return shown;
}

export async function analyzeRepository(
  ref: RepoRef,
  client: GitHubClient,
  options: AnalyzeOptions = {},
): Promise<RepoFacts> {
  const progress = (step: number, label: string) =>
    options.onProgress?.({ step, total: TOTAL_STEPS, label });

  progress(1, 'Reading repository details');
  const [meta, languageBytes] = await Promise.all([client.getRepo(ref), client.getLanguages(ref)]);
  const branch = options.branch ?? meta.defaultBranch;

  progress(2, 'Reading the file tree');
  const tree = await client.getTree(ref, branch);
  const files = filterTree(tree.files);

  // Non-critical lookups run alongside the file reads.
  const prCount = client.countMergedPullRequests(ref);
  const contributorCount = client.countContributors(ref);

  const { selected, skippedLarge } = selectFilesToScan(files, options.maxScanFiles ?? 120);
  const manifestPaths = selectManifests(files);
  const readmePath = findReadme(files);
  const toFetch = [
    ...new Set([...selected, ...manifestPaths, ...(readmePath ? [readmePath] : [])]),
  ];

  let done = 0;
  progress(3, `Reading source files (0/${toFetch.length})`);
  const texts = new Map<string, string>();
  await mapPool(toFetch, options.concurrency ?? 8, async (path) => {
    const text = await client.getRaw(ref, branch, path);
    if (text !== null) texts.set(path, text);
    done++;
    if (done % 5 === 0 || done === toFetch.length)
      progress(3, `Reading source files (${done}/${toFetch.length})`);
  });

  progress(4, 'Scanning for issues');
  const frameworks = new Set<string>();
  let scripts: Record<string, string> = {};
  for (const path of manifestPaths) {
    const text = texts.get(path);
    if (text === undefined) continue;
    const info = parseManifest(path, text);
    info.frameworks.forEach((f) => frameworks.add(f));
    if (Object.keys(scripts).length === 0 && Object.keys(info.scripts).length > 0)
      scripts = info.scripts;
  }

  const scanned: ScannedFile[] = [];
  const findings: Finding[] = [];
  const endpoints: DetectedEndpoint[] = [];
  const scannedTexts = new Map<string, string>();
  let todoCount = 0;

  for (const path of selected) {
    const text = texts.get(path);
    if (text === undefined) continue;
    const result = scanFile(path, text);
    scanned.push(result.scanned);
    findings.push(...result.findings);
    endpoints.push(...result.endpoints);
    todoCount += result.todoCount;
    if (isCodeFile(path)) scannedTexts.set(path, text);
  }

  findings.sort(
    (a, b) =>
      SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] ||
      a.file.localeCompare(b.file) ||
      a.line - b.line,
  );

  const codeFiles = files.filter((f) => isCodeFile(f.path));
  const codeBytes = codeFiles.reduce((sum, f) => sum + f.size, 0);
  const scannedCode = scanned.filter((s) => isCodeFile(s.path));
  const scannedLines = scannedCode.reduce((sum, s) => sum + s.lines, 0);
  const scannedBytes = scannedCode.reduce((sum, s) => sum + s.bytes, 0);
  const bytesPerLine = scannedLines > 0 ? scannedBytes / scannedLines : DEFAULT_BYTES_PER_LINE;
  const estimatedLoc =
    scannedCode.length >= codeFiles.length ? scannedLines : Math.round(codeBytes / bytesPerLine);

  const readmeText = readmePath ? texts.get(readmePath) : undefined;

  return {
    schemaVersion: FACTS_SCHEMA_VERSION,
    ref,
    fullName: meta.fullName,
    description: meta.description,
    htmlUrl: meta.htmlUrl,
    branch,
    stars: meta.stars,
    forks: meta.forks,
    openIssues: meta.openIssues,
    license: meta.license,
    pushedAt: meta.pushedAt,
    primaryLanguage: meta.primaryLanguage,
    contributors: await contributorCount,
    mergedPullRequests: await prCount,
    languages: summarizeLanguages(languageBytes),
    files: files.slice(0, MAX_STORED_FILES),
    totalFiles: files.length,
    treeTruncated: tree.truncated || files.length > MAX_STORED_FILES,
    readmeExcerpt: readmeText ? cleanReadme(readmeText) : '',
    frameworks: [...frameworks].sort(),
    scripts,
    ...detectSignals(files),
    scanned,
    skippedLargeFiles: skippedLarge,
    codeFileCount: codeFiles.length,
    findings: findings.slice(0, MAX_FINDINGS),
    endpoints: endpoints.slice(0, MAX_ENDPOINTS),
    references: buildReferences(scannedTexts),
    todoCount,
    codeBytes,
    scannedLines,
    estimatedLoc,
    analyzedAt: new Date().toISOString(),
  };
}
