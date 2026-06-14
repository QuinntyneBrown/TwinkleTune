using System.Collections.Concurrent;

namespace TwinkleTune.Application.Duet;

public record DuetPlayerInfo(Guid SingerId, string Name, string Avatar);

public record ScoreTick(int Landed, int Streak, int Sparkles, int NoteIdx);

public record DuetSummary(
    Guid SingerId, string Name, int Landed, int Total, int Stars,
    int Sparkles, int MaxStreak, double Accuracy);

public record RoomStateDto(string Code, List<DuetPlayerInfo> Players, Guid? SongId, DateTimeOffset? StartAtUtc);

public record JoinResult(RoomStateDto? Room, string? Error);
public record StartResult(string Code, Guid SongId, DateTimeOffset StartAtUtc);
public record FinishResult(string Code, bool BothDone, List<DuetSummary> Summaries);
public record LeaveResult(string Code, DuetPlayerInfo Player, bool RoomClosed);

public interface IRoomService
{
    RoomStateDto Create(string connectionId, DuetPlayerInfo info);
    JoinResult Join(string code, string connectionId, DuetPlayerInfo info);
    StartResult? StartSong(string connectionId, Guid songId);
    string? GetRoomCode(string connectionId);
    FinishResult? Finish(string connectionId, DuetSummary summary);
    LeaveResult? Leave(string connectionId);
}

/// <summary>
/// In-memory duet rooms. Deliberately not persisted: a duet that outlives a server
/// restart is not a real family scenario (ADR-0002). Rooms expire after 30 idle minutes.
/// </summary>
public class RoomService(TimeProvider time) : IRoomService
{
    private const int MaxPlayers = 2
;
    private static readonly TimeSpan IdleExpiry = TimeSpan.FromMinutes(30);
    // no ambiguous letters (I/L/O), so codes are easy for kids to read out loud
    private const string CodeAlphabet = "ABCDEFGHJKMNPQRSTUVWXYZ";

    private sealed class Player(string connectionId, DuetPlayerInfo info)
    {
        public string ConnectionId { get; } = connectionId;
        public DuetPlayerInfo Info { get; } = info;
        public DuetSummary? Summary { get; set; }
    }

    private sealed class Room(string code, DateTimeOffset now)
    {
        public string Code { get; } = code;
        public List<Player> Players { get; } = new(MaxPlayers);
        public Guid? SongId { get; set; }
        public DateTimeOffset? StartAtUtc { get; set; }
        public DateTimeOffset LastActivity { get; set; } = now;
    }

    private readonly ConcurrentDictionary<string, Room> _rooms = new();
    private readonly ConcurrentDictionary<string, string> _connectionToCode = new();

    public RoomStateDto Create(string connectionId, DuetPlayerInfo info)
    {
        CleanupExpired();
        while (true)
        {
            var code = NewCode();
            var room = new Room(code, time.GetUtcNow());
            room.Players.Add(new Player(connectionId, info));
            if (_rooms.TryAdd(code, room))
            {
                _connectionToCode[connectionId] = code;
                return ToState(room);
            }
        }
    }

    public JoinResult Join(string code, string connectionId, DuetPlayerInfo info)
    {
        CleanupExpired();
        code = code.Trim().ToUpperInvariant();
        if (!_rooms.TryGetValue(code, out var room))
            return new JoinResult(null, "That room code wasn't found — check the letters!");

        lock (room)
        {
            if (room.Players.Count >= MaxPlayers)
                return new JoinResult(null, "That room already has two singers!");
            room.Players.Add(new Player(connectionId, info));
            room.LastActivity = time.GetUtcNow();
            _connectionToCode[connectionId] = code;
            return new JoinResult(ToState(room), null);
        }
    }

    public StartResult? StartSong(string connectionId, Guid songId)
    {
        if (GetRoom(connectionId) is not { } room) return null;
        lock (room)
        {
            if (room.Players.Count < MaxPlayers) return null;
            room.SongId = songId;
            room.StartAtUtc = time.GetUtcNow().AddSeconds(3);
            room.LastActivity = time.GetUtcNow();
            foreach (var p in room.Players) p.Summary = null;
            return new StartResult(room.Code, songId, room.StartAtUtc.Value);
        }
    }

    public string? GetRoomCode(string connectionId) =>
        _connectionToCode.TryGetValue(connectionId, out var code) ? code : null;

    public FinishResult? Finish(string connectionId, DuetSummary summary)
    {
        if (GetRoom(connectionId) is not { } room) return null;
        lock (room)
        {
            var player = room.Players.FirstOrDefault(p => p.ConnectionId == connectionId);
            if (player is null) return null;
            player.Summary = summary;
            room.LastActivity = time.GetUtcNow();
            var done = room.Players.Count == MaxPlayers && room.Players.All(p => p.Summary is not null);
            return new FinishResult(room.Code, done, room.Players.Where(p => p.Summary is not null).Select(p => p.Summary!).ToList());
        }
    }

    public LeaveResult? Leave(string connectionId)
    {
        if (!_connectionToCode.TryRemove(connectionId, out var code)) return null;
        if (!_rooms.TryGetValue(code, out var room)) return null;
        lock (room)
        {
            var player = room.Players.FirstOrDefault(p => p.ConnectionId == connectionId);
            if (player is null) return null;
            room.Players.Remove(player);
            room.LastActivity = time.GetUtcNow();
            var closed = room.Players.Count == 0;
            if (closed) _rooms.TryRemove(code, out _);
            return new LeaveResult(code, player.Info, closed);
        }
    }

    private Room? GetRoom(string connectionId) =>
        GetRoomCode(connectionId) is { } code && _rooms.TryGetValue(code, out var room) ? room : null;

    private void CleanupExpired()
    {
        var cutoff = time.GetUtcNow() - IdleExpiry;
        foreach (var (code, room) in _rooms)
        {
            if (room.LastActivity >= cutoff) continue;
            if (_rooms.TryRemove(code, out var removed))
            {
                lock (removed)
                {
                    foreach (var p in removed.Players) _connectionToCode.TryRemove(p.ConnectionId, out _);
                }
            }
        }
    }

    private static string NewCode() =>
        new(Enumerable.Range(0, 4).Select(_ => CodeAlphabet[Random.Shared.Next(CodeAlphabet.Length)]).ToArray());

    private static RoomStateDto ToState(Room room) =>
        new(room.Code, room.Players.Select(p => p.Info).ToList(), room.SongId, room.StartAtUtc);
}
