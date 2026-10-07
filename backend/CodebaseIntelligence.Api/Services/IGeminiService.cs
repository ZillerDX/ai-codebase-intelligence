using CodebaseIntelligence.Api.Models;

namespace CodebaseIntelligence.Api.Services;

public interface IGeminiService
{
    bool IsConfigured { get; }
    Task<string> GenerateContentAsync(string prompt, string? systemInstruction = null, bool jsonMode = false, int? maxOutputTokens = null, CancellationToken cancellationToken = default);
    Task<NarrativeResponse> GenerateNarrativeAsync(NarrativeRequest request, CancellationToken cancellationToken = default);
    Task<ImpactAnalysisResult> AnalyzeImpactAsync(string targetFile, string proposedChange, string codebaseContext);
    Task<ArchitectureOverviewDto> SynthesizeArchitectureAsync(string projectId, string codebaseSummary, List<string> fileList);
    Task<SecuritySmellReportDto> AuditSecurityAndSmellsAsync(string projectId, string codebaseSummary);
    Task<DocumentationReportDto> GenerateDocumentationAndFlowAsync(string projectId, string codebaseSummary);
    Task<TechnicalDebtReportDto> EvaluateTechnicalDebtAsync(string projectId, string codebaseSummary);
}
