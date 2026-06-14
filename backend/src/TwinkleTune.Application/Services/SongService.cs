using TwinkleTune.Application.Abstractions;
using TwinkleTune.Application.Dtos;
using TwinkleTune.Domain.Entities;
using TwinkleTune.Domain.Validation;

namespace TwinkleTune.Application.Services;

public interface ISongService
{
    Task<List<SongDto>> GetAllAsync(CancellationToken ct = default);
    Task<SongDto?> GetAsync(Guid id, CancellationToken ct = default);
    Task<(SongDto? Song, IReadOnlyList<string> Errors)> CreateAsync(SaveSongRequest request, CancellationToken ct = default);
    Task<(SongDto? Song, IReadOnlyList<string> Errors, bool Found)> UpdateAsync(Guid id, SaveSongRequest request, CancellationToken ct = default);
    Task<bool> DeleteAsync(Guid id, CancellationToken ct = default);
}

public class SongService(ISongRepository songs, TimeProvider time) : ISongService
{
    public async Task<List<SongDto>> GetAllAsync(CancellationToken ct = default) =>
        (await songs.GetAllAsync(ct)).Select(s => s.ToDto()).ToList();

    public async Task<SongDto?> GetAsync(Guid id, CancellationToken ct = default) =>
        (await songs.GetAsync(id, ct))?.ToDto();

    public async Task<(SongDto? Song, IReadOnlyList<string> Errors)> CreateAsync(SaveSongRequest request, CancellationToken ct = default)
    {
        var song = new Song
        {
            Id = Guid.NewGuid(),
            Title = request.Title?.Trim() ?? "",
            Emoji = request.Emoji?.Trim() ?? "",
            Art = request.Art,
            Bpm = request.Bpm,
            Difficulty = request.Difficulty,
            Phrases = (request.Phrases ?? []).ToDomainPhrases(),
            IsSeed = false,
            UpdatedAt = time.GetUtcNow(),
        };
        var errors = SongValidator.Validate(song);
        if (errors.Count > 0) return (null, errors);
        await songs.AddAsync(song, ct);
        return (song.ToDto(), errors);
    }

    public async Task<(SongDto? Song, IReadOnlyList<string> Errors, bool Found)> UpdateAsync(Guid id, SaveSongRequest request, CancellationToken ct = default)
    {
        var song = await songs.GetAsync(id, ct);
        if (song is null) return (null, [], false);

        var updated = new Song
        {
            Id = song.Id,
            Title = request.Title?.Trim() ?? "",
            Emoji = request.Emoji?.Trim() ?? "",
            Art = request.Art,
            Bpm = request.Bpm,
            Difficulty = request.Difficulty,
            Phrases = (request.Phrases ?? []).ToDomainPhrases(),
            IsSeed = song.IsSeed,
            UpdatedAt = time.GetUtcNow(),
        };
        var errors = SongValidator.Validate(updated);
        if (errors.Count > 0) return (null, errors, true);

        song.Title = updated.Title;
        song.Emoji = updated.Emoji;
        song.Art = updated.Art;
        song.Bpm = updated.Bpm;
        song.Difficulty = updated.Difficulty;
        song.Phrases = updated.Phrases;
        song.UpdatedAt = updated.UpdatedAt;
        await songs.UpdateAsync(song, ct);
        return (song.ToDto(), errors, true);
    }

    public Task<bool> DeleteAsync(Guid id, CancellationToken ct = default) => songs.DeleteAsync(id, ct);
}
