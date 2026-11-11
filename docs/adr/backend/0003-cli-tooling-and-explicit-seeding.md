# ADR-0003: CLI Tooling — TwinkleTune.Cli and Explicit Seeding

**Date:** 2026-07-20
**Category:** backend
**Status:** Accepted
**Deciders:** Quinntyne Brown, Claude

## Context

ADR-0002 accepted a Clean-Architecture backend (`Domain`, `Application`, `Infrastructure`, `Api`)
over EF Core + SQLite, whose schema is created with `EnsureCreated()` and whose default avatars and
seven public-domain songs are seeded **implicitly at server startup** (`SeedData.EnsureSeededAsync`
called from `Api/Program.cs`).

Two things push against that start-up seeding as the product matures:

- **Seeding is a hidden side effect.** It runs on every boot, is invisible to the operator, and
  couples "provision the data" to "start the web host." A grown-up who wants to (re)provision, inspect,
  or reset the family data has no first-class way to do it short of editing code or hand-running SQL.
- **The maintainer wants an operations tool.** The explicit ask: a `TwinkleTune.Cli` built on
  **System.CommandLine**, composed with **Microsoft.Extensions** (Host/DI/Configuration/Logging),
  designed to **SOLID** principles, shipped as an **installable .NET tool**, and organised with a
  **command-per-file** pattern — with data seeding as its first command.

Forces: a single maintainer working in .NET who wants the CLI to reuse the *existing* Application and
Infrastructure services (no forked data logic); family scale (one instance, one data folder on a home
LAN); the frontend must remain offline-first with the server a progressive enhancement; and the tool
must be safe to run repeatedly.

## Decision

1. **Introduce `backend/src/TwinkleTune.Cli`** — a fifth composition root over the existing four
   projects. Where `Api/Program.cs` builds a `WebApplication`, `Cli` builds a **Generic Host**
   (`Host.CreateApplicationBuilder`) and registers the identical `AddApplicationServices()` +
   `AddInfrastructure(connectionString, photosPath)`, so command handlers resolve the *same* services,
   repositories, and `AppDbContext` the server uses.
2. **Build the command surface on System.CommandLine** — a `RootCommand`, sub-commands, generated
   help, `--version`, option parsing/validation, and standard process exit codes (0 success,
   documented non-zero on failure/validation).
3. **Move seeding into an explicit `seed` command.** The tool's `seed` command ensures the schema
   exists and idempotently writes the eight avatars and seven songs only when absent. The start-up call
   in `Program.cs` is removed; the server still ensures its schema exists but no longer writes seed
   rows. Run documentation instructs operators to run `twinkletune seed` as a provisioning step.
4. **Single canonical seed definition.** The seed catalogue is defined once and shared by the CLI and
   the backend, so the two never disagree about what "seeded" means.
5. **Ship as an installable .NET tool** (`PackAsTool=true`, `PackageId=TwinkleTune.Cli`,
   `ToolCommandName=twinkletune`), installable global or tool-manifest-local via `dotnet tool install`.
6. **Command-per-file, SOLID internals.** Each command is one file/class implementing a common command
   contract, registered in DI, and assembled into the root command by a composition root — so a new
   command is *added* (new file + registration) rather than editing existing commands. Handlers depend
   on injected abstractions and orchestrate services; they contain no embedded data access and no
   god-file `switch`.
7. **Same store, same config, local-only.** The CLI reads the server's configuration keys (`DataPath`,
   `ConnectionStrings:Default`, `PhotosPath`), targets the same single `.db` file + photos folder,
   makes no outbound network calls, and is never on the runtime path of solo play or the child-facing
   app.

## Options Considered

### Option 1: Dedicated System.CommandLine tool reusing the backend services (chosen)
- **Pros:** One set of data logic (the CLI reuses `AddApplicationServices`/`AddInfrastructure`);
  seeding becomes deliberate, observable, and re-runnable; a real, installable ops surface a grown-up
  can use; command-per-file keeps it extensible; matches the maintainer's explicit request and stack.
- **Cons:** A fifth project and a second composition root to keep in step with the Api; seeding is now
  a required provisioning step rather than automatic.

### Option 2: Keep implicit start-up seeding; add nothing
- **Pros:** Zero new code; the server "just works" from empty.
- **Cons:** No operations surface at all; seeding stays a hidden side effect; provisioning/reset still
  means editing code or SQL. Fails the explicit ask.

### Option 3: A thin CLI that calls the running server's HTTP API
- **Pros:** No direct database coupling in the tool; reuses the API contract.
- **Cons:** Requires the server to be running to seed it (chicken-and-egg for first provisioning);
  seeding isn't an HTTP concern; adds a network hop for a local file operation; duplicates orchestration
  the Application layer already owns.

## Consequences

### Positive
- Provisioning is explicit and idempotent: `twinkletune seed` from empty, safe to re-run, scriptable
  by exit code.
- The CLI and server share one data-logic path and one seed definition — no drift.
- The command-per-file + DI design lets future operations (e.g. `database ensure-created`, a guarded
  `reset`, `songs list`) land as new files without touching existing commands.

### Negative
- First-run is now two steps (start the server *and* run `seed`) instead of one; the run docs must say
  so, and any deploy script must invoke the tool.
- A second composition root (`Cli`) must track changes to the shared service registrations.
- This supersedes the start-up-seeding behaviour recorded in FS-L2-4; the family-server spec is updated
  to point at the CLI `seed` command.

### Risks
- If an operator forgets to seed, a fresh server serves an empty catalogue. Mitigation: the run
  documentation calls out `twinkletune seed`, and the command is idempotent so re-running is harmless.

## Implementation Notes

- Target `net10.0` consistent with the other backend projects; `PackAsTool=true`,
  `ToolCommandName=twinkletune`.
- `Program.cs` composes the Generic Host, adds the shared services, builds the System.CommandLine
  root from the DI-registered command modules, and returns the parser's exit code.
- Extract the seed catalogue (currently `Infrastructure/Persistence/SeedData.cs`) to a location the CLI
  and Infrastructure both reference, so seed content stays single-sourced.
- Handlers are resolvable from a composed service provider over a temp-file SQLite store, enabling
  unit/integration tests (seed → re-seed no-op) without spawning the installed process.

## References

- ADR-0001 (accepted) — scope and safety guardrails
- ADR-0002 (accepted) — Clean Architecture, EF Core + SQLite, no-auth LAN
- `docs/specs/command-line-interface/` — CL L1/L2 requirements realised by this decision
- `docs/specs/family-server-platform/L2.md` — FS-L2-4 (start-up seeding), superseded here
- `backend/src/TwinkleTune.Infrastructure/Persistence/SeedData.cs` — the seed catalogue to single-source
