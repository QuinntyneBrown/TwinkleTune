namespace TwinkleTune.Application.Dtos;

public record AvatarDto(Guid Id, string Emoji, string Name);
public record SaveAvatarRequest(string Emoji, string Name);

public record SingerDto(
    Guid Id,
    string Name,
    Guid? AvatarId,
    string? AvatarEmoji,
    bool HasPhoto,
    int? RangeLow,
    int? RangeHigh);

public record SaveSingerRequest(string Name, Guid? AvatarId, int? RangeLow, int? RangeHigh);

public record SongNoteDto(int Midi, double Start, double Dur, string Syll);
public record SongPhraseDto(string Lyric, List<SongNoteDto> Notes);

public record SongDto(
    Guid Id,
    string Title,
    string Emoji,
    int Art,
    int Bpm,
    int Difficulty,
    bool IsSeed,
    List<SongPhraseDto> Phrases);

public record SaveSongRequest(
    string Title,
    string Emoji,
    int Art,
    int Bpm,
    int Difficulty,
    List<SongPhraseDto> Phrases);

public record HighScoreDto(
    Guid SongId,
    Guid SingerId,
    string SingerName,
    string? SingerAvatar,
    bool SingerHasPhoto,
    int Stars,
    double Accuracy,
    int Sparkles,
    int MaxStreak,
    DateTimeOffset AchievedAt);

public record SubmitHighScoreRequest(
    Guid SongId,
    Guid SingerId,
    int Stars,
    double Accuracy,
    int Sparkles,
    int MaxStreak);

public record SubmitHighScoreResult(bool Improved, HighScoreDto Score);
