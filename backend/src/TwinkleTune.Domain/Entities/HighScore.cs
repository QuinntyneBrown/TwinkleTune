namespace TwinkleTune.Domain.Entities;

/// <summary>
/// Best result for one singer on one song — unique per (SongId, SingerId),
/// updated only when a new play beats the stored one.
/// </summary>
public class HighScore
{
    public Guid Id { get; set; }

    public Guid SongId { get; set; }
    public Song? Song { get; set; }

    public Guid SingerId { get; set; }
    public Singer? Singer { get; set; }

    public int Stars { get; set; }
    public double Accuracy { get; set; }
    public int Sparkles { get; set; }
    public int MaxStreak { get; set; }
    public DateTimeOffset AchievedAt { get; set; }

    /// <summary>Stars first, then accuracy — the same ordering leaderboards use.</summary>
    public bool IsBeatenBy(int stars, double accuracy) =>
        stars > Stars || (stars == Stars && accuracy > Accuracy);
}
