using TwinkleTune.Application.Abstractions;
using TwinkleTune.Application.Dtos;
using TwinkleTune.Application.Services;
using TwinkleTune.Domain.Entities;
using Xunit;

namespace TwinkleTune.UnitTests;

public class HighScoreServiceTests
{
    private sealed class FakeHighScores : IHighScoreRepository
    {
        public readonly List<HighScore> Store = [];
        public Task<HighScore?> GetAsync(Guid songId, Guid singerId, CancellationToken ct = default) =>
            Task.FromResult(Store.FirstOrDefault(h => h.SongId == songId && h.SingerId == singerId));
        public Task<List<HighScore>> GetForSongAsync(Guid songId, CancellationToken ct = default) =>
            Task.FromResult(Store.Where(h => h.SongId == songId).ToList());
        public Task<List<HighScore>> GetForSingerAsync(Guid singerId, CancellationToken ct = default) =>
            Task.FromResult(Store.Where(h => h.SingerId == singerId).ToList());
        public Task AddAsync(HighScore score, CancellationToken ct = default)
        {
            Store.Add(score);
            return Task.CompletedTask;
        }
        public Task UpdateAsync(HighScore score, CancellationToken ct = default) => Task.CompletedTask;
    }

    private sealed class FakeSongs(Song song) : ISongRepository
    {
        public Task<List<Song>> GetAllAsync(CancellationToken ct = default) => Task.FromResult(new List<Song> { song });
        public Task<Song?> GetAsync(Guid id, CancellationToken ct = default) =>
            Task.FromResult(id == song.Id ? song : null);
        public Task AddAsync(Song s, CancellationToken ct = default) => Task.CompletedTask;
        public Task UpdateAsync(Song s, CancellationToken ct = default) => Task.CompletedTask;
        public Task<bool> DeleteAsync(Guid id, CancellationToken ct = default) => Task.FromResult(false);
    }

    private sealed class FakeSingers(Singer singer) : ISingerRepository
    {
        public Task<List<Singer>> GetAllAsync(CancellationToken ct = default) => Task.FromResult(new List<Singer> { singer });
        public Task<Singer?> GetAsync(Guid id, CancellationToken ct = default) =>
            Task.FromResult(id == singer.Id ? singer : null);
        public Task AddAsync(Singer s, CancellationToken ct = default) => Task.CompletedTask;
        public Task UpdateAsync(Singer s, CancellationToken ct = default) => Task.CompletedTask;
        public Task<bool> DeleteAsync(Guid id, CancellationToken ct = default) => Task.FromResult(false);
    }

    private readonly Song _song = new() { Id = Guid.NewGuid(), Title = "T", Emoji = "🎵" };
    private readonly Singer _singer = new() { Id = Guid.NewGuid(), Name = "Zoe" };
    private readonly FakeHighScores _scores = new();
    private readonly HighScoreService _service;

    public HighScoreServiceTests()
    {
        _service = new HighScoreService(_scores, new FakeSongs(_song), new FakeSingers(_singer), TimeProvider.System);
    }

    private SubmitHighScoreRequest Request(int stars, double accuracy) =>
        new(_song.Id, _singer.Id, stars, accuracy, 100, 5);

    [Fact]
    public async Task First_submit_is_always_an_improvement()
    {
        var (result, error) = await _service.SubmitAsync(Request(2, 0.7));
        Assert.Null(error);
        Assert.True(result!.Improved);
        Assert.Single(_scores.Store);
    }

    [Fact]
    public async Task Worse_play_keeps_the_best()
    {
        await _service.SubmitAsync(Request(3, 0.9));
        var (result, _) = await _service.SubmitAsync(Request(1, 0.3));
        Assert.False(result!.Improved);
        Assert.Equal(3, _scores.Store.Single().Stars);
    }

    [Fact]
    public async Task More_stars_beats_fewer()
    {
        await _service.SubmitAsync(Request(1, 0.5));
        var (result, _) = await _service.SubmitAsync(Request(2, 0.4));
        Assert.True(result!.Improved);
        Assert.Equal(2, _scores.Store.Single().Stars);
    }

    [Fact]
    public async Task Same_stars_better_accuracy_wins()
    {
        await _service.SubmitAsync(Request(2, 0.6));
        var (result, _) = await _service.SubmitAsync(Request(2, 0.8));
        Assert.True(result!.Improved);
        Assert.Equal(0.8, _scores.Store.Single().Accuracy);
    }

    [Fact]
    public async Task Unknown_song_or_singer_is_rejected()
    {
        var (_, error) = await _service.SubmitAsync(new SubmitHighScoreRequest(Guid.NewGuid(), _singer.Id, 1, 0.5, 10, 1));
        Assert.NotNull(error);
        var (_, error2) = await _service.SubmitAsync(new SubmitHighScoreRequest(_song.Id, Guid.NewGuid(), 1, 0.5, 10, 1));
        Assert.NotNull(error2);
    }
}
