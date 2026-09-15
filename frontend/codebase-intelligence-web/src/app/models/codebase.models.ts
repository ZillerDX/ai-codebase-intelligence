export interface CodebaseProject {
  id: string;
  name: string;
  description: string;
  languages: string[];
  totalFiles: number;
  totalLinesOfCode: number;
  lastAnalyzed: string;
}

export interface SeverityPoint {
  severity: string;
  accepted: number;
  posted: number;
}

export interface CategoryBreakdown {
  category: string;
  accepted: number;
  posted: number;
}

export interface HighLevelSummaryDto {
  projectId: string;
  projectName: string;
  mergedPullRequests: number;
  activeUsers: number;
  medianTimeToLastCommitHours: number;
  reviewTimeSavedDays: number;
  aiReviewCommentsPosted: number;
  aiReviewCommentsAcceptedPercent: number;
  avgCommentsByAi: number;
  avgCommentsByHuman: number;
  reviewCommentsBySeverity: SeverityPoint[];
  suggestionsBySeverityDonut: Record<string, number>;
  suggestionsBreakdown: CategoryBreakdown[];
  categoryDistribution: CategoryBreakdown[];
}

export interface ArchitectureComponentDto {
  name: string;
  layer: string;
  description: string;
  fileCount: number;
  dependencies: string[];
}

export interface ArchitectureOverviewDto {
  projectId: string;
  architecturePattern: string;
  summary: string;
  mermaidDiagram: string;
  components: ArchitectureComponentDto[];
  techStack: Record<string, string>;
}

export interface ImpactAnalysisRequest {
  projectId: string;
  targetFile: string;
  proposedChange: string;
}

export interface ImpactAnalysisResult {
  targetFile: string;
  blastRadiusLevel: 'Low' | 'Medium' | 'High' | 'Critical';
  affectedComponents: string[];
  affectedFiles: string[];
  breakingChangeRisks: string[];
  testingRecommendations: string[];
  seniorDevAdvice: string;
  architectureImpactDiagram: string;
}

export interface CodeIssueItemDto {
  id: string;
  title: string;
  severity: 'Critical' | 'Major' | 'Minor';
  category: string;
  file: string;
  lineNumber: number;
  description: string;
  recommendation: string;
  codeSnippet: string;
}

export interface SecuritySmellReportDto {
  projectId: string;
  totalIssues: number;
  criticalCount: number;
  majorCount: number;
  minorCount: number;
  issues: CodeIssueItemDto[];
}

export interface ApiEndpointDocDto {
  method: string;
  path: string;
  summary: string;
  requestPayload: string;
  responsePayload: string;
  requiresAuth: boolean;
}

export interface DocumentationReportDto {
  projectId: string;
  systemOverview: string;
  endpoints: ApiEndpointDocDto[];
  apiFlowMermaid: string;
  generatedMarkdown: string;
}

export interface RefactorTargetDto {
  file: string;
  reason: string;
  priority: 'High' | 'Medium' | 'Low';
  estimatedHoursSaved: number;
}

export interface TechnicalDebtReportDto {
  projectId: string;
  debtScore: number;
  estimatedRemediationHours: number;
  technicalDebtRatioPercent: number;
  refactorTargets: RefactorTargetDto[];
  seniorDevRoadmap: string;
}

export interface GitHubRepoSuggestion {
  fullName: string;
  description: string;
  language: string;
  stars: number;
}
