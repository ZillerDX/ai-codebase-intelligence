using CodebaseIntelligence.Api.Services;

var builder = WebApplication.CreateBuilder(args);

// Load optional local configuration for secrets (Zero-Leak)
builder.Configuration.AddJsonFile("appsettings.local.json", optional: true, reloadOnChange: true);

// Add services
builder.Services.AddControllers();
builder.Services.AddOpenApi();

// Register HttpClient for Gemini API
builder.Services.AddHttpClient("GeminiClient", client =>
{
    client.Timeout = TimeSpan.FromSeconds(60);
});

// Register HttpClient for GitHub REST API
builder.Services.AddHttpClient("GitHubClient", client =>
{
    client.Timeout = TimeSpan.FromSeconds(30);
});

// Register Domain & AI Services
builder.Services.AddSingleton<ICodeAnalyzerService, CodeAnalyzerService>();
builder.Services.AddScoped<IGeminiService, GeminiService>();
builder.Services.AddScoped<IGitHubService, GitHubService>();

// CORS configuration for Angular frontend
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAngularApp", policy =>
    {
        policy.WithOrigins("http://localhost:4200", "http://127.0.0.1:4200")
              .AllowAnyHeader()
              .AllowAnyMethod();
    });
});

var app = builder.Build();

// Configure middleware
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseCors("AllowAngularApp");

app.UseAuthorization();

app.MapControllers();

app.Run("http://localhost:5080");
