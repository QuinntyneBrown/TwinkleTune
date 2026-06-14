using Microsoft.AspNetCore.Mvc;
using TwinkleTune.Application.Dtos;
using TwinkleTune.Application.Services;

namespace TwinkleTune.Api.Controllers;

[ApiController]
[Route("api/avatars")]
public class AvatarsController(IAvatarService svc) : ControllerBase
{
    [HttpGet]
    public Task<List<AvatarDto>> GetAll(CancellationToken ct) => svc.GetAllAsync(ct);

    [HttpPost]
    public async Task<IActionResult> Create(SaveAvatarRequest req, CancellationToken ct)
    {
        var (avatar, error) = await svc.CreateAsync(req, ct);
        return error is not null
            ? BadRequest(new { error })
            : Created($"/api/avatars/{avatar!.Id}", avatar);
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, SaveAvatarRequest req, CancellationToken ct)
    {
        var (avatar, error) = await svc.UpdateAsync(id, req, ct);
        if (error is not null) return BadRequest(new { error });
        return avatar is null ? NotFound() : Ok(avatar);
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct) =>
        await svc.DeleteAsync(id, ct) ? NoContent() : NotFound();
}
