using TwinkleTune.Api.Hubs;
using TwinkleTune.Application;
using TwinkleTune.Application.Abstractions;
using TwinkleTune.Application.Abstractions.Seeding;
using TwinkleTune.Infrastructure;

var builder = WebApplication.CreateBuilder(args);

var dataDir = builder.Configuration["DataPath"] ?? Path.Combine(builder.Environment.ContentRootPath, "data");
Directory.CreateDirectory(dataDir);
var connectionString = builder.Configuration.GetConnectionString("Default")
                       ?? $"Data Source={Path.Combine(dataDir, "twinkletune.db")}";
var photosPath = builder.Configuration["PhotosPath"] ?? Path.Combine(dataDir, "photos");

builder.Services.AddApplicationServices();
builder.Services.AddInfrastructure(connectionString, photosPath);
builder.Services.AddControllers();
builder.Services.AddSignalR();
builder.Services.AddOpenApi();

var origins = builder.Configuration.GetSection("Cors:Origins").Get<string[]>() ?? ["http://localhost:5173"];
builder.Services.AddCors(o => o.AddPolicy("app", p =>
    p.WithOrigins(origins).AllowAnyHeader().AllowAnyMethod().AllowCredentials()));

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    await scope.ServiceProvider.GetRequiredService<IDatabaseInitializer>().EnsureCreatedAsync();

    // Seeding is data-driven (Infrastructure/Persistence/seed-data.json) and owned by the CLI
    // for operational use; the API auto-seeds on boot unless a deployment opts out.
    if (builder.Configuration.GetValue("Seeding:AutoSeedOnStartup", true))
        await scope.ServiceProvider.GetRequiredService<IDatabaseSeeder>().SeedAsync();
}

app.UseCors("app");
if (app.Environment.IsDevelopment()) app.MapOpenApi();

app.MapGet("/health", () => Results.Ok(new { status = "ok" }));
app.MapControllers();
app.MapHub<DuetHub>("/hubs/duet");

app.Run();

// exposes the entry point to WebApplicationFactory in integration tests
public partial class Program;
