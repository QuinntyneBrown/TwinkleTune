namespace TwinkleTune.Application.Abstractions.Seeding;

/// <summary>
/// Supplies the catalog to seed. Kept separate from the seeder (interface segregation) so
/// the same idempotent write path can be fed from an embedded asset, a file a grown-up
/// hands the CLI, or a test double — without any of them knowing about the database.
/// </summary>
public interface ISeedDataSource
{
    /// <summary>A short, human-friendly description of where the data came from (for logs).</summary>
    string Description { get; }

    Task<SeedManifest> LoadAsync(CancellationToken ct = default);
}
