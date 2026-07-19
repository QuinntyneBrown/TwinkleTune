using TwinkleTune.Application.Abstractions.Seeding;

namespace TwinkleTune.Infrastructure.Seeding;

/// <summary>
/// Reads a seed catalog from a JSON file on disk — lets a grown-up hand the CLI their own
/// songbook without recompiling. Shares the exact JSON shape of the embedded default.
/// </summary>
public sealed class FileSeedDataSource(string path) : ISeedDataSource
{
    public string Description => $"file '{path}'";

    public async Task<SeedManifest> LoadAsync(CancellationToken ct = default)
    {
        if (!File.Exists(path))
            throw new FileNotFoundException($"Seed file not found: {path}", path);

        await using var stream = File.OpenRead(path);
        return await SeedManifestJson.ReadAsync(stream, path, ct);
    }
}
