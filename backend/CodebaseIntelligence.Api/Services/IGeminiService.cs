using CodebaseIntelligence.Api.Models;

namespace CodebaseIntelligence.Api.Services;

public interface IGeminiService
{
    Task<string> GenerateContentAsync(string prompt, string? systemInstruction = null, bool jsonMode = false);
    Task<ImpactAnalysisResult> AnalyzeImpactAsync(string targetFile, string proposedChange, string codebaseContext);
    Task<ArchitectureOverviewDto> SynthesizeArchitectureAsync(string projectId, string codebaseSummary, List<string> fileList);
    Task<SecuritySmellReportDto> AuditSecurityAndSmellsAsync(string projectId, string codebaseSummary);
    Task<DocumentationReportDto> GenerateDocumentationAndFlowAsync(string projectId, string codebaseSummary);
    Task<TechnicalDebtReportDto> EvaluateTechnicalDebtAsync(string projectId, string codebaseSummary);
}
