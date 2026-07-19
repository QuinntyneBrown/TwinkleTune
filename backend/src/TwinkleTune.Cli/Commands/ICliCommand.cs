using System.CommandLine;

namespace TwinkleTune.Cli.Commands;

/// <summary>
/// A self-contained CLI verb. New commands are added by implementing this interface and
/// registering it in DI — the composition root discovers them without being modified
/// (open/closed), and each command depends only on the application services it needs.
/// </summary>
public interface ICliCommand
{
    Command Build();
}
