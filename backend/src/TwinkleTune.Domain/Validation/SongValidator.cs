using TwinkleTune.Domain.Entities;

namespace TwinkleTune.Domain.Validation;

/// <summary>
/// Song invariants — deliberately identical to the frontend catalog rules so a song
/// that saves here is guaranteed to be renderable and singable by the client.
/// </summary>
public static class SongValidator
{
    public const int MinMidi = 48; // C3
    public const int MaxMidi = 84; // C6
    public const int MaxSpan = 16; // semitones

    public static IReadOnlyList<string> Validate(Song song)
    {
        var errors = new List<string>();

        if (string.IsNullOrWhiteSpace(song.Title)) errors.Add("A song needs a title.");
        else if (song.Title.Length > 80) errors.Add("Title is too long (max 80 characters).");
        if (string.IsNullOrWhiteSpace(song.Emoji)) errors.Add("Pick an emoji for the song art.");
        if (song.Art is < 1 or > 4) errors.Add("Art style must be between 1 and 4.");
        if (song.Bpm is < 40 or > 220) errors.Add("Tempo must be between 40 and 220 BPM.");
        if (song.Difficulty is < 1 or > 3) errors.Add("Difficulty must be 1 (Easy), 2 (Medium) or 3 (Brave).");

        if (song.Phrases.Count == 0)
        {
            errors.Add("A song needs at least one phrase.");
            return errors;
        }

        var allNotes = new List<SongNote>();
        for (var p = 0; p < song.Phrases.Count; p++)
        {
            var phrase = song.Phrases[p];
            if (string.IsNullOrWhiteSpace(phrase.Lyric))
                errors.Add($"Phrase {p + 1} needs a lyric line.");
            if (phrase.Notes.Count == 0)
                errors.Add($"Phrase {p + 1} needs at least one note.");
            allNotes.AddRange(phrase.Notes);
        }

        for (var i = 0; i < allNotes.Count; i++)
        {
            var n = allNotes[i];
            if (n.Dur <= 0) errors.Add($"Note {i + 1}: duration must be positive.");
            if (string.IsNullOrWhiteSpace(n.Syll)) errors.Add($"Note {i + 1}: every note needs a syllable.");
            if (n.Midi < MinMidi || n.Midi > MaxMidi)
                errors.Add($"Note {i + 1}: midi {n.Midi} is outside the kid-singable range ({MinMidi}–{MaxMidi}).");
            if (i > 0 && n.Start + 1e-6 < allNotes[i - 1].Start + allNotes[i - 1].Dur)
                errors.Add($"Note {i + 1}: overlaps the previous note (notes must be in time order).");
        }

        if (allNotes.Count > 0)
        {
            var span = allNotes.Max(n => n.Midi) - allNotes.Min(n => n.Midi);
            if (span > MaxSpan)
                errors.Add($"The melody spans {span} semitones — keep it within {MaxSpan} so it fits a kid's voice.");
        }

        return errors;
    }
}
