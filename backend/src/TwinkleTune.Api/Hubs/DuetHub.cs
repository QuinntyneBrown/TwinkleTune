using Microsoft.AspNetCore.SignalR;
using TwinkleTune.Application.Duet;

namespace TwinkleTune.Api.Hubs;

/// <summary>
/// Relay for family duets. Scoring happens entirely on each client; the hub only passes
/// tiny score events between the two singers and announces the synchronized start.
/// </summary>
public class DuetHub(IRoomService rooms, DuetPresenceMonitor presence, TimeProvider time) : Hub
{
    public async Task<RoomStateDto> CreateRoom(DuetPlayerInfo info)
    {
        var state = rooms.Create(Context.ConnectionId, info);
        await Groups.AddToGroupAsync(Context.ConnectionId, state.Code);
        return state;
    }

    public async Task<RoomStateDto> JoinRoom(string code, DuetPlayerInfo info)
    {
        var result = rooms.Join(code, Context.ConnectionId, info);
        if (result.Error is not null) throw new HubException(result.Error);
        var state = result.Room!;
        await Groups.AddToGroupAsync(Context.ConnectionId, state.Code);
        await Clients.OthersInGroup(state.Code).SendAsync("PlayerJoined", info);
        return state;
    }

    /// <summary>
    /// Puts a singer whose connection dropped back in her seat, and hands her the room as it
    /// stands so her screen is in step again at once.
    /// </summary>
    public async Task<RoomSnapshot> RejoinRoom(string code, Guid singerId)
    {
        var result = rooms.Rejoin(code, Context.ConnectionId, singerId);
        if (result.Error is not null) throw new HubException(result.Error);
        await Groups.AddToGroupAsync(Context.ConnectionId, result.Room!.Code);
        return result.Room;
    }

    public async Task StartSong(Guid songId)
    {
        var start = rooms.StartSong(Context.ConnectionId, songId)
            ?? throw new HubException("You need two singers in the room to start!");
        await Clients.Group(start.Code).SendAsync("SongStarted", start.SongId, start.StartAtUtc);
    }

    /// <summary>
    /// A singer tapped "I'm ready!". Once both have, the room is given one start instant on the
    /// server's clock, a short lead ahead, and each device begins its count-in at that instant.
    /// </summary>
    public async Task Ready()
    {
        if (rooms.MarkReady(Context.ConnectionId) is { SingAtUtc: { } singAt } ready)
            await Clients.Group(ready.Code).SendAsync("SingAt", singAt);
    }

    /// <summary>
    /// The server's clock, so a device can work out how far its own clock is off and place the
    /// shared start instant without trusting two tablets to agree on the time.
    /// </summary>
    public DateTimeOffset ServerTime() => time.GetUtcNow();

    public async Task ScoreTick(ScoreTick tick)
    {
        if (rooms.RecordTick(Context.ConnectionId, tick) is { } code)
            await Clients.OthersInGroup(code).SendAsync("OpponentTick", tick);
    }

    public async Task FinishSong(DuetSummary summary)
    {
        var result = rooms.Finish(Context.ConnectionId, summary);
        if (result is null) return;
        await Clients.OthersInGroup(result.Code).SendAsync("OpponentFinished", summary);
        if (result.BothDone)
        {
            await Clients.Group(result.Code).SendAsync("DuetResult", DuetResult.From(result.Summaries));
        }
    }

    public Task LeaveRoom() => HandleLeaveAsync();

    /// <summary>
    /// A dropped connection is not a goodbye: the seat is held for the reconnect grace, and only
    /// a singer who has not rejoined by then is announced as gone.
    /// </summary>
    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        if (rooms.Disconnect(Context.ConnectionId) is { } away) presence.ExpireAfterGrace(away);
        await base.OnDisconnectedAsync(exception);
    }

    private async Task HandleLeaveAsync()
    {
        var left = rooms.Leave(Context.ConnectionId);
        if (left is null) return;
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, left.Code);
        if (!left.RoomClosed)
            await Clients.Group(left.Code).SendAsync("PlayerLeft", left.Player);
    }
}
