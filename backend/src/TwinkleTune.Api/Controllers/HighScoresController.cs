using Microsoft.AspNetCore.Mvc;
using TwinkleTune.Application.Dtos;
using TwinkleTune.Application.Services;

namespace TwinkleTune.Api.Controllers;

[ApiController]
public class HighScoresController(IHighScoreService svc) : ControllerBase
{
    [HttpPost("/api/highscores")]
    public async Task<IActionResult> Submit(SubmitHighScoreRequest req, CancellationToken ct)
    {
        var (result, error) = await svc.SubmitAsync(req, ct);
        return error is not null ? BadRequest(new { error }) : Ok(result);
    }

    [HttpGet("/api/songs/{songId:guid}/highscores")]
    public Task<List<HighScoreDto>> GetForSong(Guid songId, CancellationToken ct) =>
        svc.GetForSongAsync(songId, ct);

    [HttpGet("/api/singers/{singerId:guid}/highscores")]
    public Task<List<HighScoreDto>> GetForSinger(Guid singerId, CancellationToken ct) =>
        svc.GetForSingerAsync(singerId, ct);
}
