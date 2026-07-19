using System.CommandLine;
using System.CommandLine.Invocation;
using Microsoft.Extensions.DependencyInjection;
using TwinkleTune.Application.Abstractions;
using TwinkleTune.Application.Abstractions.Seeding;
using TwinkleTune.Infrastructure.Seeding;

namespace TwinkleTune.Cli.Commands;

/// <summary>
/// <c>twinkletune seed</c> — installs the built-in catalog (or one supplied via <c>--file</c>)
/// into the database. Idempotent: families that already have avatars or songs are left alone.
/// </summary>
public sealed class SeedCommand(IServiceScopeFactory scopeFactory) : ICliCommand
{
    public Command Build()
    {
        var fileOption = new Option<FileInfo?>(
            aliases: ["--file", "-f"],
            description: "Seed from this JSON catalog instead of the built-in one.");

        var command = new Command("seed", "Seed the database with the built-in (or a supplied) catalog. Safe to re-run.");
        command.AddOption(fileOption);

        command.SetHandler(async (InvocationContext ctx) =>
        {
            var ct = ctx.GetCancellationToken();
            var file = ctx.ParseResult.GetValueForOption(fileOption);

            await using var scope = scopeFactory.CreateAsyncScope();
            var sp = scope.ServiceProvider;

            await sp.GetRequiredService<IDatabaseInitializer>().EnsureCreatedAsync(ct);
            var seeder = sp.GetRequiredService<IDatabaseSeeder>();

            SeedResult result;
            if (file is not null)
            {
                if (!file.Exists)
                {
                    Console.Error.WriteLine($"Seed file not found: {file.FullName}");
                    ctx.ExitCode = 1;
                    return;
                }

                result = await seeder.SeedAsync(new FileSeedDataSource(file.FullName), ct);
            }
            else
            {
                result = await seeder.SeedAsync(ct);
            }

            Console.WriteLine(result.AddedAnything
                ? $"Seeded {result.AvatarsAdded} avatar(s) and {result.SongsAdded} song(s)."
                : "Nothing to seed — avatars and songs are already present.");
        });

        return command;
    }
}
