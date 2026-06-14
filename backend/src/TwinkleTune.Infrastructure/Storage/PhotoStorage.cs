using TwinkleTune.Application.Abstractions;

namespace TwinkleTune.Infrastructure.Storage;

/// <summary>Profile photos on local disk — the whole backend state is one .db file plus this folder.</summary>
public class PhotoStorage(string rootPath) : IPhotoStorage
{
    private static readonly Dictionary<string, string> ContentTypeToExt = new(StringComparer.OrdinalIgnoreCase)
    {
        ["image/jpeg"] = ".jpg",
        ["image/png"] = ".png",
        ["image/webp"] = ".webp",
    };

    public static bool IsSupported(string contentType) => ContentTypeToExt.ContainsKey(contentType);

    public async Task<string> SaveAsync(Guid singerId, Stream content, string contentType, CancellationToken ct = default)
    {
        if (!ContentTypeToExt.TryGetValue(contentType, out var ext))
            throw new ArgumentException($"Unsupported photo type: {contentType}");

        Directory.CreateDirectory(rootPath);
        // replace any previous photo regardless of its extension
        foreach (var old in Directory.GetFiles(rootPath, $"{singerId}.*"))
            File.Delete(old);

        var fileName = $"{singerId}{ext}";
        await using var file = File.Create(Path.Combine(rootPath, fileName));
        await content.CopyToAsync(file, ct);
        return fileName;
    }

    public (Stream Stream, string ContentType)? OpenRead(string fileName)
    {
        var path = Path.Combine(rootPath, Path.GetFileName(fileName)); // no traversal
        if (!File.Exists(path)) return null;
        var contentType = ContentTypeToExt.FirstOrDefault(kv => kv.Value == Path.GetExtension(path).ToLowerInvariant()).Key
                          ?? "application/octet-stream";
        return (File.OpenRead(path), contentType);
    }

    public void Delete(string fileName)
    {
        var path = Path.Combine(rootPath, Path.GetFileName(fileName));
        if (File.Exists(path)) File.Delete(path);
    }
}
