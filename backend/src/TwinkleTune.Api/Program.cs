using TwinkleTune.Api.Hubs;
using TwinkleTune.Application;
using TwinkleTune.Infrastructure;
using TwinkleTune.Infrastructure.Persistence;

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
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    db.Database.EnsureCreated();
    await SeedData.EnsureSeededAsync(db);
}

app.UseCors("app");
if (app.Environment.IsDevelopment()) app.MapOpenApi();

app.MapGet("/health", () => Results.Ok(new { status = "ok" }));
app.MapControllers();
app.MapHub<DuetHub>("/hubs/duet");

app.Run();

// exposes the entry point to WebApplicationFactory in integration tests
public partial class Program;
