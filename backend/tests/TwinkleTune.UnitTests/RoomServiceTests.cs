using TwinkleTune.Application.Duet;
using Xunit;

namespace TwinkleTune.UnitTests;

public class RoomServiceTests
{
    private sealed class FakeTime : TimeProvider
    {
        public DateTimeOffset Now { get; set; } = new(2026, 6, 12, 12, 0, 0, TimeSpan.Zero);
        public override DateTimeOffset GetUtcNow() => Now;
    }

    private static DuetPlayerInfo Player(string name) => new(Guid.NewGuid(), name, "🦄");

    [Fact]
    public void Create_returns_a_friendly_four_letter_code()
    {
        var rooms = new RoomService(new FakeTime());
        var state = rooms.Create("conn1", Player("Zoe"));
        Assert.Matches("^[ABCDEFGHJKMNPQRSTUVWXYZ]{4}$", state.Code);
        Assert.Single(state.Players);
    }

    [Fact]
    public void Join_unknown_code_gives_a_kid_friendly_error()
    {
        var rooms = new RoomService(new FakeTime());
        var result = rooms.Join("XXXX", "conn2", Player("Mia"));
        Assert.Null(result.Room);
        Assert.Contains("wasn't found", result.Error);
    }

    [Fact]
    public void Room_holds_exactly_two_singers()
    {
        var rooms = new RoomService(new FakeTime());
        var state = rooms.Create("c1", Player("Zoe"));
        Assert.Null(rooms.Join(state.Code, "c2", Player("Mia")).Error);
        var third = rooms.Join(state.Code, "c3", Player("Dad"));
        Assert.Contains("two singers", third.Error);
    }

    [Fact]
    public void Start_requires_both_singers()
    {
        var time = new FakeTime();
        var rooms = new RoomService(time);
        var state = rooms.Create("c1", Player("Zoe"));
        Assert.Null(rooms.StartSong("c1", Guid.NewGuid()));

        rooms.Join(state.Code, "c2", Player("Mia"));
        var start = rooms.StartSong("c1", Guid.NewGuid());
        Assert.NotNull(start);
        Assert.Equal(time.Now.AddSeconds(3), start!.StartAtUtc);
    }

    [Fact]
    public void Finish_reports_both_done_only_after_both_summaries()
    {
        var rooms = new RoomService(new FakeTime());
        var state = rooms.Create("c1", Player("Zoe"));
        rooms.Join(state.Code, "c2", Player("Mia"));
        rooms.StartSong("c1", Guid.NewGuid());

        var summary1 = new DuetSummary(Guid.NewGuid(), "Zoe", 18, 20, 3, 180, 9, 0.9);
        var first = rooms.Finish("c1", summary1);
        Assert.False(first!.BothDone);

        var summary2 = new DuetSummary(Guid.NewGuid(), "Mia", 15, 20, 2, 150, 6, 0.75);
        var second = rooms.Finish("c2", summary2);
        Assert.True(second!.BothDone);
        Assert.Equal(2, second.Summaries.Count);
    }

    [Fact]
    public void Rooms_expire_after_thirty_idle_minutes()
    {
        var time = new FakeTime();
        var rooms = new RoomService(time);
        var state = rooms.Create("c1", Player("Zoe"));

        time.Now = time.Now.AddMinutes(31);
        rooms.Create("c9", Player("Someone")); // triggers lazy cleanup

        var late = rooms.Join(state.Code, "c2", Player("Mia"));
        Assert.NotNull(late.Error);
    }

    [Fact]
    public void Leaving_closes_the_room_when_empty()
    {
        var rooms = new RoomService(new FakeTime());
        var state = rooms.Create("c1", Player("Zoe"));
        rooms.Join(state.Code, "c2", Player("Mia"));

        var first = rooms.Leave("c2");
        Assert.False(first!.RoomClosed);

        var second = rooms.Leave("c1");
        Assert.True(second!.RoomClosed);

        Assert.NotNull(rooms.Join(state.Code, "c3", Player("Dad")).Error);
    }
}
