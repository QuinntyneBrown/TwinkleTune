namespace TwinkleTune.Domain.Entities;

/// <summary>
/// A family member who sings. The voice range lives here (it belongs to the person and
/// follows her across devices); mic latency does NOT (it belongs to the device).
/// </summary>
public class Singer
{
    public Guid Id { get; set; }
    public required string Name { get; set; }

    public Guid? AvatarId { get; set; }
    public Avatar? Avatar { get; set; }

    /// <summary>File name inside photo storage when a real photo was uploaded.</summary>
    public string? PhotoFileName { get; set; }

    /// <summary>Lowest comfortable MIDI note, captured by "Find My Voice".</summary>
    public int? RangeLow { get; set; }

    /// <summary>Highest comfortable MIDI note.</summary>
    public int? RangeHigh { get; set; }

    public DateTimeOffset CreatedAt { get; set; }
}
