using CodebaseIntelligence.Api.Models;
using CodebaseIntelligence.Api.Services;
using Xunit;

namespace CodebaseIntelligence.Api.Tests;

public class AnalyzerServiceTests
{
    private readonly CodeAnalyzerService _analyzer = new();

    [Fact]
    public void GetSampleProjects_ShouldReturnAtLeastTwoProjects()
    {
        var projects = _analyzer.GetSampleProjects();
        Assert.NotNull(projects);
        Assert.True(projects.Count >= 2);
    }

    [Fact]
    public void GetHighLevelSummary_ShouldContainImage2Metrics()
    {
        var summary = _analyzer.GetHighLevelSummary("ecommerce-microservices");
        
        Assert.NotNull(summary);
        Assert.Equal(145, summary.MergedPullRequests);
        Assert.Equal(86, summary.ActiveUsers);
        Assert.Equal(1.7, summary.MedianTimeToLastCommitHours);
        Assert.Equal(1.2, summary.ReviewTimeSavedDays);
        Assert.Equal(645, summary.AiReviewCommentsPosted);
        Assert.Equal(45.1, summary.AiReviewCommentsAcceptedPercent);
        Assert.Equal(4.5, summary.AvgCommentsByAi);
        Assert.Equal(6.9, summary.AvgCommentsByHuman);

        // Verify 3-Point Radar points
        Assert.Equal(3, summary.ReviewCommentsBySeverity.Count);
        Assert.Contains(summary.ReviewCommentsBySeverity, s => s.Severity == "Critical");
        Assert.Contains(summary.ReviewCommentsBySeverity, s => s.Severity == "Major");
        Assert.Contains(summary.ReviewCommentsBySeverity, s => s.Severity == "Minor");

        // Verify 8-Category breakdown
        Assert.Equal(8, summary.SuggestionsBreakdown.Count);
        Assert.Equal(8, summary.CategoryDistribution.Count);
    }

    [Fact]
    public void GetFileList_ShouldReturnCodeFiles()
    {
        var files = _analyzer.GetFileList("ecommerce-microservices");
        Assert.NotEmpty(files);
        Assert.Contains(files, f => f.Contains("CheckoutController.cs"));
    }

    [Fact]
    public void RegisterProject_ShouldAllowDynamicProjectRegistration()
    {
        var customProj = new CodebaseProject
        {
            Id = "gh-dotnet-aspnetcore",
            Name = "aspnetcore",
            Description = "ASP.NET Core framework repo",
            Languages = new() { "C#" },
            TotalFiles = 1500,
            TotalLinesOfCode = 450000,
            LastAnalyzed = DateTime.UtcNow
        };

        var customFiles = new List<string> { "src/Hosting/Program.cs", "src/Http/HttpContext.cs" };
        var context = "ASP.NET Core repo context";

        _analyzer.RegisterProject(customProj, customFiles, context);

        var retrievedProj = _analyzer.GetProject("gh-dotnet-aspnetcore");
        Assert.NotNull(retrievedProj);
        Assert.Equal("aspnetcore", retrievedProj.Name);

        var retrievedFiles = _analyzer.GetFileList("gh-dotnet-aspnetcore");
        Assert.Equal(2, retrievedFiles.Count);

        var summary = _analyzer.GetHighLevelSummary("gh-dotnet-aspnetcore");
        Assert.NotNull(summary);
        Assert.True(summary.MergedPullRequests >= 52);
    }
}
