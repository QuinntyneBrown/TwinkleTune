using Microsoft.AspNetCore.Mvc;
using TwinkleTune.Application.Dtos;
using TwinkleTune.Application.Services;
using TwinkleTune.Infrastructure.Storage;

namespace TwinkleTune.Api.Controllers;

[ApiController]
[Route("api/singers")]
public class SingersController(ISingerService svc) : ControllerBase
{
    private const long MaxPhotoBytes = 2 * 1024 * 1024;

    [HttpGet]
    public Task<List<SingerDto>> GetAll(CancellationToken ct) => svc.GetAllAsync(ct);

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> Get(Guid id, CancellationToken ct) =>
        await svc.GetAsync(id, ct) is { } singer ? Ok(singer) : NotFound();

    [HttpPost]
    public async Task<IActionResult> Create(SaveSingerRequest req, CancellationToken ct)
    {
        var (singer, error) = await svc.CreateAsync(req, ct);
        return error is not null
            ? BadRequest(new { error })
            : Created($"/api/singers/{singer!.Id}", singer);
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, SaveSingerRequest req, CancellationToken ct)
    {
        var (singer, error) = await svc.UpdateAsync(id, req, ct);
        if (error is not null) return BadRequest(new { error });
        return singer is null ? NotFound() : Ok(singer);
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct) =>
        await svc.DeleteAsync(id, ct) ? NoContent() : NotFound();

    [HttpPut("{id:guid}/photo")]
    public async Task<IActionResult> SetPhoto(Guid id, CancellationToken ct)
    {
        if (!Request.HasFormContentType)
            return BadRequest(new { error = "Send the photo as multipart form data." });
        var form = await Request.ReadFormAsync(ct);
        var file = form.Files.Count > 0 ? form.Files[0] : null;
        if (file is null || file.Length == 0)
            return BadRequest(new { error = "No photo file found." });
        if (file.Length > MaxPhotoBytes)
            return BadRequest(new { error = "Photos must be 2 MB or smaller." });
        if (!PhotoStorage.IsSupported(file.ContentType))
            return BadRequest(new { error = "Use a JPEG, PNG or WebP photo." });

        await using var stream = file.OpenReadStream();
        var singer = await svc.SetPhotoAsync(id, stream, file.ContentType, ct);
        return singer is null ? NotFound() : Ok(singer);
    }

    [HttpGet("{id:guid}/photo")]
    public async Task<IActionResult> GetPhoto(Guid id, CancellationToken ct)
    {
        var fileName = await svc.GetPhotoFileNameAsync(id, ct);
        if (fileName is null) return NotFound();
        var opened = svc.OpenPhoto(fileName);
        return opened is null
            ? NotFound()
            : File(opened.Value.Stream, opened.Value.ContentType);
    }
}
