namespace TwinkleTune.Application.Abstractions.Seeding;

/// <summary>
/// The catalog a seeding run should install, described as plain data (no Guids, no
/// timestamps). It is deliberately storage-agnostic and free of hardcoded C# literals —
/// the values live in a JSON asset so the built-in songs and avatars can be edited,
/// extended, or replaced without touching source code.
/// </summary>
public sealed record SeedManifest
{
    public List<SeedAvatar> Avatars { get; init; } = [];
    public List<SeedSong> Songs { get; init; } = [];
}

/// <summary>A default, pickable avatar (emoji + friendly name).</summary>
public sealed record SeedAvatar(string Emoji, string Name);

/// <summary>A built-in, public-domain song described note-for-note.</summary>
public sealed record SeedSong(
    string Title,
    string Emoji,
    int Art,
    int Bpm,
    int Difficulty,
    List<SeedPhrase> Phrases);

/// <summary>A lyric line and the notes sung under it.</summary>
public sealed record SeedPhrase(string Lyric, List<SeedNote> Notes);

/// <summary>One sung syllable. Midi is at the song's base key (60 = C4); times are in beats.</summary>
public sealed record SeedNote(int Midi, double Start, double Dur, string Syll);
