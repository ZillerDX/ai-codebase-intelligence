using CodebaseIntelligence.Api.Models;
using CodebaseIntelligence.Api.Services;
using Microsoft.AspNetCore.Mvc;

namespace CodebaseIntelligence.Api.Controllers;

/// <summary>
/// Optional AI commentary for repositories the browser has already analysed.
/// The browser sends compact facts; this endpoint never fetches code or talks to GitHub.
/// </summary>
[ApiController]
[Route("api/analysis/ai")]
public class AiController : ControllerBase
{
    private readonly IGeminiService _gemini;

    public AiController(IGeminiService gemini)
    {
        _gemini = gemini;
    }

    /// <summary>Tells the UI whether AI commentary can be offered.</summary>
    [HttpGet("status")]
    public ActionResult<object> GetStatus() => Ok(new { configured = _gemini.IsConfigured });

    [HttpPost("narrative")]
    [RequestSizeLimit(64 * 1024)]
    public async Task<ActionResult<NarrativeResponse>> CreateNarrative([FromBody] NarrativeRequest request, CancellationToken cancellationToken)
    {
        if (request.Kind == "impact" && request.Impact is null)
        {
            return BadRequest(new { message = "An impact narrative needs the 'impact' section." });
        }

        var response = await _gemini.GenerateNarrativeAsync(request, cancellationToken);
        return Ok(response);
    }
}
