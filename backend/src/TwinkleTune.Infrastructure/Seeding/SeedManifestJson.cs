using System.Text.Json;
using TwinkleTune.Application.Abstractions.Seeding;

namespace TwinkleTune.Infrastructure.Seeding;

/// <summary>Shared JSON contract for reading a <see cref="SeedManifest"/> (camelCase, tolerant).</summary>
internal static class SeedManifestJson
{
    public static readonly JsonSerializerOptions Options = new(JsonSerializerDefaults.Web)
    {
        PropertyNameCaseInsensitive = true,
        ReadCommentHandling = JsonCommentHandling.Skip,
        AllowTrailingCommas = true,
    };

    public static async Task<SeedManifest> ReadAsync(Stream stream, string origin, CancellationToken ct)
    {
        var manifest = await JsonSerializer.DeserializeAsync<SeedManifest>(stream, Options, ct);
        return manifest ?? throw new InvalidOperationException($"Seed data at '{origin}' was empty or not valid JSON.");
    }
}
