using Microsoft.EntityFrameworkCore;
using TwinkleTune.Domain.Entities;

namespace TwinkleTune.Infrastructure.Persistence;

/// <summary>
/// Idempotent seeding: the default avatars plus the seven public-domain songs,
/// note-for-note identical to the frontend's bundled catalog (frontend/apps/game/src/songs/catalog.ts).
/// </summary>
public static class SeedData
{
    public static async Task EnsureSeededAsync(AppDbContext db, CancellationToken ct = default)
    {
        if (!await db.Avatars.AnyAsync(ct))
        {
            db.Avatars.AddRange(
                new Avatar { Id = Guid.NewGuid(), Emoji = "🦄", Name = "Unicorn" },
                new Avatar { Id = Guid.NewGuid(), Emoji = "🐱", Name = "Kitten" },
                new Avatar { Id = Guid.NewGuid(), Emoji = "🐸", Name = "Frog" },
                new Avatar { Id = Guid.NewGuid(), Emoji = "🦊", Name = "Fox" },
                new Avatar { Id = Guid.NewGuid(), Emoji = "🐰", Name = "Bunny" },
                new Avatar { Id = Guid.NewGuid(), Emoji = "🐼", Name = "Panda" },
                new Avatar { Id = Guid.NewGuid(), Emoji = "🦖", Name = "Dino" },
                new Avatar { Id = Guid.NewGuid(), Emoji = "🐙", Name = "Octopus" });
            await db.SaveChangesAsync(ct);
        }

        if (!await db.Songs.AnyAsync(ct))
        {
            db.Songs.AddRange(Twinkle(), Mary(), HotCrossBuns(), LondonBridge(), OldMacDonald(), RowYourBoat(), JesusLovesMe());
            await db.SaveChangesAsync(ct);
        }
    }

    private static SongNote N(int midi, double start, double dur, string syll) => new(midi, start, dur, syll);

    private static Song Make(string title, string emoji, int art, int bpm, int difficulty, List<SongPhrase> phrases) =>
        new()
        {
            Id = Guid.NewGuid(),
            Title = title,
            Emoji = emoji,
            Art = art,
            Bpm = bpm,
            Difficulty = difficulty,
            Phrases = phrases,
            IsSeed = true,
            UpdatedAt = DateTimeOffset.UtcNow,
        };

    private static Song Twinkle() => Make("Twinkle Twinkle Little Star", "⭐", 1, 100, 1,
    [
        new SongPhrase("Twinkle, twinkle, little star",
        [
            N(60, 0, 1, "Twin"), N(60, 1, 1, "kle"), N(67, 2, 1, "twin"), N(67, 3, 1, "kle"),
            N(69, 4, 1, "lit"), N(69, 5, 1, "tle"), N(67, 6, 2, "star"),
        ]),
        new SongPhrase("How I wonder what you are",
        [
            N(65, 8, 1, "How"), N(65, 9, 1, "I"), N(64, 10, 1, "won"), N(64, 11, 1, "der"),
            N(62, 12, 1, "what"), N(62, 13, 1, "you"), N(60, 14, 2, "are"),
        ]),
        new SongPhrase("Up above the world so high",
        [
            N(67, 16, 1, "Up"), N(67, 17, 1, "a"), N(65, 18, 1, "bove"), N(65, 19, 1, "the"),
            N(64, 20, 1, "world"), N(64, 21, 1, "so"), N(62, 22, 2, "high"),
        ]),
        new SongPhrase("Like a diamond in the sky",
        [
            N(67, 24, 1, "Like"), N(67, 25, 1, "a"), N(65, 26, 1, "dia"), N(65, 27, 1, "mond"),
            N(64, 28, 1, "in"), N(64, 29, 1, "the"), N(62, 30, 2, "sky"),
        ]),
        new SongPhrase("Twinkle, twinkle, little star",
        [
            N(60, 32, 1, "Twin"), N(60, 33, 1, "kle"), N(67, 34, 1, "twin"), N(67, 35, 1, "kle"),
            N(69, 36, 1, "lit"), N(69, 37, 1, "tle"), N(67, 38, 2, "star"),
        ]),
        new SongPhrase("How I wonder what you are",
        [
            N(65, 40, 1, "How"), N(65, 41, 1, "I"), N(64, 42, 1, "won"), N(64, 43, 1, "der"),
            N(62, 44, 1, "what"), N(62, 45, 1, "you"), N(60, 46, 2, "are"),
        ]),
    ]);

