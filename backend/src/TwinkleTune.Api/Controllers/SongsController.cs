using Microsoft.AspNetCore.Mvc;
using TwinkleTune.Application.Dtos;
using TwinkleTune.Application.Services;

namespace TwinkleTune.Api.Controllers;

[ApiController]
[Route("api/songs")]
public class SongsController(ISongService svc) : ControllerBase
{
    [HttpGet]
    public Task<List<SongDto>> GetAll(CancellationToken ct) => svc.GetAllAsync(ct);

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> Get(Guid id, CancellationToken ct) =>
        await svc.GetAsync(id, ct) is { } song ? Ok(song) : NotFound();

    [HttpPost]
    public async Task<IActionResult> Create(SaveSongRequest req, CancellationToken ct)
    {
        var (song, errors) = await svc.CreateAsync(req, ct);
        return song is null
            ? BadRequest(new { errors })
            : Created($"/api/songs/{song.Id}", song);
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, SaveSongRequest req, CancellationToken ct)
    {
        var (song, errors, found) = await svc.UpdateAsync(id, req, ct);
        if (!found) return NotFound();
        return song is null ? BadRequest(new { errors }) : Ok(song);
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct) =>
        await svc.DeleteAsync(id, ct) ? NoContent() : NotFound();
}
