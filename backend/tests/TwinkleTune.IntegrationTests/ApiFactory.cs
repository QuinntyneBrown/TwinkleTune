using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http.Connections;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.SignalR.Client;

namespace TwinkleTune.IntegrationTests;

/// <summary>Boots the real API on a temp SQLite file and temp photo folder.</summary>
public class ApiFactory : WebApplicationFactory<Program>
{
    private readonly string _root = Path.Combine(Path.GetTempPath(), $"twinkletune-test-{Guid.NewGuid():N}");

    public string PhotosPath => Path.Combine(_root, "photos");

    /// <summary>Short, so a test can wait out the reconnect grace of a dropped duet singer.</summary>
    public static readonly TimeSpan ReconnectGrace = TimeSpan.FromSeconds(2);

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        Directory.CreateDirectory(_root);
        builder.UseSetting("ConnectionStrings:Default", $"Data Source={Path.Combine(_root, "test.db")}");
        builder.UseSetting("PhotosPath", PhotosPath);
        builder.UseSetting("DataPath", _root);
        builder.UseSetting("Duet:ReconnectGraceSeconds", ReconnectGrace.TotalSeconds.ToString());
    }

    /// <summary>Opens a started duet hub connection against the in-memory test server.</summary>
    public async Task<HubConnection> ConnectDuetAsync()
    {
        var connection = new HubConnectionBuilder()
            .WithUrl(new Uri(Server.BaseAddress, "hubs/duet"), options =>
            {
                options.HttpMessageHandlerFactory = _ => Server.CreateHandler();
                options.Transports = HttpTransportType.LongPolling;
            })
            .Build();
        await connection.StartAsync();
        return connection;
    }

    protected override void Dispose(bool disposing)
    {
        base.Dispose(disposing);
        try
        {
            if (Directory.Exists(_root)) Directory.Delete(_root, true);
        }
        catch
        {
            // temp cleanup is best effort
        }
    }
}
