using System.CommandLine;
using System.CommandLine.Invocation;
using System.Text.Json;
using Microsoft.Extensions.DependencyInjection;
using TwinkleTune.Application.Abstractions;
using TwinkleTune.Application.Dtos;
using TwinkleTune.Application.Services;

namespace TwinkleTune.Cli.Commands;

/// <summary>
/// <c>twinkletune song add &lt;file&gt;|list</c> — manage the songbook. A song is supplied as a
/// JSON file (title, emoji, art, bpm, difficulty, phrases) so note data never has to be
/// hardcoded; it is validated by the same <see cref="ISongService"/> the API uses.
/// </summary>
public sealed class SongCommand(IServiceScopeFactory scopeFactory) : ICliCommand
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web)
    {
        PropertyNameCaseInsensitive = true,
        ReadCommentHandling = JsonCommentHandling.Skip,
        AllowTrailingCommas = true,
    };

    public Command Build()
    {
        var command = new Command("song", "Manage the songbook.");
        command.AddCommand(BuildAdd());
        command.AddCommand(BuildList());
        return command;
    }

    private Command BuildAdd()
    {
        var fileArg = new Argument<FileInfo>(
            name: "file",
            description: "Path to a JSON file describing the song (title, emoji, art, bpm, difficulty, phrases).");

        var add = new Command("add", "Add a song from a JSON definition.");
        add.AddArgument(fileArg);

        add.SetHandler(async (InvocationContext ctx) =>
        {
            var ct = ctx.GetCancellationToken();
            var file = ctx.ParseResult.GetValueForArgument(fileArg)!;

            if (!file.Exists)
            {
                Console.Error.WriteLine($"Song file not found: {file.FullName}");
                ctx.ExitCode = 1;
                return;
            }

            SaveSongRequest? request;
            try
            {
                await using var stream = file.OpenRead();
                request = await JsonSerializer.DeserializeAsync<SaveSongRequest>(stream, JsonOptions, ct);
            }
            catch (JsonException ex)
            {
                Console.Error.WriteLine($"Could not parse '{file.FullName}': {ex.Message}");
                ctx.ExitCode = 1;
                return;
            }

            if (request is null)
            {
                Console.Error.WriteLine($"'{file.FullName}' did not contain a song.");
                ctx.ExitCode = 1;
                return;
            }

            await using var scope = scopeFactory.CreateAsyncScope();
            var sp = scope.ServiceProvider;
            await sp.GetRequiredService<IDatabaseInitializer>().EnsureCreatedAsync(ct);

            var (song, errors) = await sp.GetRequiredService<ISongService>().CreateAsync(request, ct);
            if (song is null)
            {
                Console.Error.WriteLine("Could not add song:");
                foreach (var e in errors) Console.Error.WriteLine($"  - {e}");
                ctx.ExitCode = 1;
                return;
            }

            Console.WriteLine($"Added song {song.Emoji} \"{song.Title}\" with {song.Phrases.Count} phrase(s) ({song.Id}).");
        });

        return add;
    }

    private Command BuildList()
    {
        var list = new Command("list", "List all songs.");

        list.SetHandler(async (InvocationContext ctx) =>
        {
            var ct = ctx.GetCancellationToken();
            await using var scope = scopeFactory.CreateAsyncScope();
            var sp = scope.ServiceProvider;
            await sp.GetRequiredService<IDatabaseInitializer>().EnsureCreatedAsync(ct);

            var songs = await sp.GetRequiredService<ISongService>().GetAllAsync(ct);
            if (songs.Count == 0)
            {
                Console.WriteLine("No songs yet. Run 'twinkletune seed' or 'twinkletune song add <file>'.");
                return;
            }

            foreach (var s in songs)
            {
                var tag = s.IsSeed ? "seed" : "custom";
                Console.WriteLine($"{s.Emoji}  {s.Title}  [difficulty {s.Difficulty}, {s.Bpm} bpm, {tag}]  ({s.Id})");
            }
        });

        return list;
    }
}
