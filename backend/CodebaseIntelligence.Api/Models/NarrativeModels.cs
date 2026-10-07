using System.ComponentModel.DataAnnotations;

namespace CodebaseIntelligence.Api.Models;

/// <summary>
/// Compact, size-bounded facts about a repository that the browser has already computed.
/// File contents are never part of this payload.
/// </summary>
public record NarrativeRepo
{
    [Required, StringLength(100)] public string Name { get; init; } = string.Empty;
    [StringLength(300)] public string Description { get; init; } = string.Empty;
    [MaxLength(8)] public List<string> Languages { get; init; } = new();
    [MaxLength(15)] public List<string> Frameworks { get; init; } = new();
    [Range(0, int.MaxValue)] public int TotalFiles { get; init; }
    [Range(0, int.MaxValue)] public int EstimatedLoc { get; init; }
    [StringLength(1000)] public string Readme { get; init; } = string.Empty;
}

public record NarrativeArea
{
    [StringLength(80)] public string Name { get; init; } = string.Empty;
    [StringLength(30)] public string Layer { get; init; } = string.Empty;
    [Range(0, int.MaxValue)] public int Files { get; init; }
    [MaxLength(8)] public List<string> DependsOn { get; init; } = new();
}

public record NarrativeFinding
{
    [StringLength(40)] public string RuleId { get; init; } = string.Empty;
    [StringLength(100)] public string Title { get; init; } = string.Empty;
    [StringLength(10)] public string Severity { get; init; } = string.Empty;
    [StringLength(200)] public string File { get; init; } = string.Empty;
    [Range(0, int.MaxValue)] public int Line { get; init; }
}

public record NarrativeEndpoint
{
    [StringLength(10)] public string Method { get; init; } = string.Empty;
    [StringLength(120)] public string Path { get; init; } = string.Empty;
    [StringLength(200)] public string File { get; init; } = string.Empty;
}

public record NarrativeDebt
{
    [Range(0, 100)] public int Score { get; init; }
    [StringLength(30)] public string Grade { get; init; } = string.Empty;
}

public record NarrativeImpact
{
    [StringLength(200)] public string Target { get; init; } = string.Empty;
    [StringLength(500)] public string Change { get; init; } = string.Empty;
    [MaxLength(20)] public List<string> Dependents { get; init; } = new();
    [MaxLength(15)] public List<string> Tests { get; init; } = new();
    [StringLength(10)] public string Risk { get; init; } = string.Empty;
}

public record NarrativeRequest
{
    [Required, RegularExpression("^(architecture|docs|debt|impact)$")]
    public string Kind { get; init; } = string.Empty;

    [Required] public NarrativeRepo Repo { get; init; } = new();
    [MaxLength(10)] public List<NarrativeArea> Areas { get; init; } = new();
    [MaxLength(20)] public List<NarrativeFinding> Findings { get; init; } = new();
    [MaxLength(25)] public List<NarrativeEndpoint> Endpoints { get; init; } = new();
    public NarrativeDebt? Debt { get; init; }
    public NarrativeImpact? Impact { get; init; }
}

public record NarrativeResponse
{
    public string Source { get; init; } = ResultSource.Fallback;
    public string Headline { get; init; } = string.Empty;
    public List<string> Paragraphs { get; init; } = new();
    public List<string> Bullets { get; init; } = new();
}
