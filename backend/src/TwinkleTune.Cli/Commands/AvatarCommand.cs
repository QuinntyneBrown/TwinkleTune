using System.CommandLine;
using System.CommandLine.Invocation;
using Microsoft.Extensions.DependencyInjection;
using TwinkleTune.Application.Abstractions;
using TwinkleTune.Application.Dtos;
using TwinkleTune.Application.Services;

namespace TwinkleTune.Cli.Commands;

/// <summary>
/// <c>twinkletune avatar add|list</c> — manage the pickable singer avatars. Validation runs
/// through the same <see cref="IAvatarService"/> the API uses, so CLI-created avatars obey
/// the identical rules.
/// </summary>
public sealed class AvatarCommand(IServiceScopeFactory scopeFactory) : ICliCommand
{
    public Command Build()
    {
        var command = new Command("avatar", "Manage pickable singer avatars.");
        command.AddCommand(BuildAdd());
        command.AddCommand(BuildList());
        return command;
    }

    private Command BuildAdd()
    {
        var emojiOption = new Option<string>(aliases: ["--emoji", "-e"], description: "Emoji shown for the avatar.")
        { IsRequired = true };
        var nameOption = new Option<string>(aliases: ["--name", "-n"], description: "Friendly avatar name (max 30 characters).")
        { IsRequired = true };

        var add = new Command("add", "Add a new avatar.");
        add.AddOption(emojiOption);
        add.AddOption(nameOption);

        add.SetHandler(async (InvocationContext ctx) =>
        {
            var ct = ctx.GetCancellationToken();
            var request = new SaveAvatarRequest(
                ctx.ParseResult.GetValueForOption(emojiOption)!,
                ctx.ParseResult.GetValueForOption(nameOption)!);

            await using var scope = scopeFactory.CreateAsyncScope();
            var sp = scope.ServiceProvider;
            await sp.GetRequiredService<IDatabaseInitializer>().EnsureCreatedAsync(ct);

            var (avatar, error) = await sp.GetRequiredService<IAvatarService>().CreateAsync(request, ct);
            if (avatar is null)
            {
                Console.Error.WriteLine($"Could not add avatar: {error}");
                ctx.ExitCode = 1;
                return;
            }

            Console.WriteLine($"Added avatar {avatar.Emoji} {avatar.Name} ({avatar.Id}).");
        });

        return add;
    }

    private Command BuildList()
    {
        var list = new Command("list", "List all avatars.");

        list.SetHandler(async (InvocationContext ctx) =>
        {
            var ct = ctx.GetCancellationToken();
            await using var scope = scopeFactory.CreateAsyncScope();
            var sp = scope.ServiceProvider;
            await sp.GetRequiredService<IDatabaseInitializer>().EnsureCreatedAsync(ct);

            var avatars = await sp.GetRequiredService<IAvatarService>().GetAllAsync(ct);
            if (avatars.Count == 0)
            {
                Console.WriteLine("No avatars yet. Run 'twinkletune seed' or 'twinkletune avatar add'.");
                return;
            }

            foreach (var a in avatars)
                Console.WriteLine($"{a.Emoji}  {a.Name}  ({a.Id})");
        });

        return list;
    }
}
