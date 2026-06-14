using TwinkleTune.Application.Abstractions;
using TwinkleTune.Application.Dtos;
using TwinkleTune.Domain.Entities;

namespace TwinkleTune.Application.Services;

public interface ISingerService
{
    Task<List<SingerDto>> GetAllAsync(CancellationToken ct = default);
    Task<SingerDto?> GetAsync(Guid id, CancellationToken ct = default);
    Task<(SingerDto? Singer, string? Error)> CreateAsync(SaveSingerRequest request, CancellationToken ct = default);
    Task<(SingerDto? Singer, string? Error)> UpdateAsync(Guid id, SaveSingerRequest request, CancellationToken ct = default);
    Task<bool> DeleteAsync(Guid id, CancellationToken ct = default);
    Task<SingerDto?> SetPhotoAsync(Guid id, Stream content, string contentType, CancellationToken ct = default);
    (Stream Stream, string ContentType)? OpenPhoto(string fileName);
    Task<SingerDto?> GetWithPhotoFileAsync(Guid id, CancellationToken ct = default);
    Task<string?> GetPhotoFileNameAsync(Guid id, CancellationToken ct = default);
}

public class SingerService(ISingerRepository singers, IPhotoStorage photos, TimeProvider time) : ISingerService
{
    private static string? Validate(SaveSingerRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Name)) return "Every singer needs a name.";
        if (request.Name.Length > 30) return "Name is too long (max 30 characters).";
        if (request.RangeLow is { } low && request.RangeHigh is { } high && high <= low)
            return "The high note must be above the low note.";
        return null;
    }

    public async Task<List<SingerDto>> GetAllAsync(CancellationToken ct = default) =>
        (await singers.GetAllAsync(ct)).Select(s => s.ToDto()).ToList();

    public async Task<SingerDto?> GetAsync(Guid id, CancellationToken ct = default) =>
        (await singers.GetAsync(id, ct))?.ToDto();

    public async Task<(SingerDto? Singer, string? Error)> CreateAsync(SaveSingerRequest request, CancellationToken ct = default)
    {
        if (Validate(request) is { } error) return (null, error);
        var singer = new Singer
        {
            Id = Guid.NewGuid(),
            Name = request.Name.Trim(),
            AvatarId = request.AvatarId,
            RangeLow = request.RangeLow,
            RangeHigh = request.RangeHigh,
            CreatedAt = time.GetUtcNow(),
        };
        await singers.AddAsync(singer, ct);
        return ((await singers.GetAsync(singer.Id, ct))!.ToDto(), null);
    }

    public async Task<(SingerDto? Singer, string? Error)> UpdateAsync(Guid id, SaveSingerRequest request, CancellationToken ct = default)
    {
        if (Validate(request) is { } error) return (null, error);
        var singer = await singers.GetAsync(id, ct);
        if (singer is null) return (null, null);
        singer.Name = request.Name.Trim();
        singer.AvatarId = request.AvatarId;
        singer.RangeLow = request.RangeLow;
        singer.RangeHigh = request.RangeHigh;
        await singers.UpdateAsync(singer, ct);
        return ((await singers.GetAsync(id, ct))!.ToDto(), null);
    }

    public async Task<bool> DeleteAsync(Guid id, CancellationToken ct = default)
    {
        var singer = await singers.GetAsync(id, ct);
        if (singer is null) return false;
        if (singer.PhotoFileName is not null) photos.Delete(singer.PhotoFileName);
        return await singers.DeleteAsync(id, ct);
    }

    public async Task<SingerDto?> SetPhotoAsync(Guid id, Stream content, string contentType, CancellationToken ct = default)
    {
        var singer = await singers.GetAsync(id, ct);
        if (singer is null) return null;
        singer.PhotoFileName = await photos.SaveAsync(id, content, contentType, ct);
        await singers.UpdateAsync(singer, ct);
        return singer.ToDto();
    }

    public (Stream Stream, string ContentType)? OpenPhoto(string fileName) => photos.OpenRead(fileName);

    public Task<SingerDto?> GetWithPhotoFileAsync(Guid id, CancellationToken ct = default) => GetAsync(id, ct);

    public async Task<string?> GetPhotoFileNameAsync(Guid id, CancellationToken ct = default) =>
        (await singers.GetAsync(id, ct))?.PhotoFileName;
}
