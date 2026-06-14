using TwinkleTune.Application.Dtos;
using TwinkleTune.Domain.Entities;

namespace TwinkleTune.Application;

public static class Mapping
{
    public static AvatarDto ToDto(this Avatar a) => new(a.Id, a.Emoji, a.Name);

    public static SingerDto ToDto(this Singer s) =>
        new(s.Id, s.Name, s.AvatarId, s.Avatar?.Emoji, s.PhotoFileName is not null, s.RangeLow, s.RangeHigh);

    public static SongDto ToDto(this Song s) =>
        new(s.Id, s.Title, s.Emoji, s.Art, s.Bpm, s.Difficulty, s.IsSeed,
            s.Phrases.Select(p => new SongPhraseDto(
                p.Lyric,
                p.Notes.Select(n => new SongNoteDto(n.Midi, n.Start, n.Dur, n.Syll)).ToList())).ToList());

    public static List<SongPhrase> ToDomainPhrases(this List<SongPhraseDto> phrases) =>
        phrases.Select(p => new SongPhrase(
            p.Lyric,
            p.Notes.Select(n => new SongNote(n.Midi, n.Start, n.Dur, n.Syll)).ToList())).ToList();

    public static HighScoreDto ToDto(this HighScore h) =>
        new(h.SongId, h.SingerId,
            h.Singer?.Name ?? "Singer",
            h.Singer?.Avatar?.Emoji,
            h.Singer?.PhotoFileName is not null,
            h.Stars, h.Accuracy, h.Sparkles, h.MaxStreak, h.AchievedAt);
}
