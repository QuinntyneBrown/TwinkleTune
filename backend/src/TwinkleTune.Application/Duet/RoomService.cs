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

/// <summary>Both singers' summaries and the shared sparkle total the results lead with.</summary>
public record DuetResult(List<DuetSummary> Players, int CombinedSparkles)
{
    public static DuetResult From(List<DuetSummary> summaries) => new(summaries, summaries.Sum(s => s.Sparkles));
}

/// <summary>A dropped connection's seat, held until <see cref="IRoomService.ReconnectGrace"/> runs out.</summary>
public record AwayResult(string Code, Guid SingerId, DateTimeOffset AwaySince);

/// <summary>The room as it stands, handed to a singer who rejoins so she is back in step at once.</summary>
public record RoomSnapshot(
    string Code, List<PlayerSnapshot> Players, Guid? SongId, DateTimeOffset? StartAtUtc, DuetResult? Result);
public record PlayerSnapshot(DuetPlayerInfo Info, ScoreTick? LastTick, DuetSummary? Summary);
public record RejoinResult(RoomSnapshot? Room, string? Error);

/// <summary>Read-only picture of the in-memory rooms, for a grown-up debugging a duet.</summary>
public record DuetDiagnostics(DateTimeOffset TimestampUtc, List<RoomDiagnostics> Rooms);
public record RoomDiagnostics(
    string Code, List<PlayerDiagnostics> Players, Guid? SongId,
    DateTimeOffset? StartAtUtc, DateTimeOffset LastActivityUtc);
public record PlayerDiagnostics(string Name, bool Connected, bool Finished, int? LastNoteIdx);

public interface IRoomService
{
    RoomStateDto Create(string connectionId, DuetPlayerInfo info);
    JoinResult Join(string code, string connectionId, DuetPlayerInfo info);
    StartResult? StartSong(string connectionId, Guid songId);
    string? GetRoomCode(string connectionId);
    /// <summary>Remembers the singer's latest tick for a rejoining buddy; returns her room code.</summary>
    string? RecordTick(string connectionId, ScoreTick tick);
    FinishResult? Finish(string connectionId, DuetSummary summary);
    LeaveResult? Leave(string connectionId);

    /// <summary>How long a dropped connection's seat is held before the singer counts as gone.</summary>
    TimeSpan ReconnectGrace { get; }
    /// <summary>Marks the singer away but keeps her seat. Null when the connection is in no room.</summary>
    AwayResult? Disconnect(string connectionId);
    /// <summary>Puts a singer back in her seat on a new connection and returns the room as it stands.</summary>
    RejoinResult Rejoin(string code, string connectionId, Guid singerId);
    /// <summary>Removes the singer if she is still away from that same drop. Null when she came back.</summary>
    LeaveResult? ExpireAway(AwayResult away);
    DuetDiagnostics GetDiagnostics();
}

/// <summary>
/// In-memory duet rooms. Deliberately not persisted: a duet that outlives a server
/// restart is not a real family scenario (ADR-0002). Rooms expire after 30 idle minutes.
/// A dropped connection keeps its seat for <see cref="ReconnectGrace"/>, so a Wi-Fi blip is not a goodbye.
/// </summary>
public class RoomService(TimeProvider time, TimeSpan? reconnectGrace = null) : IRoomService
{
    public static readonly TimeSpan DefaultReconnectGrace = TimeSpan.FromSeconds(20);

    public TimeSpan ReconnectGrace { get; } = reconnectGrace ?? DefaultReconnectGrace;

    private const int MaxPlayers = 2
;
    private static readonly TimeSpan IdleExpiry = TimeSpan.FromMinutes(30);
    // no ambiguous letters (I/L/O), so codes are easy for kids to read out loud
    private const string CodeAlphabet = "ABCDEFGHJKMNPQRSTUVWXYZ";

