using CodebaseIntelligence.Api.Services;

namespace CodebaseIntelligence.Api.Tests;

public class GitHubRepoIdentifierTests
{
    [Theory]
    [InlineData("dotnet/eShop", "dotnet", "eShop")]
    [InlineData("  dotnet/eShop/  ", "dotnet", "eShop")]
    [InlineData("https://github.com/dotnet/aspnetcore", "dotnet", "aspnetcore")]
    [InlineData("https://github.com/dotnet/aspnetcore.git", "dotnet", "aspnetcore")]
    [InlineData("https://github.com/dotnet/aspnetcore/tree/main/src", "dotnet", "aspnetcore")]
    [InlineData("github.com/angular/angular", "angular", "angular")]
    [InlineData("git@github.com:facebook/react.git", "facebook", "react")]
    [InlineData("tailwindlabs/tailwindcss", "tailwindlabs", "tailwindcss")]
    public void Parse_ShouldAcceptSupportedForms(string input, string owner, string repo)
    {
        var result = GitHubRepoIdentifier.Parse(input);
        Assert.Equal((owner, repo), result);
    }

    [Theory]
    [InlineData("")]
    [InlineData("justonepart")]
    [InlineData("a/b/c")]
    [InlineData("../etc/passwd")]
    [InlineData("owner/..")]
    [InlineData("owner/re po")]
    [InlineData("owner/repo?x=1")]
    [InlineData("-bad/repo")]
    [InlineData("https://evilgithub.com/dotnet/aspnetcore/x")]
    public void Parse_ShouldRejectInvalidInput(string input)
    {
        Assert.Throws<ArgumentException>(() => GitHubRepoIdentifier.Parse(input));
    }

    [Theory]
    [InlineData("main")]
    [InlineData("release/1.2.x")]
    [InlineData("feat/new_thing-2")]
    public void ValidateBranch_ShouldAcceptNormalNames(string branch)
    {
        Assert.Equal(branch, GitHubRepoIdentifier.ValidateBranch(branch));
    }

    [Theory]
    [InlineData("../main")]
    [InlineData("main?x=1")]
    [InlineData("main#frag")]
    [InlineData("a b")]
    [InlineData("/main")]
    [InlineData("main/")]
    [InlineData("a//b")]
    public void ValidateBranch_ShouldRejectUnsafeNames(string branch)
    {
        Assert.Throws<ArgumentException>(() => GitHubRepoIdentifier.ValidateBranch(branch));
    }

    [Fact]
    public void EscapeBranch_ShouldKeepSlashesBetweenSegments()
    {
        Assert.Equal("release/1.2.x", GitHubRepoIdentifier.EscapeBranch("release/1.2.x"));
    }
}
