using TwinkleTune.Domain.Entities;
using TwinkleTune.Domain.Validation;
using TwinkleTune.Infrastructure.Seeding;
using Xunit;

namespace TwinkleTune.UnitTests;

/// <summary>
/// Guards the data-driven seed catalog that replaced the old hardcoded <c>SeedData</c> class:
/// the embedded JSON must still parse into the same eight avatars and six singable songs.
/// </summary>
public class SeedDataSourceTests
{
    private static Task<Application.Abstractions.Seeding.SeedManifest> LoadAsync() =>
        new EmbeddedJsonSeedDataSource().LoadAsync();

    [Fact]
    public async Task Embedded_catalog_has_the_eight_default_avatars()
    {
        var manifest = await LoadAsync();

        Assert.Equal(8, manifest.Avatars.Count);
        Assert.Contains(manifest.Avatars, a => a is { Emoji: "🦄", Name: "Unicorn" });
        Assert.All(manifest.Avatars, a =>
        {
            Assert.False(string.IsNullOrWhiteSpace(a.Emoji));
            Assert.False(string.IsNullOrWhiteSpace(a.Name));
        });
    }

    [Fact]
    public async Task Embedded_catalog_has_the_six_seed_songs()
    {
        var manifest = await LoadAsync();

        Assert.Equal(6, manifest.Songs.Count);
        Assert.Contains(manifest.Songs, s => s.Title == "Twinkle Twinkle Little Star");
    }

    [Fact]
    public async Task Every_seed_song_passes_the_shared_validator()
    {
        var manifest = await LoadAsync();

        foreach (var seed in manifest.Songs)
        {
            var song = new Song
            {
                Title = seed.Title,
                Emoji = seed.Emoji,
                Art = seed.Art,
                Bpm = seed.Bpm,
                Difficulty = seed.Difficulty,
                Phrases = seed.Phrases
                    .Select(p => new SongPhrase(
                        p.Lyric,
                        p.Notes.Select(n => new SongNote(n.Midi, n.Start, n.Dur, n.Syll)).ToList()))
                    .ToList(),
            };

            var errors = SongValidator.Validate(song);
            Assert.True(errors.Count == 0, $"{seed.Title}: {string.Join("; ", errors)}");
        }
    }
}
