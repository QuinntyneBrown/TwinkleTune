using Microsoft.EntityFrameworkCore;
using TwinkleTune.Application.Abstractions;
using TwinkleTune.Domain.Entities;
using TwinkleTune.Infrastructure.Persistence;

namespace TwinkleTune.Infrastructure.Repositories;

public class AvatarRepository(AppDbContext db) : IAvatarRepository
{
    public Task<List<Avatar>> GetAllAsync(CancellationToken ct = default) =>
        db.Avatars.AsNoTracking().OrderBy(a => a.Name).ToListAsync(ct);

    public Task<Avatar?> GetAsync(Guid id, CancellationToken ct = default) =>
        db.Avatars.FirstOrDefaultAsync(a => a.Id == id, ct);

    public async Task AddAsync(Avatar avatar, CancellationToken ct = default)
    {
        db.Avatars.Add(avatar);
        await db.SaveChangesAsync(ct);
    }

    public Task UpdateAsync(Avatar avatar, CancellationToken ct = default) => db.SaveChangesAsync(ct);

    public async Task<bool> DeleteAsync(Guid id, CancellationToken ct = default)
    {
        var avatar = await db.Avatars.FirstOrDefaultAsync(a => a.Id == id, ct);
        if (avatar is null) return false;
        db.Avatars.Remove(avatar);
        await db.SaveChangesAsync(ct);
        return true;
    }
}

public class SingerRepository(AppDbContext db) : ISingerRepository
{
    public async Task<List<Singer>> GetAllAsync(CancellationToken ct = default) =>
        // ordered in memory: SQLite cannot ORDER BY a DateTimeOffset column
        (await db.Singers.AsNoTracking().Include(s => s.Avatar).ToListAsync(ct))
            .OrderBy(s => s.CreatedAt).ToList();

    public Task<Singer?> GetAsync(Guid id, CancellationToken ct = default) =>
        db.Singers.Include(s => s.Avatar).FirstOrDefaultAsync(s => s.Id == id, ct);

    public async Task AddAsync(Singer singer, CancellationToken ct = default)
    {
        db.Singers.Add(singer);
        await db.SaveChangesAsync(ct);
    }

    public Task UpdateAsync(Singer singer, CancellationToken ct = default) => db.SaveChangesAsync(ct);

    public async Task<bool> DeleteAsync(Guid id, CancellationToken ct = default)
    {
        var singer = await db.Singers.FirstOrDefaultAsync(s => s.Id == id, ct);
        if (singer is null) return false;
        db.Singers.Remove(singer);
        await db.SaveChangesAsync(ct);
        return true;
    }
}

public class SongRepository(AppDbContext db) : ISongRepository
{
    public Task<List<Song>> GetAllAsync(CancellationToken ct = default) =>
        db.Songs.AsNoTracking().OrderBy(s => s.Difficulty).ThenBy(s => s.Title).ToListAsync(ct);

    public Task<Song?> GetAsync(Guid id, CancellationToken ct = default) =>
        db.Songs.FirstOrDefaultAsync(s => s.Id == id, ct);

    public async Task AddAsync(Song song, CancellationToken ct = default)
    {
        db.Songs.Add(song);
        await db.SaveChangesAsync(ct);
    }

    public Task UpdateAsync(Song song, CancellationToken ct = default) => db.SaveChangesAsync(ct);

    public async Task<bool> DeleteAsync(Guid id, CancellationToken ct = default)
    {
        var song = await db.Songs.FirstOrDefaultAsync(s => s.Id == id, ct);
        if (song is null) return false;
        db.Songs.Remove(song);
        await db.SaveChangesAsync(ct);
        return true;
    }
}

public class HighScoreRepository(AppDbContext db) : IHighScoreRepository
{
    public Task<HighScore?> GetAsync(Guid songId, Guid singerId, CancellationToken ct = default) =>
        db.HighScores
            .Include(h => h.Singer)!.ThenInclude(s => s!.Avatar)
            .FirstOrDefaultAsync(h => h.SongId == songId && h.SingerId == singerId, ct);

    public Task<List<HighScore>> GetForSongAsync(Guid songId, CancellationToken ct = default) =>
        db.HighScores.AsNoTracking()
            .Include(h => h.Singer)!.ThenInclude(s => s!.Avatar)
            .Where(h => h.SongId == songId)
            .ToListAsync(ct);

    public Task<List<HighScore>> GetForSingerAsync(Guid singerId, CancellationToken ct = default) =>
        db.HighScores.AsNoTracking()
            .Include(h => h.Singer)!.ThenInclude(s => s!.Avatar)
            .Where(h => h.SingerId == singerId)
            .ToListAsync(ct);

    public async Task AddAsync(HighScore score, CancellationToken ct = default)
    {
        db.HighScores.Add(score);
        await db.SaveChangesAsync(ct);
    }

    public Task UpdateAsync(HighScore score, CancellationToken ct = default) => db.SaveChangesAsync(ct);
}
