// Acceptance Test
// Traces to: FS-L2-20
// Description: The duet diagnostics endpoint shows the live in-memory rooms and nothing once they close

using System.Net.Http.Json;
using Microsoft.AspNetCore.SignalR.Client;
using TwinkleTune.Application.Duet;
using Xunit;

namespace TwinkleTune.IntegrationTests;

public class DuetDiagnosticsTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    private async Task<RoomDiagnostics?> RoomAsync(string code)
    {
        var snapshot = await factory.CreateClient().GetFromJsonAsync<DuetDiagnostics>("/diagnostics/duet");
        return snapshot!.Rooms.SingleOrDefault(r => r.Code == code);
    }

    [Fact]
    public async Task A_live_room_is_listed_with_its_singers_and_song()
    {
        // GIVEN two singers in a room
        await using var zoe = await factory.ConnectDuetAsync();
        await using var mia = await factory.ConnectDuetAsync();
        var created = await zoe.InvokeAsync<RoomStateDto>("CreateRoom", new DuetPlayerInfo(Guid.NewGuid(), "Zoe", "🦄"));
        await mia.InvokeAsync<RoomStateDto>("JoinRoom", created.Code, new DuetPlayerInfo(Guid.NewGuid(), "Mia", "🐱"));

        // WHEN the diagnostics endpoint is read before a song starts
        var waiting = await RoomAsync(created.Code);

        // THEN the room is listed with both singers and no song
        Assert.NotNull(waiting);
        Assert.Equal(["Zoe", "Mia"], waiting!.Players.Select(p => p.Name));
        Assert.Null(waiting.SongId);
        Assert.All(waiting.Players, p => Assert.False(p.Finished));

        // WHEN a song starts and one singer finishes
        var songId = Guid.NewGuid();
        await zoe.InvokeAsync("StartSong", songId);
        await zoe.InvokeAsync("FinishSong", new DuetSummary(Guid.NewGuid(), "Zoe", 18, 20, 3, 180, 9, 0.9));
        var singing = await RoomAsync(created.Code);

        // THEN the room shows the song, its start time and who has finished
        Assert.Equal(songId, singing!.SongId);
        Assert.NotNull(singing.StartAtUtc);
        Assert.True(singing.Players.Single(p => p.Name == "Zoe").Finished);
        Assert.False(singing.Players.Single(p => p.Name == "Mia").Finished);
    }

    [Fact]
    public async Task A_closed_room_is_no_longer_listed()
    {
        // GIVEN a room whose only singer leaves
        await using var zoe = await factory.ConnectDuetAsync();
        var created = await zoe.InvokeAsync<RoomStateDto>("CreateRoom", new DuetPlayerInfo(Guid.NewGuid(), "Zoe", "🦄"));
        Assert.NotNull(await RoomAsync(created.Code));
        await zoe.InvokeAsync("LeaveRoom");

        // THEN the diagnostics endpoint no longer lists it
        Assert.Null(await RoomAsync(created.Code));
    }
}
