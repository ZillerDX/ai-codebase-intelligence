using CodebaseIntelligence.Api.Models;
using CodebaseIntelligence.Api.Services;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;

namespace CodebaseIntelligence.Api.Tests;

public class GeminiServiceTests
{
    private sealed class StubHandler(Func<HttpRequestMessage, HttpResponseMessage> respond) : HttpMessageHandler
    {
        public List<HttpRequestMessage> Requests { get; } = new();

        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            Requests.Add(request);
            return Task.FromResult(respond(request));
        }
    }

    private sealed class StubFactory(HttpMessageHandler handler) : IHttpClientFactory
    {
        public HttpClient CreateClient(string name) => new(handler);
    }

    private static GeminiService CreateService(StubHandler handler, string? apiKey)
    {
        var settings = new Dictionary<string, string?> { ["Gemini:ApiKey"] = apiKey };
        var config = new ConfigurationBuilder().AddInMemoryCollection(settings).Build();
        return new GeminiService(new StubFactory(handler), config, NullLogger<GeminiService>.Instance);
    }

    private static HttpResponseMessage GeminiReply(string innerText)
    {
        var body = System.Text.Json.JsonSerializer.Serialize(new
        {
            candidates = new[] { new { content = new { parts = new[] { new { text = innerText } } } } }
        });
        return new HttpResponseMessage(System.Net.HttpStatusCode.OK)
        {
            Content = new StringContent(body, System.Text.Encoding.UTF8, "application/json")
        };
    }

    [Fact]
    public async Task GenerateContent_ShouldSendKeyInHeaderNotInUrl()
    {
        var handler = new StubHandler(_ => GeminiReply("hello"));
        var service = CreateService(handler, "secret-key-123");

        var text = await service.GenerateContentAsync("prompt");

        Assert.Equal("hello", text);
        var request = Assert.Single(handler.Requests);
        Assert.DoesNotContain("secret-key-123", request.RequestUri!.ToString());
        Assert.DoesNotContain("key=", request.RequestUri.Query);
        Assert.Equal("secret-key-123", Assert.Single(request.Headers.GetValues("x-goog-api-key")));
    }

    [Fact]
    public async Task AnalyzeImpact_WithoutApiKey_ShouldReturnFallbackSource()
    {
        var handler = new StubHandler(_ => GeminiReply("{}"));
        var service = CreateService(handler, apiKey: null);

        var result = await service.AnalyzeImpactAsync("src/A.cs", "change", "ctx");

        Assert.Equal(ResultSource.Fallback, result.Source);
        Assert.Empty(handler.Requests);
    }

    [Fact]
    public async Task AnalyzeImpact_WithValidAiJson_ShouldReturnAiSource()
    {
        const string json = "{\"blastRadiusLevel\":\"Low\",\"seniorDevAdvice\":\"Ship it behind a flag.\",\"source\":\"fallback\"}";
        var handler = new StubHandler(_ => GeminiReply(json));
        var service = CreateService(handler, "k");

        var result = await service.AnalyzeImpactAsync("src/A.cs", "change", "ctx");

        Assert.Equal(ResultSource.Ai, result.Source);
        Assert.Equal("Low", result.BlastRadiusLevel);
    }

    [Fact]
    public async Task AnalyzeImpact_WhenGeminiFails_ShouldReturnFallbackSource()
    {
        var handler = new StubHandler(_ => new HttpResponseMessage(System.Net.HttpStatusCode.InternalServerError));
        var service = CreateService(handler, "k");

        var result = await service.AnalyzeImpactAsync("src/A.cs", "change", "ctx");

        Assert.Equal(ResultSource.Fallback, result.Source);
    }

    [Fact]
    public async Task AllReports_WithoutApiKey_ShouldBeMarkedFallback()
    {
        var service = CreateService(new StubHandler(_ => GeminiReply("{}")), apiKey: "");

        Assert.Equal(ResultSource.Fallback, (await service.SynthesizeArchitectureAsync("p", "ctx", new())).Source);
        Assert.Equal(ResultSource.Fallback, (await service.AuditSecurityAndSmellsAsync("p", "ctx")).Source);
        Assert.Equal(ResultSource.Fallback, (await service.GenerateDocumentationAndFlowAsync("p", "ctx")).Source);
        Assert.Equal(ResultSource.Fallback, (await service.EvaluateTechnicalDebtAsync("p", "ctx")).Source);
    }
}
