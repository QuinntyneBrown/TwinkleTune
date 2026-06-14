using TwinkleTune.Application.Abstractions;
using TwinkleTune.Application.Dtos;
using TwinkleTune.Domain.Entities;

namespace TwinkleTune.Application.Services;

public interface IHighScoreService
{
    Task<(SubmitHighScoreResult? Result, string? Error)> SubmitAsync(SubmitHighScoreRequest request, CancellationToken ct = default);
    Task<List<HighScoreDto>> GetForSongAsync(Guid songId, CancellationToken ct = default);
    Task<List<HighScoreDto>> GetForSingerAsync(Guid singerId, CancellationToken ct = default);
}

public class HighScoreService(
    IHighScoreRepository highScores,
    ISongRepository songs,
    ISingerRepository singers,
    TimeProvider time) : IHighScoreService
{
    public async Task<(SubmitHighScoreResult? Result, string? Error)> SubmitAsync(SubmitHighScoreRequest request, CancellationToken ct = default)
    {
        if (request.Stars is < 0 or > 3) return (null, "Stars must be between 0 and 3.");
        if (request.Accuracy is < 0 or > 1) return (null, "Accuracy must be between 0 and 1.");
        if (await songs.GetAsync(request.SongId, ct) is null) return (null, "That song doesn't exist.");
        if (await singers.GetAsync(request.SingerId, ct) is null) return (null, "That singer doesn't exist.");

        var existing = await highScores.GetAsync(request.SongId, request.SingerId, ct);
        if (existing is null)
        {
            var fresh = new HighScore
            {
                Id = Guid.NewGuid(),
                SongId = request.SongId,
                SingerId = request.SingerId,
                Stars = request.Stars,
                Accuracy = request.Accuracy,
                Sparkles = request.Sparkles,
                MaxStreak = request.MaxStreak,
                AchievedAt = time.GetUtcNow(),
            };
            await highScores.AddAsync(fresh, ct);
            var dto = (await highScores.GetAsync(request.SongId, request.SingerId, ct))!.ToDto();
            return (new SubmitHighScoreResult(true, dto), null);
        }

        if (existing.IsBeatenBy(request.Stars, request.Accuracy))
        {
            existing.Stars = request.Stars;
            existing.Accuracy = request.Accuracy;
            existing.Sparkles = request.Sparkles;
            existing.MaxStreak = request.MaxStreak;
            existing.AchievedAt = time.GetUtcNow();
            await highScores.UpdateAsync(existing, ct);
            return (new SubmitHighScoreResult(true, existing.ToDto()), null);
        }

        return (new SubmitHighScoreResult(false, existing.ToDto()), null);
    }

    public async Task<List<HighScoreDto>> GetForSongAsync(Guid songId, CancellationToken ct = default) =>
        (await highScores.GetForSongAsync(songId, ct))
            .OrderByDescending(h => h.Stars)
            .ThenByDescending(h => h.Accuracy)
            .Select(h => h.ToDto())
            .ToList();

    public async Task<List<HighScoreDto>> GetForSingerAsync(Guid singerId, CancellationToken ct = default) =>
        (await highScores.GetForSingerAsync(singerId, ct))
            .OrderByDescending(h => h.Stars)
            .ThenByDescending(h => h.Accuracy)
            .Select(h => h.ToDto())
            .ToList();
}
