using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using TwinkleTune.Domain.Entities;

namespace TwinkleTune.Infrastructure.Persistence;

public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<Avatar> Avatars => Set<Avatar>();
    public DbSet<Singer> Singers => Set<Singer>();
    public DbSet<Song> Songs => Set<Song>();
    public DbSet<HighScore> HighScores => Set<HighScore>();

    private static readonly JsonSerializerOptions JsonOptions = new();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Avatar>(b =>
        {
            b.Property(a => a.Emoji).HasMaxLength(16);
            b.Property(a => a.Name).HasMaxLength(30);
        });

        modelBuilder.Entity<Singer>(b =>
        {
            b.Property(s => s.Name).HasMaxLength(30);
            b.Property(s => s.PhotoFileName).HasMaxLength(64);
            b.HasOne(s => s.Avatar)
                .WithMany()
                .HasForeignKey(s => s.AvatarId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<Song>(b =>
        {
            b.Property(s => s.Title).HasMaxLength(80);
            b.Property(s => s.Emoji).HasMaxLength(16);
            // phrases live as one JSON document — the schema mirrors the frontend Song shape
            b.Property(s => s.Phrases)
                .HasConversion(
                    v => JsonSerializer.Serialize(v, JsonOptions),
                    v => JsonSerializer.Deserialize<List<SongPhrase>>(v, JsonOptions) ?? new List<SongPhrase>())
                .Metadata.SetValueComparer(new ValueComparer<List<SongPhrase>>(
                    (a, b2) => JsonSerializer.Serialize(a, JsonOptions) == JsonSerializer.Serialize(b2, JsonOptions),
                    v => JsonSerializer.Serialize(v, JsonOptions).GetHashCode(),
                    v => JsonSerializer.Deserialize<List<SongPhrase>>(JsonSerializer.Serialize(v, JsonOptions), JsonOptions)!));
        });

        modelBuilder.Entity<HighScore>(b =>
        {
            b.HasIndex(h => new { h.SongId, h.SingerId }).IsUnique();
            b.HasOne(h => h.Song).WithMany().HasForeignKey(h => h.SongId).OnDelete(DeleteBehavior.Cascade);
            b.HasOne(h => h.Singer).WithMany().HasForeignKey(h => h.SingerId).OnDelete(DeleteBehavior.Cascade);
        });
    }
}
