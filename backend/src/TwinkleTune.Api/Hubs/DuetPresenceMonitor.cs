using Microsoft.AspNetCore.SignalR;
using TwinkleTune.Application.Duet;

namespace TwinkleTune.Api.Hubs;

/// <summary>
/// Waits out the reconnect grace of a dropped duet connection. A hub instance is gone as soon as
/// its call returns, so the wait and the late <c>PlayerLeft</c> announcement live here instead.
/// </summary>
public sealed class DuetPresenceMonitor(
    IRoomService rooms,
    IHubContext<DuetHub> hub,
    TimeProvider time,
    IHostApplicationLifetime lifetime,
    ILogger<DuetPresenceMonitor> logger)
{
    public void ExpireAfterGrace(AwayResult away) => _ = ExpireAsync(away);

    private async Task ExpireAsync(AwayResult away)
    {
        try
        {
            await Task.Delay(rooms.ReconnectGrace, time, lifetime.ApplicationStopping);
            var left = rooms.ExpireAway(away);
            if (left is { RoomClosed: false })
                await hub.Clients.Group(left.Code).SendAsync("PlayerLeft", left.Player);
        }
        catch (OperationCanceledException)
        {
            // the server is stopping; the rooms go with it
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Could not close the seat of a dropped duet singer in room {Code}.", away.Code);
        }
    }
}
