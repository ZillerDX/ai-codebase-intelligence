using CodebaseIntelligence.Api.Models;

namespace CodebaseIntelligence.Api.Services;

public record GitHubRepoMetadata(
    string Name,
    string FullName,
    string Description,
    string DefaultBranch,
    string Language,
    int Stars,
    int OpenIssues,
    int Forks,
    string HtmlUrl
);

public record GitHubImportResult(CodebaseProject Project, List<string> Files);

public interface IGitHubService
{
    Task<GitHubRepoMetadata?> GetRepositoryMetadataAsync(string owner, string repo, string? token = null);
    Task<List<string>> GetRepositoryFilesAsync(string owner, string repo, string branch, string? token = null);
    Task<List<CategoryBreakdown>> EstimatePrBreakdownAsync(string owner, string repo, string? token = null);
    Task<GitHubImportResult> ImportRepositoryAsync(string repoUrlOrPath, string? token = null, string? branch = null);
}
