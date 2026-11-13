// Acceptance Test
// Traces to: DM-L2-20, DM-L2-21
// Description: Both singers get the same start instant once both are ready, and can read the server's clock to place it

using Microsoft.AspNetCore.SignalR.Client;
using TwinkleTune.Application.Duet;
using Xunit;

namespace TwinkleTune.IntegrationTests;

public class DuetReadyStartTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    private static readonly TimeSpan Timeout = TimeSpan.FromSeconds(15);

    [Fact]
    public async Task Both_singers_get_one_shared_start_once_both_are_ready()
    {
        // GIVEN Zoe and Mia on the sing screen of a started duet
        await using var zoe = await factory.ConnectDuetAsync();
        await using var mia = await factory.ConnectDuetAsync();
        var room = await zoe.InvokeAsync<RoomStateDto>("CreateRoom", new DuetPlayerInfo(Guid.NewGuid(), "Zoe", "🦄"));
        await mia.InvokeAsync<RoomStateDto>("JoinRoom", room.Code, new DuetPlayerInfo(Guid.NewGuid(), "Mia", "🐱"));
        await zoe.InvokeAsync("StartSong", Guid.NewGuid());

        var zoeSingAt = new TaskCompletionSource<DateTimeOffset>(TaskCreationOptions.RunContinuationsAsynchronously);
        var miaSingAt = new TaskCompletionSource<DateTimeOffset>(TaskCreationOptions.RunContinuationsAsynchronously);
        zoe.On<DateTimeOffset>("SingAt", at => zoeSingAt.TrySetResult(at));
        mia.On<DateTimeOffset>("SingAt", at => miaSingAt.TrySetResult(at));

        // WHEN only Zoe is ready
        await zoe.InvokeAsync("Ready");
        await Task.Delay(300);

        // THEN nobody is told to sing yet
        Assert.False(zoeSingAt.Task.IsCompleted);
        Assert.False(miaSingAt.Task.IsCompleted);

        // WHEN Mia is ready too
        var serverNow = await mia.InvokeAsync<DateTimeOffset>("ServerTime");
        await mia.InvokeAsync("Ready");

        // THEN both are given the same instant, about three seconds ahead on the server's clock
        var at = await zoeSingAt.Task.WaitAsync(Timeout);
        Assert.Equal(at, await miaSingAt.Task.WaitAsync(Timeout));
        Assert.InRange((at - serverNow).TotalSeconds, 2.5, 4.5);
    }

    [Fact]
    public async Task The_hub_tells_a_singer_what_time_the_server_thinks_it_is()
    {
        await using var kid = await factory.ConnectDuetAsync();
        var before = DateTimeOffset.UtcNow;
        var serverNow = await kid.InvokeAsync<DateTimeOffset>("ServerTime");
        Assert.InRange(serverNow, before.AddSeconds(-1), DateTimeOffset.UtcNow.AddSeconds(1));
    }
}
