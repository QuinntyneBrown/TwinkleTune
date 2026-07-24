using System.Net;
using System.Net.Http.Json;
using TwinkleTune.Application.Dtos;
using Xunit;

namespace TwinkleTune.IntegrationTests;

public class CrudEndpointTests : IClassFixture<ApiFactory>
{
    private readonly HttpClient _client;

    public CrudEndpointTests(ApiFactory factory)
    {
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task Health_is_ok()
    {
        var response = await _client.GetAsync("/health");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task Seeds_seven_songs_and_default_avatars()
    {
        var songs = await _client.GetFromJsonAsync<List<SongDto>>("/api/songs");
        Assert.Equal(7, songs!.Count);
        Assert.Contains(songs, s => s.Title == "Twinkle Twinkle Little Star" && s.IsSeed);
        Assert.Contains(songs, s => s.Title == "Jesus Loves Me" && s.IsSeed);

        var avatars = await _client.GetFromJsonAsync<List<AvatarDto>>("/api/avatars");
        Assert.True(avatars!.Count >= 4);
        Assert.Contains(avatars, a => a.Emoji == "🦄");
    }

    [Fact]
    public async Task Avatar_crud_roundtrip()
    {
        var created = await _client.PostAsJsonAsync("/api/avatars", new SaveAvatarRequest("🐯", "Tiger"));
        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        var avatar = await created.Content.ReadFromJsonAsync<AvatarDto>();

        var updated = await _client.PutAsJsonAsync($"/api/avatars/{avatar!.Id}", new SaveAvatarRequest("🐯", "Brave Tiger"));
        Assert.Equal(HttpStatusCode.OK, updated.StatusCode);

        var deleted = await _client.DeleteAsync($"/api/avatars/{avatar.Id}");
        Assert.Equal(HttpStatusCode.NoContent, deleted.StatusCode);

        var list = await _client.GetFromJsonAsync<List<AvatarDto>>("/api/avatars");
        Assert.DoesNotContain(list!, a => a.Id == avatar.Id);
    }

    [Fact]
    public async Task Avatar_without_name_is_rejected()
    {
        var response = await _client.PostAsJsonAsync("/api/avatars", new SaveAvatarRequest("🐯", ""));
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Singer_crud_with_avatar_and_range()
    {
        var avatars = await _client.GetFromJsonAsync<List<AvatarDto>>("/api/avatars");
        var unicorn = avatars!.First(a => a.Emoji == "🦄");

        var created = await _client.PostAsJsonAsync("/api/singers", new SaveSingerRequest("Zoe", unicorn.Id, null, null));
        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        var singer = await created.Content.ReadFromJsonAsync<SingerDto>();
        Assert.Equal("🦄", singer!.AvatarEmoji);
        Assert.False(singer.HasPhoto);

        // "Find My Voice" saves her range to the profile
        var updated = await _client.PutAsJsonAsync($"/api/singers/{singer.Id}",
            new SaveSingerRequest("Zoe", unicorn.Id, 55, 72));
        var withRange = await updated.Content.ReadFromJsonAsync<SingerDto>();
        Assert.Equal(55, withRange!.RangeLow);
        Assert.Equal(72, withRange.RangeHigh);

        var deleted = await _client.DeleteAsync($"/api/singers/{singer.Id}");
        Assert.Equal(HttpStatusCode.NoContent, deleted.StatusCode);
    }

    [Fact]
    public async Task Singer_list_returns_created_singers()
    {
        var created = await _client.PostAsJsonAsync("/api/singers", new SaveSingerRequest("ListKid", null, null, null));
        var singer = await created.Content.ReadFromJsonAsync<SingerDto>();

        var response = await _client.GetAsync("/api/singers");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var list = await response.Content.ReadFromJsonAsync<List<SingerDto>>();
        Assert.Contains(list!, s => s.Id == singer!.Id && s.Name == "ListKid");
    }

    [Fact]
    public async Task Singer_range_must_be_low_to_high()
    {
        var response = await _client.PostAsJsonAsync("/api/singers", new SaveSingerRequest("Mia", null, 72, 55));
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Photo_upload_and_download_roundtrip()
    {
        var created = await _client.PostAsJsonAsync("/api/singers", new SaveSingerRequest("PhotoKid", null, null, null));
        var singer = await created.Content.ReadFromJsonAsync<SingerDto>();

        var bytes = new byte[] { 0x89, 0x50, 0x4E, 0x47, 1, 2, 3, 4 };
        using var form = new MultipartFormDataContent();
        var file = new ByteArrayContent(bytes);
        file.Headers.ContentType = new("image/png");
        form.Add(file, "photo", "zoe.png");

        var uploaded = await _client.PutAsync($"/api/singers/{singer!.Id}/photo", form);
        Assert.Equal(HttpStatusCode.OK, uploaded.StatusCode);
        var withPhoto = await uploaded.Content.ReadFromJsonAsync<SingerDto>();
        Assert.True(withPhoto!.HasPhoto);

        var photo = await _client.GetAsync($"/api/singers/{singer.Id}/photo");
        Assert.Equal(HttpStatusCode.OK, photo.StatusCode);
        Assert.Equal("image/png", photo.Content.Headers.ContentType!.MediaType);
        Assert.Equal(bytes, await photo.Content.ReadAsByteArrayAsync());
    }

    [Fact]
    public async Task Photo_with_wrong_type_is_rejected()
    {
        var created = await _client.PostAsJsonAsync("/api/singers", new SaveSingerRequest("GifKid", null, null, null));
        var singer = await created.Content.ReadFromJsonAsync<SingerDto>();

        using var form = new MultipartFormDataContent();
        var file = new ByteArrayContent([1, 2, 3]);
        file.Headers.ContentType = new("image/gif");
        form.Add(file, "photo", "nope.gif");

        var response = await _client.PutAsync($"/api/singers/{singer!.Id}/photo", form);
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Song_crud_with_validation()
    {
        var bad = new SaveSongRequest("Bad Song", "🎵", 1, 100, 1,
            [new SongPhraseDto("Oops", [new SongNoteDto(20, 0, 1, "low")])]);
        var rejected = await _client.PostAsJsonAsync("/api/songs", bad);
        Assert.Equal(HttpStatusCode.BadRequest, rejected.StatusCode);

        var good = new SaveSongRequest("La La Song", "🎤", 2, 110, 1,
            [new SongPhraseDto("La la la", [
                new SongNoteDto(60, 0, 1, "La"), new SongNoteDto(62, 1, 1, "la"), new SongNoteDto(64, 2, 2, "la"),
            ])]);
        var created = await _client.PostAsJsonAsync("/api/songs", good);
        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        var song = await created.Content.ReadFromJsonAsync<SongDto>();
        Assert.False(song!.IsSeed);

        var renamed = await _client.PutAsJsonAsync($"/api/songs/{song.Id}", good with { Title = "La La Anthem" });
        Assert.Equal(HttpStatusCode.OK, renamed.StatusCode);
        var fetched = await _client.GetFromJsonAsync<SongDto>($"/api/songs/{song.Id}");
        Assert.Equal("La La Anthem", fetched!.Title);
        Assert.Equal(3, fetched.Phrases[0].Notes.Count);

        var deleted = await _client.DeleteAsync($"/api/songs/{song.Id}");
        Assert.Equal(HttpStatusCode.NoContent, deleted.StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await _client.GetAsync($"/api/songs/{song.Id}")).StatusCode);
    }

    [Fact]
    public async Task High_scores_upsert_and_rank()
    {
        var songs = await _client.GetFromJsonAsync<List<SongDto>>("/api/songs");
        var song = songs!.First(s => s.IsSeed);

        var zoe = await (await _client.PostAsJsonAsync("/api/singers", new SaveSingerRequest("ScoreZoe", null, null, null)))
            .Content.ReadFromJsonAsync<SingerDto>();
        var mia = await (await _client.PostAsJsonAsync("/api/singers", new SaveSingerRequest("ScoreMia", null, null, null)))
            .Content.ReadFromJsonAsync<SingerDto>();

        var first = await (await _client.PostAsJsonAsync("/api/highscores",
                new SubmitHighScoreRequest(song.Id, zoe!.Id, 2, 0.7, 140, 6)))
            .Content.ReadFromJsonAsync<SubmitHighScoreResult>();
        Assert.True(first!.Improved);

        var worse = await (await _client.PostAsJsonAsync("/api/highscores",
                new SubmitHighScoreRequest(song.Id, zoe.Id, 1, 0.4, 80, 3)))
            .Content.ReadFromJsonAsync<SubmitHighScoreResult>();
        Assert.False(worse!.Improved);
        Assert.Equal(2, worse.Score.Stars);

        await _client.PostAsJsonAsync("/api/highscores", new SubmitHighScoreRequest(song.Id, mia!.Id, 3, 0.95, 200, 12));

        var board = await _client.GetFromJsonAsync<List<HighScoreDto>>($"/api/songs/{song.Id}/highscores");
        Assert.Equal("ScoreMia", board![0].SingerName);
        Assert.Equal("ScoreZoe", board[1].SingerName);

        var zoeScores = await _client.GetFromJsonAsync<List<HighScoreDto>>($"/api/singers/{zoe.Id}/highscores");
        Assert.Single(zoeScores!);
    }
}
