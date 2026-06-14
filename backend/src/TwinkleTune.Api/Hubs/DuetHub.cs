using Microsoft.AspNetCore.SignalR;
using TwinkleTune.Application.Duet;

namespace TwinkleTune.Api.Hubs;

/// <summary>
/// Relay for family duets. Scoring happens entirely on each client; the hub only passes
/// tiny score events between the two singers and announces the synchronized start.
/// </summary>
public class DuetHub(IRoomService rooms) : Hub
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

    public async Task StartSong(Guid songId)
    {
        var start = rooms.StartSong(Context.ConnectionId, songId)
            ?? throw new HubException("You need two singers in the room to start!");
        await Clients.Group(start.Code).SendAsync("SongStarted", start.SongId, start.StartAtUtc);
    }

    public async Task ScoreTick(ScoreTick tick)
    {
        if (rooms.GetRoomCode(Context.ConnectionId) is { } code)
            await Clients.OthersInGroup(code).SendAsync("OpponentTick", tick);
    }

    public async Task FinishSong(DuetSummary summary)
    {
        var result = rooms.Finish(Context.ConnectionId, summary);
        if (result is null) return;
        await Clients.OthersInGroup(result.Code).SendAsync("OpponentFinished", summary);
        if (result.BothDone)
        {
            await Clients.Group(result.Code).SendAsync("DuetResult", new
            {
                Players = result.Summaries,
                CombinedSparkles = result.Summaries.Sum(s => s.Sparkles),
            });
        }
    }

    public Task LeaveRoom() => HandleLeaveAsync();

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        await HandleLeaveAsync();
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
