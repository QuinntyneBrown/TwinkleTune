// Acceptance Test
// Traces to: DM-L2-18, DM-L2-19
// Description: A dropped singer keeps her seat for the reconnect grace and rejoins to a full room snapshot

using TwinkleTune.Application.Duet;
using Xunit;

namespace TwinkleTune.UnitTests;

public class RoomReconnectTests
{
    private sealed class FakeTime : TimeProvider
    {
        public DateTimeOffset Now { get; set; } = new(2026, 6, 12, 12, 0, 0, TimeSpan.Zero);
        public override DateTimeOffset GetUtcNow() => Now;
    }

    private static readonly DuetPlayerInfo Zoe = new(Guid.NewGuid(), "Zoe", "🦄");
    private static readonly DuetPlayerInfo Mia = new(Guid.NewGuid(), "Mia", "🐱");

    /// <summary>Zoe on "zoe-1" and Mia on "mia-1", singing a song together.</summary>
    private static (RoomService Rooms, string Code, Guid SongId) SingingRoom()
    {
        var rooms = new RoomService(new FakeTime());
        var code = rooms.Create("zoe-1", Zoe).Code;
        rooms.Join(code, "mia-1", Mia);
        var songId = Guid.NewGuid();
        rooms.StartSong("zoe-1", songId);
        return (rooms, code, songId);
    }

    [Fact]
    public void A_dropped_singer_keeps_her_seat()
    {
        var (rooms, code, _) = SingingRoom();

        var away = rooms.Disconnect("mia-1");

        Assert.NotNull(away);
        Assert.Contains("two singers", rooms.Join(code, "dad-1", new DuetPlayerInfo(Guid.NewGuid(), "Dad", "🐻")).Error);
        var seats = rooms.GetDiagnostics().Rooms.Single(r => r.Code == code).Players;
        Assert.True(seats.Single(p => p.Name == "Zoe").Connected);
        Assert.False(seats.Single(p => p.Name == "Mia").Connected);
    }

    [Fact]
    public void Rejoining_within_the_grace_returns_the_room_as_it_stands()
    {
        var (rooms, code, songId) = SingingRoom();
        rooms.RecordTick("zoe-1", new ScoreTick(5, 5, 50, 6));
        var away = rooms.Disconnect("mia-1")!;

        var rejoined = rooms.Rejoin(code, "mia-2", Mia.SingerId);

        Assert.Null(rejoined.Error);
        var room = rejoined.Room!;
        Assert.Equal(songId, room.SongId);
        Assert.NotNull(room.StartAtUtc);
        Assert.Equal(["Zoe", "Mia"], room.Players.Select(p => p.Info.Name));
        Assert.Equal(new ScoreTick(5, 5, 50, 6), room.Players[0].LastTick);
        Assert.Null(room.Result);

        // her new connection is the one in the room, and the old grace no longer removes her
        Assert.Equal(code, rooms.RecordTick("mia-2", new ScoreTick(1, 1, 10, 1)));
        Assert.Null(rooms.ExpireAway(away));
    }

    [Fact]
    public void A_singer_who_does_not_come_back_leaves_when_the_grace_ends()
    {
        var (rooms, code, _) = SingingRoom();
        var away = rooms.Disconnect("mia-1")!;

        var left = rooms.ExpireAway(away);

        Assert.Equal("Mia", left!.Player.Name);
        Assert.False(left.RoomClosed);
        Assert.Contains("closed", rooms.Rejoin(code, "mia-2", Mia.SingerId).Error);
    }

    [Fact]
    public void A_room_closes_when_its_last_singer_does_not_come_back()
    {
        var rooms = new RoomService(new FakeTime());
        var code = rooms.Create("zoe-1", Zoe).Code;

        var left = rooms.ExpireAway(rooms.Disconnect("zoe-1")!);

        Assert.True(left!.RoomClosed);
        Assert.DoesNotContain(rooms.GetDiagnostics().Rooms, r => r.Code == code);
    }

    [Fact]
    public void An_old_grace_does_not_remove_a_singer_who_dropped_again_later()
    {
        var time = new FakeTime();
        var rooms = new RoomService(time);
        var code = rooms.Create("zoe-1", Zoe).Code;
        rooms.Join(code, "mia-1", Mia);

        var firstDrop = rooms.Disconnect("mia-1")!;
        rooms.Rejoin(code, "mia-2", Mia.SingerId);
        time.Now = time.Now.AddSeconds(5);
        var secondDrop = rooms.Disconnect("mia-2")!;

        Assert.Null(rooms.ExpireAway(firstDrop));
        Assert.NotNull(rooms.ExpireAway(secondDrop));
    }

    [Fact]
    public void Rejoining_a_room_that_is_gone_fails_kindly()
    {
        var rooms = new RoomService(new FakeTime());
        var rejoined = rooms.Rejoin("ZZZZ", "mia-2", Mia.SingerId);
        Assert.Null(rejoined.Room);
        Assert.Contains("closed", rejoined.Error);
    }

    [Fact]
    public void The_snapshot_carries_the_combined_result_once_both_have_finished()
    {
        var (rooms, code, _) = SingingRoom();
        rooms.Finish("zoe-1", new DuetSummary(Zoe.SingerId, "Zoe", 18, 20, 3, 180, 9, 0.9));
        rooms.Disconnect("mia-1");
        var mid = rooms.Rejoin(code, "mia-2", Mia.SingerId).Room!;
        Assert.Null(mid.Result);
        Assert.NotNull(mid.Players[0].Summary);

        rooms.Finish("mia-2", new DuetSummary(Mia.SingerId, "Mia", 15, 20, 2, 150, 6, 0.75));
        rooms.Disconnect("zoe-1");
        var done = rooms.Rejoin(code, "zoe-2", Zoe.SingerId).Room!;

        Assert.Equal(330, done.Result!.CombinedSparkles);
        Assert.Equal(2, done.Result.Players.Count);
    }

    [Fact]
    public void Joining_with_the_code_again_takes_back_a_dropped_singers_seat()
    {
        var (rooms, code, _) = SingingRoom();
        var away = rooms.Disconnect("mia-1")!;

        var joined = rooms.Join(code, "mia-2", Mia);

        Assert.Null(joined.Error);
        Assert.Equal(2, joined.Room!.Players.Count);
        Assert.Null(rooms.ExpireAway(away));
    }

    [Fact]
    public void A_new_song_clears_the_last_ticks()
    {
        var (rooms, code, _) = SingingRoom();
        rooms.RecordTick("zoe-1", new ScoreTick(5, 5, 50, 6));
        rooms.StartSong("zoe-1", Guid.NewGuid());
        rooms.Disconnect("mia-1");

        var room = rooms.Rejoin(code, "mia-2", Mia.SingerId).Room!;

        Assert.All(room.Players, p => Assert.Null(p.LastTick));
    }
}
