using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;

namespace TwinkleTune.IntegrationTests;

/// <summary>Boots the real API on a temp SQLite file and temp photo folder.</summary>
public class ApiFactory : WebApplicationFactory<Program>
{
    private readonly string _root = Path.Combine(Path.GetTempPath(), $"twinkletune-test-{Guid.NewGuid():N}");

    public string PhotosPath => Path.Combine(_root, "photos");

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        Directory.CreateDirectory(_root);
        builder.UseSetting("ConnectionStrings:Default", $"Data Source={Path.Combine(_root, "test.db")}");
        builder.UseSetting("PhotosPath", PhotosPath);
        builder.UseSetting("DataPath", _root);
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
