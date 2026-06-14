using Microsoft.AspNetCore.Http.Connections;
using Microsoft.AspNetCore.SignalR;
using Microsoft.AspNetCore.SignalR.Client;
using TwinkleTune.Application.Duet;
using Xunit;

namespace TwinkleTune.IntegrationTests;

public class DuetFlowTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    private static readonly TimeSpan Timeout = TimeSpan.FromSeconds(15);

    private record DuetResultDto(List<DuetSummary> Players, int CombinedSparkles);

    private async Task<HubConnection> ConnectAsync()
    {
        var connection = new HubConnectionBuilder()
            .WithUrl(new Uri(factory.Server.BaseAddress, "hubs/duet"), options =>
            {
                options.HttpMessageHandlerFactory = _ => factory.Server.CreateHandler();
                options.Transports = HttpTransportType.LongPolling;
            })
            .Build();
        await connection.StartAsync();
        return connection;
    }

    [Fact]
    public async Task Two_singers_complete_a_full_duet()
    {
        await using var zoe = await ConnectAsync();
        await using var mia = await ConnectAsync();

        var zoeInfo = new DuetPlayerInfo(Guid.NewGuid(), "Zoe", "🦄");
        var miaInfo = new DuetPlayerInfo(Guid.NewGuid(), "Mia", "🐱");

        var joined = new TaskCompletionSource<DuetPlayerInfo>(TaskCreationOptions.RunContinuationsAsynchronously);
        zoe.On<DuetPlayerInfo>("PlayerJoined", p => joined.TrySetResult(p));

        var room = await zoe.InvokeAsync<RoomStateDto>("CreateRoom", zoeInfo);
        Assert.Matches("^[A-Z]{4}$", room.Code);

        var roomForMia = await mia.InvokeAsync<RoomStateDto>("JoinRoom", room.Code, miaInfo);
        Assert.Equal(2, roomForMia.Players.Count);
        Assert.Equal("Mia", (await joined.Task.WaitAsync(Timeout)).Name);

        // synchronized start reaches both singers
        var zoeStart = new TaskCompletionSource<DateTimeOffset>(TaskCreationOptions.RunContinuationsAsynchronously);
        var miaStart = new TaskCompletionSource<DateTimeOffset>(TaskCreationOptions.RunContinuationsAsynchronously);
        zoe.On<Guid, DateTimeOffset>("SongStarted", (_, at) => zoeStart.TrySetResult(at));
        mia.On<Guid, DateTimeOffset>("SongStarted", (_, at) => miaStart.TrySetResult(at));

        var songId = Guid.NewGuid();
        await zoe.InvokeAsync("StartSong", songId);
        Assert.Equal(await zoeStart.Task.WaitAsync(Timeout), await miaStart.Task.WaitAsync(Timeout));

        // live streak ticks flow to the other singer only
        var tickSeen = new TaskCompletionSource<ScoreTick>(TaskCreationOptions.RunContinuationsAsynchronously);
        mia.On<ScoreTick>("OpponentTick", t => tickSeen.TrySetResult(t));
        await zoe.InvokeAsync("ScoreTick", new ScoreTick(5, 5, 50, 4));
        var tick = await tickSeen.Task.WaitAsync(Timeout);
        Assert.Equal(5, tick.Streak);

        // both finishing produces one shared DuetResult
        var zoeResult = new TaskCompletionSource<DuetResultDto>(TaskCreationOptions.RunContinuationsAsynchronously);
        var miaResult = new TaskCompletionSource<DuetResultDto>(TaskCreationOptions.RunContinuationsAsynchronously);
        zoe.On<DuetResultDto>("DuetResult", r => zoeResult.TrySetResult(r));
        mia.On<DuetResultDto>("DuetResult", r => miaResult.TrySetResult(r));

        var opponentFinished = new TaskCompletionSource<DuetSummary>(TaskCreationOptions.RunContinuationsAsynchronously);
        mia.On<DuetSummary>("OpponentFinished", s => opponentFinished.TrySetResult(s));

        await zoe.InvokeAsync("FinishSong", new DuetSummary(zoeInfo.SingerId, "Zoe", 18, 20, 3, 180, 9, 0.9));
        Assert.Equal("Zoe", (await opponentFinished.Task.WaitAsync(Timeout)).Name);

        await mia.InvokeAsync("FinishSong", new DuetSummary(miaInfo.SingerId, "Mia", 15, 20, 2, 150, 6, 0.75));

        var result = await zoeResult.Task.WaitAsync(Timeout);
        Assert.Equal(330, result.CombinedSparkles);
        Assert.Equal(2, result.Players.Count);
        Assert.Equal(result.CombinedSparkles, (await miaResult.Task.WaitAsync(Timeout)).CombinedSparkles);
    }

    [Fact]
    public async Task Joining_a_made_up_code_fails_kindly()
    {
        await using var kid = await ConnectAsync();
        var ex = await Assert.ThrowsAsync<HubException>(() =>
            kid.InvokeAsync<RoomStateDto>("JoinRoom", "ZZZZ", new DuetPlayerInfo(Guid.NewGuid(), "Kid", "🐸")));
        Assert.Contains("wasn't found", ex.Message);
    }

    [Fact]
    public async Task Leaving_notifies_the_other_singer()
    {
        await using var zoe = await ConnectAsync();
        await using var mia = await ConnectAsync();

        var room = await zoe.InvokeAsync<RoomStateDto>("CreateRoom", new DuetPlayerInfo(Guid.NewGuid(), "Zoe", "🦄"));
        await mia.InvokeAsync<RoomStateDto>("JoinRoom", room.Code, new DuetPlayerInfo(Guid.NewGuid(), "Mia", "🐱"));

        var left = new TaskCompletionSource<DuetPlayerInfo>(TaskCreationOptions.RunContinuationsAsynchronously);
        zoe.On<DuetPlayerInfo>("PlayerLeft", p => left.TrySetResult(p));

        await mia.InvokeAsync("LeaveRoom");
        Assert.Equal("Mia", (await left.Task.WaitAsync(Timeout)).Name);
    }
}
