# TwinkleTune CLI (`twinkletune`)

A small [System.CommandLine](https://learn.microsoft.com/dotnet/standard/commandline/)
admin tool for the TwinkleTune family karaoke server. It shares the exact application and
infrastructure services the API uses, so anything it writes obeys the same validation rules
and lands in the same family database.

It is packaged as an **installable .NET global tool**.

## Design

The CLI is wired with the standard Microsoft.Extensions building blocks and follows SOLID:

- **Single responsibility** — each verb is its own `ICliCommand` (`SeedCommand`,
  `SongCommand`, `AvatarCommand`); parsing, hosting and seeding are separate types.
- **Open/closed** — new verbs are added by implementing `ICliCommand` and registering it;
  the composition root discovers them without being edited.
- **Liskov / interface segregation** — small, focused abstractions (`ISeedDataSource`,
  `IDatabaseSeeder`, `IDatabaseInitializer`, plus the existing `I*Service` interfaces).
- **Dependency inversion** — commands depend on application-layer interfaces resolved from
  `Microsoft.Extensions.DependencyInjection`, never on concrete types or EF Core.

The built-in seed catalog is **data, not code**: it lives in
`TwinkleTune.Infrastructure/Persistence/seed-data.json` (an embedded resource) rather than
being hardcoded in C#.

## Install

```bash
# from a built package
dotnet pack backend/src/TwinkleTune.Cli -c Release
dotnet tool install --global --add-source backend/src/TwinkleTune.Cli/bin/Release TwinkleTune.Cli

# or run without installing
dotnet run --project backend/src/TwinkleTune.Cli -- <command>
```

## Configuration

The CLI reads the same settings as the API (environment variables or `appsettings.json` in
the working directory). Point it at the family database you want to manage:

| Setting                     | Environment variable            | Default                       |
| --------------------------- | ------------------------------- | ----------------------------- |
| `ConnectionStrings:Default` | `ConnectionStrings__Default`    | `Data Source=./data/twinkletune.db` |
| `DataPath`                  | `DataPath`                      | `./data`                      |
| `PhotosPath`                | `PhotosPath`                    | `./data/photos`               |

## Commands

```bash
# Seed the built-in catalog (idempotent — safe to re-run)
twinkletune seed

# Seed from your own catalog file (same JSON shape as seed-data.json)
twinkletune seed --file my-catalog.json

# Add a song from a JSON definition (see samples/song.example.json)
twinkletune song add samples/song.example.json
twinkletune song list

# Manage avatars
twinkletune avatar add --emoji 🐯 --name Tiger
twinkletune avatar list
```

Run `twinkletune --help` (or `twinkletune <command> --help`) for full usage.
