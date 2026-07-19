using Microsoft.EntityFrameworkCore;
using TwinkleTune.Application.Abstractions;

namespace TwinkleTune.Infrastructure.Persistence;

/// <summary>Creates the SQLite schema on demand (the same call the API makes on boot).</summary>
public sealed class DatabaseInitializer(AppDbContext db) : IDatabaseInitializer
{
    public Task EnsureCreatedAsync(CancellationToken ct = default) => db.Database.EnsureCreatedAsync(ct);
}