    private static Song Mary() => Make("Mary Had a Little Lamb", "🐑", 2, 104, 1,
    [
        new SongPhrase("Mary had a little lamb",
        [
            N(64, 0, 1, "Ma"), N(62, 1, 1, "ry"), N(60, 2, 1, "had"), N(62, 3, 1, "a"),
            N(64, 4, 1, "lit"), N(64, 5, 1, "tle"), N(64, 6, 2, "lamb"),
        ]),
        new SongPhrase("Little lamb, little lamb",
        [
            N(62, 8, 1, "lit"), N(62, 9, 1, "tle"), N(62, 10, 2, "lamb"),
            N(64, 12, 1, "lit"), N(67, 13, 1, "tle"), N(67, 14, 2, "lamb"),
        ]),
        new SongPhrase("Mary had a little lamb, its",
        [
            N(64, 16, 1, "Ma"), N(62, 17, 1, "ry"), N(60, 18, 1, "had"), N(62, 19, 1, "a"),
            N(64, 20, 1, "lit"), N(64, 21, 1, "tle"), N(64, 22, 1, "lamb"), N(64, 23, 1, "its"),
        ]),
        new SongPhrase("Fleece was white as snow",
        [
            N(62, 24, 1, "fleece"), N(62, 25, 1, "was"), N(64, 26, 1, "white"), N(62, 27, 1, "as"),
            N(60, 28, 4, "snow"),
        ]),
    ]);

    private static Song HotCrossBuns() => Make("Hot Cross Buns", "🥐", 4, 96, 1,
    [
        new SongPhrase("Hot cross buns!", [N(64, 0, 1, "Hot"), N(62, 1, 1, "cross"), N(60, 2, 2, "buns")]),
        new SongPhrase("Hot cross buns!", [N(64, 4, 1, "Hot"), N(62, 5, 1, "cross"), N(60, 6, 2, "buns")]),
        new SongPhrase("One a penny, two a penny",
        [
            N(60, 8, 0.5, "One"), N(60, 8.5, 0.5, "a"), N(60, 9, 0.5, "pen"), N(60, 9.5, 0.5, "ny"),
            N(62, 10, 0.5, "two"), N(62, 10.5, 0.5, "a"), N(62, 11, 0.5, "pen"), N(62, 11.5, 0.5, "ny"),
        ]),
        new SongPhrase("Hot cross buns!", [N(64, 12, 1, "Hot"), N(62, 13, 1, "cross"), N(60, 14, 2, "buns")]),
    ]);

    private static Song LondonBridge() => Make("London Bridge", "🌉", 1, 104, 2,
    [
        new SongPhrase("London Bridge is falling down",
        [
            N(67, 0, 1.5, "Lon"), N(69, 1.5, 0.5, "don"), N(67, 2, 1, "Bridge"), N(65, 3, 1, "is"),
            N(64, 4, 1, "fall"), N(65, 5, 1, "ing"), N(67, 6, 2, "down"),
        ]),
        new SongPhrase("Falling down", [N(62, 8, 1, "fall"), N(64, 9, 1, "ing"), N(65, 10, 2, "down")]),
        new SongPhrase("Falling down", [N(64, 12, 1, "fall"), N(65, 13, 1, "ing"), N(67, 14, 2, "down")]),
        new SongPhrase("London Bridge is falling down",
        [
            N(67, 16, 1.5, "Lon"), N(69, 17.5, 0.5, "don"), N(67, 18, 1, "Bridge"), N(65, 19, 1, "is"),
            N(64, 20, 1, "fall"), N(65, 21, 1, "ing"), N(67, 22, 2, "down"),
        ]),
        new SongPhrase("My fair lady!",
        [
            N(62, 24, 1, "My"), N(67, 25, 1, "fair"), N(64, 26, 1, "la"), N(60, 27, 2, "dy"),
        ]),
    ]);

    private static Song OldMacDonald() => Make("Old MacDonald", "🚜", 2, 108, 2,
    [
        new SongPhrase("Old MacDonald had a farm",
        [
            N(60, 0, 1, "Old"), N(60, 1, 1, "Mac"), N(60, 2, 1, "Don"), N(55, 3, 1, "ald"),
            N(57, 4, 1, "had"), N(57, 5, 1, "a"), N(55, 6, 2, "farm"),
        ]),
        new SongPhrase("E-I-E-I-O!",
        [
            N(64, 8, 1, "E"), N(64, 9, 1, "I"), N(62, 10, 1, "E"), N(62, 11, 1, "I"), N(60, 12, 2, "O"),
        ]),
        new SongPhrase("And on that farm he had a duck",
        [
            N(55, 14, 0.5, "And"), N(60, 14.5, 0.5, "on"), N(60, 15, 0.5, "that"), N(60, 15.5, 0.5, "farm"),
            N(55, 16, 0.5, "he"), N(57, 16.5, 0.5, "had"), N(57, 17, 0.5, "a"), N(55, 17.5, 1.5, "duck"),
        ]),
        new SongPhrase("E-I-E-I-O!",
        [
            N(64, 19, 1, "E"), N(64, 20, 1, "I"), N(62, 21, 1, "E"), N(62, 22, 1, "I"), N(60, 23, 2, "O"),
        ]),
    ]);

