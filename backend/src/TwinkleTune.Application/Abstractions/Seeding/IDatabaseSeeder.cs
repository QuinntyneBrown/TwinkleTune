namespace TwinkleTune.Application.Abstractions.Seeding;

/// <summary>How many rows a seeding run added (nothing when the catalog was already present).</summary>
public readonly record struct SeedResult(int AvatarsAdded, int SongsAdded)
{
    public bool AddedAnything => AvatarsAdded > 0 || SongsAdded > 0;
}

/// <summary>
/// Idempotently installs a <see cref="SeedManifest"/> into the store. Depends only on the
/// <see cref="ISeedDataSource"/> abstraction (dependency inversion), so the API startup path
/// and the CLI share one seeding implementation while choosing their own data source.
/// </summary>
public interface IDatabaseSeeder
{
    /// <summary>Seeds from the source registered in DI.</summary>
    Task<SeedResult> SeedAsync(CancellationToken ct = default);

    /// <summary>Seeds from an explicit source (e.g. a file the CLI was pointed at).</summary>
    Task<SeedResult> SeedAsync(ISeedDataSource source, CancellationToken ct = default);
}
