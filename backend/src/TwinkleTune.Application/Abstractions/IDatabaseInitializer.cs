namespace TwinkleTune.Application.Abstractions;

/// <summary>
/// Ensures the store is physically ready (schema created) before it is read or written.
/// Abstracted so the API startup and the CLI share one code path instead of each reaching
/// into EF Core directly.
/// </summary>
public interface IDatabaseInitializer
{
    Task EnsureCreatedAsync(CancellationToken ct = default);
}
