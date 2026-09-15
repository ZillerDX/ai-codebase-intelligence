namespace CodebaseIntelligence.Api.Models;

public record CodebaseProject
{
    public string Id { get; init; } = string.Empty;
    public string Name { get; init; } = string.Empty;
    public string Description { get; init; } = string.Empty;
    public List<string> Languages { get; init; } = new();
    public int TotalFiles { get; init; }
    public int TotalLinesOfCode { get; init; }
    public DateTime LastAnalyzed { get; init; } = DateTime.UtcNow;
}

public record MetricCard(string Title, string Value, string Unit, string Subtitle, string? SecondaryValue = null, string? SecondaryLabel = null);

public record SeverityPoint(string Severity, int Accepted, int Posted);

public record CategoryBreakdown(string Category, int Accepted, int Posted);

public record HighLevelSummaryDto
{
    public string ProjectId { get; init; } = string.Empty;
    public string ProjectName { get; init; } = string.Empty;
    
    // 6 Metric Cards matching Image 2
    public int MergedPullRequests { get; init; } = 145;
    public int ActiveUsers { get; init; } = 86;
    public double MedianTimeToLastCommitHours { get; init; } = 1.7;
    public double ReviewTimeSavedDays { get; init; } = 1.2;
    public int AiReviewCommentsPosted { get; init; } = 645;
    public double AiReviewCommentsAcceptedPercent { get; init; } = 45.1;
    public double AvgCommentsByAi { get; init; } = 4.5;
    public double AvgCommentsByHuman { get; init; } = 6.9;

    // Review Comments by Severity (Radar: Critical, Major, Minor)
    public List<SeverityPoint> ReviewCommentsBySeverity { get; init; } = new();

    // Suggestions by Severity (Donut)
    public Dictionary<string, int> SuggestionsBySeverityDonut { get; init; } = new();

    // Suggestions Breakdown (Horizontal stacked bar across 8 categories)
    public List<CategoryBreakdown> SuggestionsBreakdown { get; init; } = new();

    // Category Distribution (8-axis Radar)
    public List<CategoryBreakdown> CategoryDistribution { get; init; } = new();
}

public record ArchitectureComponentDto(string Name, string Layer, string Description, int FileCount, List<string> Dependencies);

public record ArchitectureOverviewDto
{
    public string ProjectId { get; init; } = string.Empty;
    public string ArchitecturePattern { get; init; } = string.Empty;
    public string Summary { get; init; } = string.Empty;
    public string MermaidDiagram { get; init; } = string.Empty;
    public List<ArchitectureComponentDto> Components { get; init; } = new();
    public Dictionary<string, string> TechStack { get; init; } = new();
}

public record ImpactAnalysisRequest(string ProjectId, string TargetFile, string ProposedChange);

public record ImpactAnalysisResult
{
    public string TargetFile { get; init; } = string.Empty;
    public string BlastRadiusLevel { get; init; } = "Medium"; // Low, Medium, High, Critical
    public List<string> AffectedComponents { get; init; } = new();
    public List<string> AffectedFiles { get; init; } = new();
    public List<string> BreakingChangeRisks { get; init; } = new();
    public List<string> TestingRecommendations { get; init; } = new();
    public string SeniorDevAdvice { get; init; } = string.Empty;
    public string ArchitectureImpactDiagram { get; init; } = string.Empty;
}

public record CodeIssueItemDto(
    string Id,
    string Title,
    string Severity, // Critical, Major, Minor
    string Category, // Code defect, Security, Performance, Maintainability, etc.
    string File,
    int LineNumber,
    string Description,
    string Recommendation,
    string CodeSnippet
);

public record SecuritySmellReportDto
{
    public string ProjectId { get; init; } = string.Empty;
    public int TotalIssues { get; init; }
    public int CriticalCount { get; init; }
    public int MajorCount { get; init; }
    public int MinorCount { get; init; }
    public List<CodeIssueItemDto> Issues { get; init; } = new();
}

public record ApiEndpointDocDto(
    string Method,
    string Path,
    string Summary,
    string RequestPayload,
    string ResponsePayload,
    bool RequiresAuth
);

public record DocumentationReportDto
{
    public string ProjectId { get; init; } = string.Empty;
    public string SystemOverview { get; init; } = string.Empty;
    public List<ApiEndpointDocDto> Endpoints { get; init; } = new();
    public string ApiFlowMermaid { get; init; } = string.Empty;
    public string GeneratedMarkdown { get; init; } = string.Empty;
}

public record RefactorTargetDto(string File, string Reason, string Priority, double EstimatedHoursSaved);

public record TechnicalDebtReportDto
{
    public string ProjectId { get; init; } = string.Empty;
    public int DebtScore { get; init; } // e.g. 78/100 (Higher is healthier)
    public double EstimatedRemediationHours { get; init; }
    public double TechnicalDebtRatioPercent { get; init; }
    public List<RefactorTargetDto> RefactorTargets { get; init; } = new();
    public string SeniorDevRoadmap { get; init; } = string.Empty;
}

public record GitHubImportRequest(
    string RepoUrl,
    string? PersonalAccessToken = null,
    string? Branch = null
);

public record GitHubRepoSuggestionDto(
    string FullName,
    string Description,
    string Language,
    int Stars
);
