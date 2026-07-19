using System.CommandLine;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using TwinkleTune.Cli.Commands;
using TwinkleTune.Cli.Hosting;

// The Generic Host gives us configuration (appsettings.json + environment variables),
// logging and dependency injection — the "Microsoft extensions" backbone. Args are parsed
// by System.CommandLine below, not by the host, so the verbs never reach the config binder.
var builder = Host.CreateApplicationBuilder();
builder.Logging.SetMinimumLevel(LogLevel.Warning);
builder.Services.AddTwinkleTuneCli(builder.Configuration);

using var host = builder.Build();

var root = new RootCommand("TwinkleTune admin CLI — seed the database and manage songs and avatars.");
foreach (var command in host.Services.GetServices<ICliCommand>())
    root.AddCommand(command.Build());

return await root.InvokeAsync(args);
