namespace TwinkleTune.Domain.Entities;

/// <summary>A pickable singer avatar (emoji + friendly name), managed by grown-ups.</summary>
public class Avatar
{
    public Guid Id { get; set; }
    public required string Emoji { get; set; }
    public required string Name { get; set; }
}
