using CodebaseIntelligence.Api.Controllers;
using CodebaseIntelligence.Api.Models;
using CodebaseIntelligence.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging.Abstractions;

namespace CodebaseIntelligence.Api.Tests;

public class AnalysisControllerTests
{
    private sealed class ThrowingGemini : IGeminiService
    {
        public Task<string> GenerateContentAsync(string prompt, string? systemInstruction = null, bool jsonMode = false) => throw new InvalidOperationException("Gemini must not be called");
        public Task<ImpactAnalysisResult> AnalyzeImpactAsync(string targetFile, string proposedChange, string codebaseContext) => throw new InvalidOperationException("Gemini must not be called");
        public Task<ArchitectureOverviewDto> SynthesizeArchitectureAsync(string projectId, string codebaseSummary, List<string> fileList) => throw new InvalidOperationException("Gemini must not be called");
        public Task<SecuritySmellReportDto> AuditSecurityAndSmellsAsync(string projectId, string codebaseSummary) => throw new InvalidOperationException("Gemini must not be called");
        public Task<DocumentationReportDto> GenerateDocumentationAndFlowAsync(string projectId, string codebaseSummary) => throw new InvalidOperationException("Gemini must not be called");
        public Task<TechnicalDebtReportDto> EvaluateTechnicalDebtAsync(string projectId, string codebaseSummary) => throw new InvalidOperationException("Gemini must not be called");
    }

    private sealed class StubGitHub(Exception? toThrow = null) : IGitHubService
    {
        public Task<GitHubRepoMetadata?> GetRepositoryMetadataAsync(string owner, string repo, string? token = null) => Task.FromResult<GitHubRepoMetadata?>(null);
        public Task<List<string>> GetRepositoryFilesAsync(string owner, string repo, string branch, string? token = null) => Task.FromResult(new List<string>());
        public Task<List<CategoryBreakdown>> EstimatePrBreakdownAsync(string owner, string repo, string? token = null) => Task.FromResult(new List<CategoryBreakdown>());
        public Task<GitHubImportResult> ImportRepositoryAsync(string repoUrlOrPath, string? token = null, string? branch = null) =>
            toThrow is null
                ? Task.FromResult(new GitHubImportResult(new CodebaseProject { Id = "gh-a-b", Name = "a/b" }, new List<string> { "x.cs" }))
                : throw toThrow;
    }

    private static AnalysisController Create(IGitHubService? github = null) =>
        new(new CodeAnalyzerService(), new ThrowingGemini(), github ?? new StubGitHub(), NullLogger<AnalysisController>.Instance);

    [Fact]
    public async Task UnknownProject_ShouldReturn404OnEveryProjectEndpoint()
    {
        var c = Create();
        const string id = "does-not-exist";

        Assert.IsType<NotFoundObjectResult>(c.GetSummary(id).Result);
        Assert.IsType<NotFoundObjectResult>(c.GetFiles(id).Result);
        Assert.IsType<NotFoundObjectResult>((await c.GetArchitecture(id)).Result);
        Assert.IsType<NotFoundObjectResult>((await c.AnalyzeImpact(id, new ImpactAnalysisRequest(id, "", ""))).Result);
        Assert.IsType<NotFoundObjectResult>((await c.GetSecuritySmells(id)).Result);
        Assert.IsType<NotFoundObjectResult>((await c.GetDocumentation(id)).Result);
        Assert.IsType<NotFoundObjectResult>((await c.GetTechnicalDebt(id)).Result);
    }

    [Fact]
    public void KnownProject_ShouldReturnOk()
    {
        var c = Create();
        Assert.IsType<OkObjectResult>(c.GetSummary("ecommerce-microservices").Result);
        Assert.IsType<OkObjectResult>(c.GetFiles("legacy-crm-monolith").Result);
    }

    [Fact]
    public async Task Import_WithInvalidIdentifier_ShouldReturn400()
    {
        var c = Create(new StubGitHub(new ArgumentException("Invalid GitHub owner or repository name.")));
        var result = await c.ImportGitHubRepository(new GitHubImportRequest("../../x"));
        Assert.IsType<BadRequestObjectResult>(result.Result);
    }

    [Fact]
    public async Task Import_WhenRepoMissingOrEmpty_ShouldReturn404()
    {
        var c = Create(new StubGitHub(new InvalidOperationException("not found")));
        var result = await c.ImportGitHubRepository(new GitHubImportRequest("a/b"));
        Assert.IsType<NotFoundObjectResult>(result.Result);
    }

    [Fact]
    public async Task Import_Success_ShouldRegisterProject()
    {
        var c = Create();
        var result = await c.ImportGitHubRepository(new GitHubImportRequest("a/b"));
        Assert.IsType<OkObjectResult>(result.Result);
        Assert.IsType<OkObjectResult>(c.GetFiles("gh-a-b").Result);
    }
}
