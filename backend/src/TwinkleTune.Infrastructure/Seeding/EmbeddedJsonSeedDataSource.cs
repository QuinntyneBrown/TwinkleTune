using System.Reflection;
using TwinkleTune.Application.Abstractions.Seeding;

namespace TwinkleTune.Infrastructure.Seeding;

/// <summary>
/// The default catalog, shipped as an embedded JSON asset (Persistence/seed-data.json)
/// rather than hardcoded in C#. This is the built-in equivalent of the frontend's bundled
/// catalog — edit the JSON, not source, to change the default songs or avatars.
/// </summary>
public sealed class EmbeddedJsonSeedDataSource : ISeedDataSource
{
    private const string ResourceSuffix = "seed-data.json";

    public string Description => "built-in catalog (embedded seed-data.json)";

    public async Task<SeedManifest> LoadAsync(CancellationToken ct = default)
    {
        var assembly = typeof(EmbeddedJsonSeedDataSource).Assembly;
        var resourceName = assembly.GetManifestResourceNames()
            .FirstOrDefault(n => n.EndsWith(ResourceSuffix, StringComparison.Ordinal))
            ?? throw new InvalidOperationException(
                $"Embedded seed resource '*{ResourceSuffix}' was not found in {assembly.GetName().Name}.");

        await using var stream = assembly.GetManifestResourceStream(resourceName)
            ?? throw new InvalidOperationException($"Could not open embedded seed resource '{resourceName}'.");

        return await SeedManifestJson.ReadAsync(stream, resourceName, ct);
    }
}