    private static Song RowYourBoat() => Make("Row, Row, Row Your Boat", "🛶", 3, 84, 3,
    [
        new SongPhrase("Row, row, row your boat",
        [
            N(60, 0, 1, "Row"), N(60, 1, 1, "row"), N(60, 2, 0.75, "row"), N(62, 2.75, 0.25, "your"),
            N(64, 3, 1, "boat"),
        ]),
        new SongPhrase("Gently down the stream",
        [
            N(64, 4, 0.75, "Gent"), N(62, 4.75, 0.25, "ly"), N(64, 5, 0.75, "down"), N(65, 5.75, 0.25, "the"),
            N(67, 6, 2, "stream"),
        ]),
        new SongPhrase("Merrily, merrily, merrily, merrily",
        [
            N(72, 8, 0.34, "Mer"), N(72, 8.34, 0.33, "ri"), N(72, 8.67, 0.33, "ly"),
            N(67, 9, 0.34, "mer"), N(67, 9.34, 0.33, "ri"), N(67, 9.67, 0.33, "ly"),
            N(64, 10, 0.34, "mer"), N(64, 10.34, 0.33, "ri"), N(64, 10.67, 0.33, "ly"),
            N(60, 11, 0.34, "mer"), N(60, 11.34, 0.33, "ri"), N(60, 11.67, 0.33, "ly"),
        ]),
        new SongPhrase("Life is but a dream",
        [
            N(67, 12, 0.75, "Life"), N(65, 12.75, 0.25, "is"), N(64, 13, 0.75, "but"), N(62, 13.75, 0.25, "a"),
            N(60, 14, 2, "dream"),
        ]),
    ]);

    private static Song JesusLovesMe() => Make("Jesus Loves Me", "✝️", 3, 100, 2,
    [
        new SongPhrase("Jesus loves me, this I know",
        [
            N(67, 0, 1, "Je"), N(64, 1, 1, "sus"), N(64, 2, 1, "loves"), N(62, 3, 1, "me"),
            N(64, 4, 1, "this"), N(67, 5, 1, "I"), N(67, 6, 2, "know"),
        ]),
        new SongPhrase("For the Bible tells me so",
        [
            N(69, 8, 1, "For"), N(69, 9, 1, "the"), N(72, 10, 1, "Bi"), N(69, 11, 1, "ble"),
            N(69, 12, 1, "tells"), N(67, 13, 1, "me"), N(67, 14, 2, "so"),
        ]),
        new SongPhrase("Little ones to Him belong",
        [
            N(67, 16, 1, "Lit"), N(64, 17, 1, "tle"), N(64, 18, 1, "ones"), N(62, 19, 1, "to"),
            N(64, 20, 1, "Him"), N(67, 21, 1, "be"), N(67, 22, 2, "long"),
        ]),
        new SongPhrase("They are weak, but He is strong",
        [
            N(69, 24, 1, "They"), N(69, 25, 1, "are"), N(67, 26, 1, "weak"), N(65, 27, 1, "but"),
            N(64, 28, 1, "He"), N(62, 29, 1, "is"), N(60, 30, 2, "strong"),
        ]),
        new SongPhrase("Yes, Jesus loves me",
        [
            N(72, 32, 2, "Yes"), N(69, 34, 1, "Je"), N(69, 35, 1, "sus"), N(67, 36, 2, "loves"), N(67, 38, 2, "me"),
        ]),
        new SongPhrase("Yes, Jesus loves me",
        [
            N(72, 40, 2, "Yes"), N(69, 42, 1, "Je"), N(69, 43, 1, "sus"), N(67, 44, 2, "loves"), N(67, 46, 2, "me"),
        ]),
        new SongPhrase("Yes, Jesus loves me",
        [
            N(72, 48, 2, "Yes"), N(69, 50, 1, "Je"), N(69, 51, 1, "sus"), N(67, 52, 2, "loves"), N(67, 54, 2, "me"),
        ]),
        new SongPhrase("The Bible tells me so",
        [
            N(69, 56, 1, "The"), N(67, 57, 1, "Bi"), N(65, 58, 1, "ble"), N(64, 59, 1, "tells"),
            N(62, 60, 1, "me"), N(60, 61, 3, "so"),
        ]),
    ]);
}