    private sealed class Player(string connectionId, DuetPlayerInfo info)
    {
        public string ConnectionId { get; set; } = connectionId;
        public DuetPlayerInfo Info { get; } = info;
        public DuetSummary? Summary { get; set; }
        public ScoreTick? LastTick { get; set; }
        /// <summary>When her connection dropped; null while she is connected.</summary>
        public DateTimeOffset? AwaySince { get; set; }
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
            // a dropped singer typing the code again takes her own seat back
            if (room.Players.FirstOrDefault(p => p.AwaySince is not null && p.Info.SingerId == info.SingerId) is { } seat)
            {
                Reseat(room, seat, connectionId);
                return new JoinResult(ToState(room), null);
            }
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
            foreach (var p in room.Players)
            {
                p.Summary = null;
                p.LastTick = null;
            }
            return new StartResult(room.Code, songId, room.StartAtUtc.Value);
        }
    }

    public string? GetRoomCode(string connectionId) =>
        _connectionToCode.TryGetValue(connectionId, out var code) ? code : null;

    public string? RecordTick(string connectionId, ScoreTick tick)
    {
        if (GetRoom(connectionId) is not { } room) return null;
        lock (room)
        {
            if (room.Players.FirstOrDefault(p => p.ConnectionId == connectionId) is { } player)
                player.LastTick = tick;
            return room.Code;
        }
    }

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
            return Remove(room, player);
        }
    }

    public AwayResult? Disconnect(string connectionId)
    {
        if (!_connectionToCode.TryRemove(connectionId, out var code)) return null;
        if (!_rooms.TryGetValue(code, out var room)) return null;
        lock (room)
        {
            var player = room.Players.FirstOrDefault(p => p.ConnectionId == connectionId);
            if (player is null) return null;
            player.AwaySince = time.GetUtcNow();
            return new AwayResult(code, player.Info.SingerId, player.AwaySince.Value);
        }
    }

    public RejoinResult Rejoin(string code, string connectionId, Guid singerId)
    {
        code = code.Trim().ToUpperInvariant();
        if (_rooms.TryGetValue(code, out var room))
        {
            lock (room)
            {
                // her old connection may not have been noticed as gone yet, so any seat of hers will do
                var seat = room.Players.Where(p => p.Info.SingerId == singerId)
                    .OrderByDescending(p => p.AwaySince is not null).FirstOrDefault();
                if (seat is not null)
                {
                    Reseat(room, seat, connectionId);
                    return new RejoinResult(ToSnapshot(room), null);
                }
            }
        }
        return new RejoinResult(null, "That room has closed — make a new one!");
    }

    public LeaveResult? ExpireAway(AwayResult away)
    {
        if (!_rooms.TryGetValue(away.Code, out var room)) return null;
        lock (room)
        {
            var player = room.Players.FirstOrDefault(p =>
                p.Info.SingerId == away.SingerId && p.AwaySince == away.AwaySince);
            return player is null ? null : Remove(room, player);
        }
    }

    /// <summary>Takes the player out and closes the room once it is empty. Call under the room lock.</summary>
    private LeaveResult Remove(Room room, Player player)
    {
        room.Players.Remove(player);
        room.LastActivity = time.GetUtcNow();
        var closed = room.Players.Count == 0;
        if (closed) _rooms.TryRemove(room.Code, out _);
        return new LeaveResult(room.Code, player.Info, closed);
    }

    /// <summary>Binds a seat to a new connection. Call under the room lock.</summary>
    private void Reseat(Room room, Player seat, string connectionId)
    {
        _connectionToCode.TryRemove(seat.ConnectionId, out _);
        seat.ConnectionId = connectionId;
        seat.AwaySince = null;
        room.LastActivity = time.GetUtcNow();
        _connectionToCode[connectionId] = room.Code;
    }

    public DuetDiagnostics GetDiagnostics()
    {
        var rooms = new List<RoomDiagnostics>();
        foreach (var room in _rooms.Values)
        {
            lock (room)
            {
                rooms.Add(new RoomDiagnostics(
                    room.Code,
                    room.Players.Select(p => new PlayerDiagnostics(
                        p.Info.Name, p.AwaySince is null, p.Summary is not null, p.LastTick?.NoteIdx)).ToList(),
                    room.SongId, room.StartAtUtc, room.LastActivity));
            }
        }
        return new DuetDiagnostics(time.GetUtcNow(), rooms.OrderBy(r => r.Code).ToList());
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

    private static RoomSnapshot ToSnapshot(Room room)
    {
        var summaries = room.Players.Where(p => p.Summary is not null).Select(p => p.Summary!).ToList();
        return new RoomSnapshot(
            room.Code,
            room.Players.Select(p => new PlayerSnapshot(p.Info, p.LastTick, p.Summary)).ToList(),
            room.SongId, room.StartAtUtc,
            room.Players.Count == MaxPlayers && summaries.Count == MaxPlayers ? DuetResult.From(summaries) : null);
    }

    private static RoomStateDto ToState(Room room) =>
        new(room.Code, room.Players.Select(p => p.Info).ToList(), room.SongId, room.StartAtUtc);
}
