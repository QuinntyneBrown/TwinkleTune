// Acceptance Test
// Traces to: DM-L2-20
// Description: The shared start instant is issued only once both singers have said they are ready

using TwinkleTune.Application.Duet;
using Xunit;

namespace TwinkleTune.UnitTests;

public class RoomReadyTests
{
    private sealed class FakeTime : TimeProvider
    {
        public DateTimeOffset Now { get; set; } = new(2026, 6, 12, 12, 0, 0, TimeSpan.Zero);
        public override DateTimeOffset GetUtcNow() => Now;
    }

    private static readonly DuetPlayerInfo Zoe = new(Guid.NewGuid(), "Zoe", "🦄");
    private static readonly DuetPlayerInfo Mia = new(Guid.NewGuid(), "Mia", "🐱");

    private static (RoomService Rooms, FakeTime Time, string Code) StartedRoom()
    {
        var time = new FakeTime();
        var rooms = new RoomService(time);
        var code = rooms.Create("zoe-1", Zoe).Code;
        rooms.Join(code, "mia-1", Mia);
        rooms.StartSong("zoe-1", Guid.NewGuid());
        return (rooms, time, code);
    }

    [Fact]
    public void The_first_ready_singer_waits_for_her_buddy()
    {
        var (rooms, _, code) = StartedRoom();

        var ready = rooms.MarkReady("zoe-1");

        Assert.Equal(code, ready!.Code);
        Assert.Null(ready.SingAtUtc);
    }

    [Fact]
    public void The_second_ready_sets_the_shared_start_three_seconds_ahead()
    {
        var (rooms, time, _) = StartedRoom();
        rooms.MarkReady("zoe-1");
        time.Now = time.Now.AddSeconds(40); // Mia took a while to find her headphones

        var ready = rooms.MarkReady("mia-1");

        Assert.Equal(time.Now.AddSeconds(3), ready!.SingAtUtc);
    }

    [Fact]
    public void Saying_ready_twice_does_not_move_the_shared_start()
    {
        var (rooms, time, _) = StartedRoom();
        rooms.MarkReady("zoe-1");
        var first = rooms.MarkReady("mia-1")!.SingAtUtc;
        time.Now = time.Now.AddSeconds(1);

        Assert.Equal(first, rooms.MarkReady("zoe-1")!.SingAtUtc);
    }

    [Fact]
    public void One_singer_saying_ready_twice_is_still_waiting()
    {
        var (rooms, _, _) = StartedRoom();
        rooms.MarkReady("zoe-1");
        Assert.Null(rooms.MarkReady("zoe-1")!.SingAtUtc);
    }

    [Fact]
    public void A_new_song_needs_both_singers_ready_again()
    {
        var (rooms, _, _) = StartedRoom();
        rooms.MarkReady("zoe-1");
        rooms.MarkReady("mia-1");

        rooms.StartSong("zoe-1", Guid.NewGuid());

        Assert.Null(rooms.MarkReady("mia-1")!.SingAtUtc);
    }

    [Fact]
    public void A_connection_in_no_room_has_nothing_to_be_ready_for()
    {
        Assert.Null(new RoomService(new FakeTime()).MarkReady("nobody"));
    }

    [Fact]
    public void A_rejoining_singer_sees_who_is_ready_and_the_shared_start()
    {
        var (rooms, _, code) = StartedRoom();
        rooms.MarkReady("zoe-1");
        var singAt = rooms.MarkReady("mia-1")!.SingAtUtc;
        rooms.Disconnect("mia-1");

        var room = rooms.Rejoin(code, "mia-2", Mia.SingerId).Room!;

        Assert.All(room.Players, p => Assert.True(p.Ready));
        Assert.Equal(singAt, room.SingAtUtc);
        Assert.All(rooms.GetDiagnostics().Rooms.Single(r => r.Code == code).Players, p => Assert.True(p.Ready));
    }
}
