using TwinkleTune.Domain.Entities;
using TwinkleTune.Domain.Validation;
using Xunit;

namespace TwinkleTune.UnitTests;

public class SongValidatorTests
{
    private static Song ValidSong() => new()
    {
        Id = Guid.NewGuid(),
        Title = "Test Song",
        Emoji = "🎵",
        Art = 1,
        Bpm = 100,
        Difficulty = 1,
        Phrases =
        [
            new SongPhrase("Hello world", [new SongNote(60, 0, 1, "Hel"), new SongNote(62, 1, 1, "lo")]),
        ],
    };

    [Fact]
    public void Valid_song_passes()
    {
        Assert.Empty(SongValidator.Validate(ValidSong()));
    }

    [Fact]
    public void Song_needs_title_and_emoji()
    {
        var song = ValidSong();
        song.Title = " ";
        song.Emoji = "";
        var errors = SongValidator.Validate(song);
        Assert.Contains(errors, e => e.Contains("title"));
        Assert.Contains(errors, e => e.Contains("emoji"));
    }

    [Fact]
    public void Song_needs_phrases()
    {
        var song = ValidSong();
        song.Phrases = [];
        Assert.Contains(SongValidator.Validate(song), e => e.Contains("at least one phrase"));
    }

    [Fact]
    public void Notes_must_not_overlap()
    {
        var song = ValidSong();
        song.Phrases =
        [
            new SongPhrase("Oops", [new SongNote(60, 0, 2, "long"), new SongNote(62, 1, 1, "early")]),
        ];
        Assert.Contains(SongValidator.Validate(song), e => e.Contains("overlaps"));
    }

    [Fact]
    public void Midi_must_be_kid_singable()
    {
        var song = ValidSong();
        song.Phrases = [new SongPhrase("Too low", [new SongNote(30, 0, 1, "low")])];
        Assert.Contains(SongValidator.Validate(song), e => e.Contains("outside"));
    }

    [Fact]
    public void Melody_span_is_limited()
    {
        var song = ValidSong();
        song.Phrases =
        [
            new SongPhrase("Wide", [new SongNote(48, 0, 1, "low"), new SongNote(84, 1, 1, "high")]),
        ];
        Assert.Contains(SongValidator.Validate(song), e => e.Contains("spans"));
    }

    [Theory]
    [InlineData(30)]
    [InlineData(300)]
    public void Bpm_is_bounded(int bpm)
    {
        var song = ValidSong();
        song.Bpm = bpm;
        Assert.Contains(SongValidator.Validate(song), e => e.Contains("Tempo"));
    }

    [Fact]
    public void Durations_must_be_positive()
    {
        var song = ValidSong();
        song.Phrases = [new SongPhrase("Zero", [new SongNote(60, 0, 0, "x")])];
        Assert.Contains(SongValidator.Validate(song), e => e.Contains("duration"));
    }
}
