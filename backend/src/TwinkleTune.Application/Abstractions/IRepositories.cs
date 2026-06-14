using TwinkleTune.Domain.Entities;

namespace TwinkleTune.Application.Abstractions;

public interface IAvatarRepository
{
    Task<List<Avatar>> GetAllAsync(CancellationToken ct = default);
    Task<Avatar?> GetAsync(Guid id, CancellationToken ct = default);
    Task AddAsync(Avatar avatar, CancellationToken ct = default);
    Task UpdateAsync(Avatar avatar, CancellationToken ct = default);
    Task<bool> DeleteAsync(Guid id, CancellationToken ct = default);
}

public interface ISingerRepository
{
    Task<List<Singer>> GetAllAsync(CancellationToken ct = default);
    Task<Singer?> GetAsync(Guid id, CancellationToken ct = default);
    Task AddAsync(Singer singer, CancellationToken ct = default);
    Task UpdateAsync(Singer singer, CancellationToken ct = default);
    Task<bool> DeleteAsync(Guid id, CancellationToken ct = default);
}

public interface ISongRepository
{
    Task<List<Song>> GetAllAsync(CancellationToken ct = default);
    Task<Song?> GetAsync(Guid id, CancellationToken ct = default);
    Task AddAsync(Song song, CancellationToken ct = default);
    Task UpdateAsync(Song song, CancellationToken ct = default);
    Task<bool> DeleteAsync(Guid id, CancellationToken ct = default);
}

public interface IHighScoreRepository
{
    Task<HighScore?> GetAsync(Guid songId, Guid singerId, CancellationToken ct = default);
    Task<List<HighScore>> GetForSongAsync(Guid songId, CancellationToken ct = default);
    Task<List<HighScore>> GetForSingerAsync(Guid singerId, CancellationToken ct = default);
    Task AddAsync(HighScore score, CancellationToken ct = default);
    Task UpdateAsync(HighScore score, CancellationToken ct = default);
}

public interface IPhotoStorage
{
    /// <summary>Saves (replacing any previous photo) and returns the stored file name.</summary>
    Task<string> SaveAsync(Guid singerId, Stream content, string contentType, CancellationToken ct = default);

    /// <summary>Opens a stored photo, or null when missing.</summary>
    (Stream Stream, string ContentType)? OpenRead(string fileName);

    void Delete(string fileName);
}
