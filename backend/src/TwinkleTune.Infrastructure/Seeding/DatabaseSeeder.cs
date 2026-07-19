using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using TwinkleTune.Application.Abstractions.Seeding;
using TwinkleTune.Domain.Entities;
using TwinkleTune.Infrastructure.Persistence;

namespace TwinkleTune.Infrastructure.Seeding;

/// <summary>
/// Idempotent seeder: installs the avatars and songs a data source describes, but only the
/// families that are still empty — so it is safe to run on every boot and from the CLI. It
/// carries no catalog of its own; every value comes from the injected <see cref="ISeedDataSource"/>.
/// </summary>
public sealed class DatabaseSeeder(
    AppDbContext db,
    ISeedDataSource defaultSource,
    TimeProvider time,
    ILogger<DatabaseSeeder> logger) : IDatabaseSeeder
{
    public Task<SeedResult> SeedAsync(CancellationToken ct = default) => SeedAsync(defaultSource, ct);

    public async Task<SeedResult> SeedAsync(ISeedDataSource source, CancellationToken ct = default)
    {
        var manifest = await source.LoadAsync(ct);

        var avatarsAdded = 0;
        if (manifest.Avatars.Count > 0 && !await db.Avatars.AnyAsync(ct))
        {
            db.Avatars.AddRange(manifest.Avatars.Select(a => new Avatar
            {
                Id = Guid.NewGuid(),
                Emoji = a.Emoji,
                Name = a.Name,
            }));
            avatarsAdded = manifest.Avatars.Count;
        }

        var songsAdded = 0;
        if (manifest.Songs.Count > 0 && !await db.Songs.AnyAsync(ct))
        {
            var now = time.GetUtcNow();
            db.Songs.AddRange(manifest.Songs.Select(s => new Song
            {
                Id = Guid.NewGuid(),
                Title = s.Title,
                Emoji = s.Emoji,
                Art = s.Art,
                Bpm = s.Bpm,
                Difficulty = s.Difficulty,
                IsSeed = true,
                UpdatedAt = now,
                Phrases = s.Phrases
                    .Select(p => new SongPhrase(
                        p.Lyric,
                        p.Notes.Select(n => new SongNote(n.Midi, n.Start, n.Dur, n.Syll)).ToList()))
                    .ToList(),
            }));
            songsAdded = manifest.Songs.Count;
        }

        if (avatarsAdded > 0 || songsAdded > 0)
        {
            await db.SaveChangesAsync(ct);
            logger.LogInformation(
                "Seeded {AvatarCount} avatars and {SongCount} songs from {Source}.",
                avatarsAdded, songsAdded, source.Description);
        }
        else
        {
            logger.LogInformation("Seed skipped — avatars and songs already present ({Source}).", source.Description);
        }

        return new SeedResult(avatarsAdded, songsAdded);
    }
}
