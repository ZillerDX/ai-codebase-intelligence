using System.Text.RegularExpressions;

namespace CodebaseIntelligence.Api.Services;

public static partial class GitHubRepoIdentifier
{
    [GeneratedRegex(@"^(?:https?://|ssh://git@|git@)?(?:www\.)?github\.com[:/](?<owner>[^/\s]+)/(?<repo>[^/\s?#]+)", RegexOptions.IgnoreCase)]
    private static partial Regex UrlPattern();

    [GeneratedRegex(@"^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$")]
    private static partial Regex OwnerPattern();

    [GeneratedRegex(@"^[A-Za-z0-9._-]{1,100}$")]
    private static partial Regex RepoPattern();

    [GeneratedRegex(@"^[A-Za-z0-9._/-]{1,200}$")]
    private static partial Regex BranchPattern();

    public static (string Owner, string Repo) Parse(string input)
    {
        var clean = (input ?? string.Empty).Trim().TrimEnd('/');

        string owner;
        string repo;

        var match = UrlPattern().Match(clean);
        if (match.Success)
        {
            owner = match.Groups["owner"].Value;
            repo = match.Groups["repo"].Value;
        }
        else
        {
            var parts = clean.Split('/');
            if (parts.Length != 2)
            {
                throw new ArgumentException($"Invalid GitHub repository identifier. Expected 'owner/repo' or 'https://github.com/owner/repo'.");
            }
            owner = parts[0];
            repo = parts[1];
        }

        if (repo.EndsWith(".git", StringComparison.OrdinalIgnoreCase))
        {
            repo = repo[..^4];
        }

        if (!OwnerPattern().IsMatch(owner) || !RepoPattern().IsMatch(repo) || repo is "." or "..")
        {
            throw new ArgumentException("Invalid GitHub owner or repository name.");
        }

        return (owner, repo);
    }

    public static string ValidateBranch(string branch)
    {
        var value = branch.Trim();
        if (!BranchPattern().IsMatch(value)
            || value.Contains("..", StringComparison.Ordinal)
            || value.StartsWith('/') || value.EndsWith('/') || value.Contains("//", StringComparison.Ordinal))
        {
            throw new ArgumentException("Invalid branch name.");
        }
        return value;
    }

    public static string EscapeBranch(string branch) =>
        string.Join('/', branch.Split('/').Select(Uri.EscapeDataString));
}
