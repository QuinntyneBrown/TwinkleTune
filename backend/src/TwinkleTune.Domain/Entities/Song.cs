namespace TwinkleTune.Domain.Entities;

/// <summary>One sung syllable. Midi is at the song's base key (60 = C4); times are in beats.</summary>
public record SongNote(int Midi, double Start, double Dur, string Syll);

/// <summary>A lyric line and its notes — drives karaoke display and practice loops.</summary>
public record SongPhrase(string Lyric, List<SongNote> Notes);

/// <summary>
/// A singable song stored as note data (never audio), so the client can transpose it
/// into any singer's key without artifacts. Phrases persist as a JSON column.
/// </summary>
public class Song
{
    public Guid Id { get; set; }
    public required string Title { get; set; }
    public required string Emoji { get; set; }

    /// <summary>Art gradient index used by the frontend (1..4).</summary>
    public int Art { get; set; }

    public int Bpm { get; set; }

    /// <summary>1 = Easy, 2 = Medium, 3 = Brave.</summary>
    public int Difficulty { get; set; }

    public List<SongPhrase> Phrases { get; set; } = [];

    /// <summary>True for the built-in public-domain songs created by seeding.</summary>
    public bool IsSeed { get; set; }

    public DateTimeOffset UpdatedAt { get; set; }
}
