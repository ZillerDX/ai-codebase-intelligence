using System.Collections.Concurrent;
using CodebaseIntelligence.Api.Models;

namespace CodebaseIntelligence.Api.Services;

public interface ICodeAnalyzerService
{
    List<CodebaseProject> GetSampleProjects();
    CodebaseProject? GetProject(string id);
    HighLevelSummaryDto GetHighLevelSummary(string projectId);
    string GetCodebaseContext(string projectId);
    List<string> GetFileList(string projectId);
    void RegisterProject(CodebaseProject project, List<string> files, string? context = null);
}

public class CodeAnalyzerService : ICodeAnalyzerService
{
    private readonly ConcurrentDictionary<string, CodebaseProject> _projects = new(StringComparer.OrdinalIgnoreCase);
    private readonly ConcurrentDictionary<string, List<string>> _files = new(StringComparer.OrdinalIgnoreCase);
    private readonly ConcurrentDictionary<string, string> _contexts = new(StringComparer.OrdinalIgnoreCase);

    public CodeAnalyzerService()
    {
        // Seed default sample projects
        var sample1 = new CodebaseProject
        {
            Id = "ecommerce-microservices",
            Name = "OmniCart Microservices Platform",
            Description = "Distributed e-commerce suite built with C# .NET 10 LTS, Angular 19, RabbitMQ, PostgreSQL and Redis.",
            Languages = new() { "C#", "TypeScript", "SQL", "Docker", "HTML/CSS" },
            TotalFiles = 184,
            TotalLinesOfCode = 42800,
            LastAnalyzed = DateTime.UtcNow.AddHours(-2)
        };

        var sample2 = new CodebaseProject
        {
            Id = "legacy-crm-monolith",
            Name = "Enterprise Global CRM (Legacy Monolith)",
            Description = "Legacy ERP & CRM system with tight coupling, raw SQL queries, and 12 years of technical debt.",
            Languages = new() { "C#", "JavaScript", "T-SQL", "XML" },
            TotalFiles = 430,
            TotalLinesOfCode = 112500,
            LastAnalyzed = DateTime.UtcNow.AddDays(-1)
        };

        RegisterProject(sample1, new List<string>
        {
            "src/Api/Controllers/CheckoutController.cs",
            "src/Api/Controllers/OrdersController.cs",
            "src/Api/Controllers/ProductsController.cs",
            "src/Api/Controllers/AnalyticsController.cs",
            "src/Core/Application/Orders/Commands/CreateOrderCommand.cs",
            "src/Core/Application/Orders/Commands/CreateOrderCommandHandler.cs",
            "src/Core/Application/Orders/Queries/GetOrderByIdQueryHandler.cs",
            "src/Core/Domain/Orders/Order.cs",
            "src/Core/Domain/Orders/OrderItem.cs",
            "src/Core/Domain/Orders/Events/OrderCreatedEvent.cs",
            "src/Infrastructure/Persistence/OrdersDbContext.cs",
            "src/Infrastructure/Services/PaymentGatewayAdapter.cs",
            "src/Infrastructure/Services/StripeWebhookHandler.cs",
            "src/Workers/InventorySyncWorker.cs",
            "src/Workers/EmailNotificationWorker.cs"
        }, @"
Project: OmniCart Microservices Platform
Stack: C# .NET 10 LTS Web API, Angular 19 Standalone, Entity Framework Core, PostgreSQL, Redis, RabbitMQ
Architecture: Clean Architecture + CQRS (MediatR) + Domain-Driven Design
Key Modules:
- src/Api/Controllers/CheckoutController.cs: Receives checkout commands, dispatches CreateOrderCommand via MediatR.
- src/Core/Application/Orders/Commands/CreateOrderCommandHandler.cs: Orchestrates stock reservation, creates Order aggregate, publishes OrderCreatedDomainEvent.
- src/Core/Domain/Orders/Order.cs: Aggregate root with invariants (total amount, item validation, state transitions).
- src/Infrastructure/Services/PaymentGatewayAdapter.cs: Resilient HTTP client with Polly retry and circuit breaker.
- src/Infrastructure/Persistence/OrdersDbContext.cs: EF Core PostgreSQL context with optimistic concurrency.
- src/Workers/InventorySyncWorker.cs: Background worker consuming OrderCreated event from RabbitMQ.
");

        RegisterProject(sample2, new List<string>
        {
            "Controllers/CustomerController.cs",
            "Controllers/AdminDashboardController.cs",
            "Controllers/ReportsController.cs",
            "Services/BillingEngine.cs",
            "Services/OrderProcessor.cs",
            "Data/LegacyDbRepository.cs",
            "Data/ReportingRepository.cs",
            "Models/Customer.cs",
            "Models/Invoice.cs",
            "Auth/CustomMembershipProvider.cs",
            "Auth/TokenService.cs",
            "Views/Customer/Details.cshtml",
            "Scripts/app/legacy-crm-bundle.js"
        }, @"
Project: Enterprise Global CRM (Legacy Monolith)
Stack: C# ASP.NET MVC 5, Entity Framework 6, MSSQL, jQuery
Key Modules:
- Controllers/CustomerController.cs: 2,400 LOC, handles billing, CRM, support tickets, and direct SQL execution.
- Services/BillingEngine.cs: Calculates invoices using floating point arithmetic. Calls external payment gateway synchronously without retry.
- Data/LegacyDbRepository.cs: Contains raw string concatenation for SQL statements.
- Models/Customer.cs: Monolithic entity with 86 properties and circular navigation references.
- Auth/CustomMembershipProvider.cs: MD5 hash passwords with hardcoded salt.
");
    }

    public void RegisterProject(CodebaseProject project, List<string> files, string? context = null)
    {
        _projects[project.Id] = project;
        _files[project.Id] = files;
        _contexts[project.Id] = context ?? $"Project: {project.Name}\nDescription: {project.Description}\nFiles Count: {files.Count}\nKey Files Sample:\n{string.Join("\n", files.Take(40))}";
    }

    public List<CodebaseProject> GetSampleProjects() => _projects.Values.ToList();

    public CodebaseProject? GetProject(string id)
    {
        if (_projects.TryGetValue(id, out var proj)) return proj;
        return _projects.Values.FirstOrDefault();
    }

    public HighLevelSummaryDto GetHighLevelSummary(string projectId)
    {
        var proj = GetProject(projectId);
        var isLegacy = proj?.Id == "legacy-crm-monolith";
        var isGitHub = proj?.Id.StartsWith("gh-", StringComparison.OrdinalIgnoreCase) == true;

        var mergedPrs = isGitHub ? Math.Max(52, proj!.TotalFiles / 3) : (isLegacy ? 84 : 145);
        var activeUsers = isGitHub ? Math.Max(18, proj!.TotalFiles / 6) : (isLegacy ? 42 : 86);
        var timeToCommit = isGitHub ? 2.1 : (isLegacy ? 4.2 : 1.7);
        var reviewSaved = isGitHub ? 1.5 : (isLegacy ? 0.8 : 1.2);
        var commentsPosted = isGitHub ? 540 : (isLegacy ? 890 : 645);
        var acceptedPct = isGitHub ? 48.2 : (isLegacy ? 34.2 : 45.1);

        return new HighLevelSummaryDto
        {
            ProjectId = proj?.Id ?? "ecommerce-microservices",
            ProjectName = proj?.Name ?? "OmniCart Microservices Platform",
            MergedPullRequests = mergedPrs,
            ActiveUsers = activeUsers,
            MedianTimeToLastCommitHours = timeToCommit,
            ReviewTimeSavedDays = reviewSaved,
            AiReviewCommentsPosted = commentsPosted,
            AiReviewCommentsAcceptedPercent = acceptedPct,
            AvgCommentsByAi = isGitHub ? 4.8 : (isLegacy ? 6.8 : 4.5),
            AvgCommentsByHuman = isGitHub ? 5.7 : (isLegacy ? 8.4 : 6.9),

            ReviewCommentsBySeverity = new List<SeverityPoint>
            {
                new("Critical", isLegacy ? 62 : 38, isLegacy ? 120 : 82),
                new("Major", isLegacy ? 240 : 155, isLegacy ? 480 : 310),
                new("Minor", isLegacy ? 110 : 98, isLegacy ? 290 : 253)
            },

            SuggestionsBySeverityDonut = new Dictionary<string, int>
            {
                ["Critical"] = isLegacy ? 22 : 14,
                ["Major"] = isLegacy ? 52 : 48,
                ["Minor"] = isLegacy ? 26 : 38
            },

            SuggestionsBreakdown = new List<CategoryBreakdown>
            {
                new("Code defect", isLegacy ? 45 : 32, isLegacy ? 95 : 68),
                new("Stability and availability", isLegacy ? 68 : 54, isLegacy ? 110 : 85),
                new("Security", isLegacy ? 58 : 41, isLegacy ? 102 : 79),
                new("Performance", isLegacy ? 110 : 92, isLegacy ? 165 : 125),
                new("Maintainability", isLegacy ? 42 : 28, isLegacy ? 88 : 52),
                new("Code quality", isLegacy ? 80 : 56, isLegacy ? 160 : 112),
                new("Functional correctness", isLegacy ? 140 : 118, isLegacy ? 180 : 138),
                new("Data integrity and integration", isLegacy ? 90 : 72, isLegacy ? 115 : 82)
            },

            CategoryDistribution = new List<CategoryBreakdown>
            {
                new("Code defect", isLegacy ? 40 : 32, isLegacy ? 80 : 68),
                new("Stability and availability", isLegacy ? 65 : 54, isLegacy ? 95 : 85),
                new("Security", isLegacy ? 60 : 41, isLegacy ? 90 : 79),
                new("Performance", isLegacy ? 95 : 92, isLegacy ? 130 : 125),
                new("Maintainability", isLegacy ? 50 : 28, isLegacy ? 85 : 52),
                new("Code quality", isLegacy ? 75 : 56, isLegacy ? 120 : 112),
                new("Functional correctness", isLegacy ? 120 : 118, isLegacy ? 150 : 138),
                new("Data integrity and integration", isLegacy ? 85 : 72, isLegacy ? 105 : 82)
            }
        };
    }

    public string GetCodebaseContext(string projectId)
    {
        if (_contexts.TryGetValue(projectId, out var ctx)) return ctx;
        return _contexts.Values.FirstOrDefault() ?? "No codebase context available.";
    }

    public List<string> GetFileList(string projectId)
    {
        if (_files.TryGetValue(projectId, out var list)) return list;
        return _files.Values.FirstOrDefault() ?? new List<string>();
    }
}
