using TwinkleTune.Application.Abstractions;
using TwinkleTune.Application.Dtos;
using TwinkleTune.Domain.Entities;

namespace TwinkleTune.Application.Services;

public interface IAvatarService
{
    Task<List<AvatarDto>> GetAllAsync(CancellationToken ct = default);
    Task<AvatarDto?> GetAsync(Guid id, CancellationToken ct = default);
    Task<(AvatarDto? Avatar, string? Error)> CreateAsync(SaveAvatarRequest request, CancellationToken ct = default);
    Task<(AvatarDto? Avatar, string? Error)> UpdateAsync(Guid id, SaveAvatarRequest request, CancellationToken ct = default);
    Task<bool> DeleteAsync(Guid id, CancellationToken ct = default);
}

public class AvatarService(IAvatarRepository avatars) : IAvatarService
{
    private static string? Validate(SaveAvatarRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Emoji)) return "An avatar needs an emoji.";
        if (string.IsNullOrWhiteSpace(request.Name)) return "An avatar needs a name.";
        if (request.Name.Length > 30) return "Avatar name is too long (max 30 characters).";
        return null;
    }

    public async Task<List<AvatarDto>> GetAllAsync(CancellationToken ct = default) =>
        (await avatars.GetAllAsync(ct)).Select(a => a.ToDto()).ToList();

    public async Task<AvatarDto?> GetAsync(Guid id, CancellationToken ct = default) =>
        (await avatars.GetAsync(id, ct))?.ToDto();

    public async Task<(AvatarDto? Avatar, string? Error)> CreateAsync(SaveAvatarRequest request, CancellationToken ct = default)
    {
        if (Validate(request) is { } error) return (null, error);
        var avatar = new Avatar { Id = Guid.NewGuid(), Emoji = request.Emoji.Trim(), Name = request.Name.Trim() };
        await avatars.AddAsync(avatar, ct);
        return (avatar.ToDto(), null);
    }

    public async Task<(AvatarDto? Avatar, string? Error)> UpdateAsync(Guid id, SaveAvatarRequest request, CancellationToken ct = default)
    {
        if (Validate(request) is { } error) return (null, error);
        var avatar = await avatars.GetAsync(id, ct);
        if (avatar is null) return (null, null); // not found: no error message, endpoint maps to 404
        avatar.Emoji = request.Emoji.Trim();
        avatar.Name = request.Name.Trim();
        await avatars.UpdateAsync(avatar, ct);
        return (avatar.ToDto(), null);
    }

    public Task<bool> DeleteAsync(Guid id, CancellationToken ct = default) => avatars.DeleteAsync(id, ct);
}
