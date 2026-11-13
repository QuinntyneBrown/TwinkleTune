// Acceptance Test
// Traces to: DM-L2-18, DM-L2-19
// Description: A singer whose connection drops rejoins her duet on a new connection, and is only announced as gone after the grace

using Microsoft.AspNetCore.SignalR.Client;
using TwinkleTune.Application.Duet;
using Xunit;

namespace TwinkleTune.IntegrationTests;

public class DuetReconnectTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    private static readonly TimeSpan Timeout = TimeSpan.FromSeconds(15);

    [Fact]
    public async Task A_dropped_singer_rejoins_and_the_duet_carries_on()
    {
        // GIVEN Zoe and Mia mid-song, with one of Zoe's ticks already relayed
        await using var zoe = await factory.ConnectDuetAsync();
        var mia = await factory.ConnectDuetAsync();
        var zoeInfo = new DuetPlayerInfo(Guid.NewGuid(), "Zoe", "🦄");
        var miaInfo = new DuetPlayerInfo(Guid.NewGuid(), "Mia", "🐱");
        var room = await zoe.InvokeAsync<RoomStateDto>("CreateRoom", zoeInfo);
        await mia.InvokeAsync<RoomStateDto>("JoinRoom", room.Code, miaInfo);
        var songId = Guid.NewGuid();
        await zoe.InvokeAsync("StartSong", songId);
        await zoe.InvokeAsync("ScoreTick", new ScoreTick(5, 5, 50, 6));

        var miaLeft = false;
        zoe.On<DuetPlayerInfo>("PlayerLeft", _ => miaLeft = true);

        // WHEN Mia's connection drops and she rejoins on a new one
        await mia.DisposeAsync();
        await using var miaAgain = await factory.ConnectDuetAsync();
        var snapshot = await miaAgain.InvokeAsync<RoomSnapshot>("RejoinRoom", room.Code, miaInfo.SingerId);

        // THEN she is handed the room as it stands, Zoe's progress included
        Assert.Equal(songId, snapshot.SongId);
        Assert.Equal(["Zoe", "Mia"], snapshot.Players.Select(p => p.Info.Name));
        Assert.Equal(5, snapshot.Players[0].LastTick!.Streak);

        // AND the relay reaches her new connection
        var tickSeen = new TaskCompletionSource<ScoreTick>(TaskCreationOptions.RunContinuationsAsynchronously);
        miaAgain.On<ScoreTick>("OpponentTick", t => tickSeen.TrySetResult(t));
        await zoe.InvokeAsync("ScoreTick", new ScoreTick(6, 6, 60, 7));
        Assert.Equal(6, (await tickSeen.Task.WaitAsync(Timeout)).Streak);

        // AND Zoe is never told that Mia left, even once the grace has run out
        await Task.Delay(ApiFactory.ReconnectGrace + TimeSpan.FromSeconds(1));
        Assert.False(miaLeft);
    }

    [Fact]
    public async Task A_singer_who_stays_gone_is_announced_after_the_grace()
    {
        // GIVEN Zoe and Mia in a room
        await using var zoe = await factory.ConnectDuetAsync();
        var mia = await factory.ConnectDuetAsync();
        var room = await zoe.InvokeAsync<RoomStateDto>("CreateRoom", new DuetPlayerInfo(Guid.NewGuid(), "Zoe", "🦄"));
        await mia.InvokeAsync<RoomStateDto>("JoinRoom", room.Code, new DuetPlayerInfo(Guid.NewGuid(), "Mia", "🐱"));

        var left = new TaskCompletionSource<DuetPlayerInfo>(TaskCreationOptions.RunContinuationsAsynchronously);
        zoe.On<DuetPlayerInfo>("PlayerLeft", p => left.TrySetResult(p));

        // WHEN Mia's connection drops and she does not come back
        await mia.DisposeAsync();

        // THEN Zoe is told Mia left, once the grace has run out
        Assert.Equal("Mia", (await left.Task.WaitAsync(Timeout)).Name);
    }

    [Fact]
    public async Task Rejoining_a_closed_room_fails_kindly()
    {
        await using var kid = await factory.ConnectDuetAsync();
        var ex = await Assert.ThrowsAsync<Microsoft.AspNetCore.SignalR.HubException>(() =>
            kid.InvokeAsync<RoomSnapshot>("RejoinRoom", "ZZZZ", Guid.NewGuid()));
        Assert.Contains("closed", ex.Message);
    }
}
