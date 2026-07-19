using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using TwinkleTune.Application;
using TwinkleTune.Cli.Commands;
using TwinkleTune.Infrastructure;

namespace TwinkleTune.Cli.Hosting;

/// <summary>
/// Composition root for the CLI. It reuses the very same application and infrastructure
/// registrations the API uses (so the CLI and server share services and abstractions),
/// and registers each verb as an <see cref="ICliCommand"/>.
/// </summary>
public static class CliServiceCollectionExtensions
{
    public static IServiceCollection AddTwinkleTuneCli(this IServiceCollection services, IConfiguration config)
    {
        // Resolve storage the same way the API does, so the CLI targets the same family database.
        var dataDir = config["DataPath"] ?? Path.Combine(Environment.CurrentDirectory, "data");
        Directory.CreateDirectory(dataDir);

        var connectionString = config.GetConnectionString("Default")
                               ?? $"Data Source={Path.Combine(dataDir, "twinkletune.db")}";
        var photosPath = config["PhotosPath"] ?? Path.Combine(dataDir, "photos");

        services.AddApplicationServices();
        services.AddInfrastructure(connectionString, photosPath);

        services.AddSingleton<ICliCommand, SeedCommand>();
        services.AddSingleton<ICliCommand, SongCommand>();
        services.AddSingleton<ICliCommand, AvatarCommand>();

        return services;
    }
}
