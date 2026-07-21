#!/usr/bin/env python3
"""Build the branded TwinkleTune engineering design handbook PDF."""

from __future__ import annotations

import argparse
import hashlib
import html
import importlib.metadata
import json
import os
import re
import shutil
import struct
import subprocess
import sys
import tempfile
from collections import Counter, defaultdict
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

try:
    import fitz  # PyMuPDF
except ImportError as exc:  # pragma: no cover - exercised by dependency check
    raise SystemExit(
        "PyMuPDF is required. Run: "
        f"{sys.executable} -m pip install -r "
        f"{Path(__file__).with_name('requirements.txt')}"
    ) from exc

try:
    from pypdf import PdfReader
    from pypdf.generic import IndirectObject
except ImportError as exc:  # pragma: no cover - exercised by dependency check
    raise SystemExit(
        "pypdf is required. Run: "
        f"{sys.executable} -m pip install -r "
        f"{Path(__file__).with_name('requirements.txt')}"
    ) from exc


TITLE = "TwinkleTune Engineering Design Handbook"
DEFAULT_OUTPUT = "TwinkleTune-Engineering-Design-Handbook.pdf"
IMAGE_RE = re.compile(r"!\[([^\]]*)\]\(([^)]+)\)")
LINK_RE = re.compile(r"(?<!!)\[([^\]]+)\]\(([^)]+)\)")
REQ_ID_RE = re.compile(r"^[A-Z]{1,4}-L2-\d+$")
AREA_MARKER_RE = re.compile(r"AREA(\d{2})")
DESIGN_MARKER_RE = re.compile(r"DESIGN(\d{2}\.\d{2})")
RAW_SIMPLE_TAG_RE = re.compile(r"^<([A-Za-z][A-Za-z0-9:_-]*)>$")
PANDOC_READER = "markdown+fenced_divs+implicit_figures+link_attributes+smart"
HTML_ELEMENTS = frozenset(
    """
    a abbr address area article aside audio b base bdi bdo blockquote body br button
    canvas caption cite code col colgroup data datalist dd del details dfn dialog div dl
    dt em embed fieldset figcaption figure footer form h1 h2 h3 h4 h5 h6 head header
    hgroup hr html i iframe img input ins kbd label legend li link main map mark math menu
    meta meter nav noscript object ol optgroup option output p picture pre progress q rp rt
    ruby s samp script search section select slot small source span strong style sub summary
    sup svg table tbody td template textarea tfoot th thead time title tr track u ul var
    video wbr
    """.split()
)
MM = 72 / 25.4


@dataclass(frozen=True)
class DomainSpec:
    slug: str
    title: str
    part: str
    summary: str
    accent: str
    wash: str
    features: tuple[str, ...]


@dataclass(frozen=True)
class Diagram:
    alt: str
    relative_target: str
    path: Path
    width: int
    height: int

    @property
    def is_wide(self) -> bool:
        return self.width >= 1000 and self.width / self.height >= 1.55

    @property
    def is_tall(self) -> bool:
        return self.height / self.width >= 1.9


@dataclass
class Design:
    domain: DomainSpec
    domain_number: int
    feature_number: int
    feature_slug: str
    title: str
    path: Path
    source_relative: str
    text: str
    diagrams: list[Diagram]

    @property
    def number(self) -> str:
        return f"{self.domain_number:02d}.{self.feature_number:02d}"

    @property
    def anchor(self) -> str:
        return f"design-{self.domain.slug}-{self.feature_slug}"


DOMAIN_SPECS: tuple[DomainSpec, ...] = (
    DomainSpec(
        "application-shell",
        "Application shell",
        "Part I · Experience foundation",
        "The installable, offline-capable frame that owns navigation, shared chrome, transitions, modals, and user feedback.",
        "#286D99",
        "#E7F5FC",
        (
            "present-shared-chrome",
            "route-between-screens",
            "transition-between-views",
            "show-modals-and-toasts",
            "cache-for-offline",
            "install-as-pwa",
        ),
    ),
    DomainSpec(
        "player-profiles",
        "Player profiles",
        "Part I · Experience foundation",
        "Per-singer identity, avatar choice, namespaced progress, device switching, server synchronization, and safe removal.",
        "#A05F83",
        "#F9EDF2",
        (
            "create-first-profile",
            "manage-avatars",
            "use-profile-photo",
            "switch-active-singer",
            "namespace-singer-state",
            "manage-server-singers",
            "remove-singer",
        ),
    ),
    DomainSpec(
        "song-library",
        "Song library",
        "Part I · Experience foundation",
        "A validated song model, offline catalogue, server-backed songbook, browsing experience, and grown-up editing surface.",
        "#347FAE",
        "#EAF6FB",
        (
            "define-song-schema",
            "validate-song",
            "bundle-offline-catalogue",
            "resolve-songbook",
            "browse-and-filter",
            "manage-songs",
        ),
    ),
    DomainSpec(
        "voice-personalization",
        "Voice personalization",
        "Part I · Experience foundation",
        "Vocal-range capture, singer-specific transposition, clear communication, persistence, recapture, and resilient fallback.",
        "#7F648D",
        "#F3EDF7",
        (
            "capture-vocal-range",
            "communicate-personalization",
            "compute-transposition",
            "persist-and-sync-range",
            "recapture-range",
            "fall-back-without-range",
        ),
    ),
    DomainSpec(
        "audio-engine",
        "Audio engine",
        "Part II · Performance runtime",
        "Web Audio synthesis, deterministic playback timing, microphone pitch detection, and a diagnostic tuner for calibration.",
        "#286D99",
        "#E5F3FA",
        (
            "play-song",
            "synchronise-playback-clock",
            "detect-pitch",
            "diagnostic-tuner",
        ),
    ),
    DomainSpec(
        "singing-gameplay",
        "Singing gameplay",
        "Part II · Performance runtime",
        "The live performance loop: microphone readiness, playback controls, karaoke timing, pitch-driven motion, scoring, and reactive scenes.",
        "#2D7B8F",
        "#E7F7F8",
        (
            "handle-mic-and-fun-mode",
            "hold-the-screen-awake",
            "control-the-performance",
            "render-playfield",
            "follow-karaoke-lyrics",
            "capture-and-score-notes",
            "move-avatar-to-pitch",
            "encourage-during-play",
            "react-scene-to-voice",
        ),
    ),
    DomainSpec(
        "scoring-and-results",
        "Scoring and results",
        "Part II · Performance runtime",
        "Note judgments become a performance summary, tricky-part insight, celebrations, coaching, badges, and family-score submission.",
        "#9A6A1D",
        "#FFF6DC",
        (
            "judge-landed-notes",
            "summarize-performance",
            "detect-tricky-part",
            "present-results-screen",
            "celebrate-with-visuals",
            "reveal-badges-and-coaching",
            "submit-family-high-score",
        ),
    ),
    DomainSpec(
        "coaching-and-encouragement",
        "Coaching and encouragement",
        "Part II · Performance runtime",
        "Positive-only feedback, the Twinkle mascot, in-song cheers, daily guidance, and focused practice that protects confidence.",
        "#A05F83",
        "#F9EDF2",
        (
            "keep-feedback-encouraging",
            "show-twinkle-mascot",
            "cheer-during-singing",
            "surface-the-daily-tip",
            "practise-a-tip",
        ),
    ),
    DomainSpec(
        "rewards-and-progression",
        "Rewards and progression",
        "Part III · Family and growth",
        "Sparkles, badges, song bests, daily goals, streaks, the star journey, and durable progress across sessions.",
        "#A77519",
        "#FFF5D8",
        (
            "record-play",
            "accumulate-sparkles",
            "award-badges",
            "keep-song-bests",
            "track-daily-goal-and-streak",
            "show-star-journey",
            "persist-rewards",
        ),
    ),
    DomainSpec(
        "family-high-scores",
        "Family high scores",
        "Part III · Family and growth",
        "Family-scoped persistence, validation, personal-best updates, deterministic ranking, submission, and per-song boards.",
        "#3C7498",
        "#EAF4FA",
        (
            "keep-scores-family-scoped",
            "validate-submission",
            "record-personal-best",
            "submit-high-score",
            "rank-family-board",
            "show-song-board",
        ),
    ),
    DomainSpec(
        "duet-multiplayer",
        "Duet multiplayer",
        "Part III · Family and growth",
        "Ephemeral two-device rooms, presence, lobby state, shared start timing, live score relay, and combined family results.",
        "#8D5D82",
        "#F5ECF3",
        (
            "create-and-join-room",
            "manage-room-presence",
            "run-duet-lobby",
            "start-song-together",
            "relay-score-ticks",
            "combine-duet-results",
        ),
    ),
    DomainSpec(
        "grown-ups-corner",
        "Grown-ups corner",
        "Part III · Family and growth",
        "A parent-gated control centre for calibration, songs, avatars, data disclosure, and destructive device reset.",
        "#486D83",
        "#EDF4F7",
        (
            "open-the-grown-ups-hub",
            "pass-the-parent-gate",
            "manage-family-songs",
            "manage-family-avatars",
            "calibrate-mic-latency",
            "disclose-data-handling",
            "reset-the-device",
        ),
    ),
    DomainSpec(
        "family-server-platform",
        "Family server platform",
        "Part IV · Platform and operations",
        "The optional home-LAN API: clean layers, EF Core and SQLite persistence, data ownership, REST health, safe exposure, resilience, and deterministic tests.",
        "#245E7C",
        "#E8F2F6",
        (
            "layer-the-backend",
            "persist-with-efcore-sqlite",
            "own-data-across-device-and-server",
            "expose-rest-and-health-surface",
            "restrict-access-to-the-home-lan",
            "degrade-gracefully-offline",
            "test-the-platform-deterministically",
        ),
    ),
)


def log(message: str) -> None:
    print(message, flush=True)


def pdf_color(value: str) -> tuple[float, float, float]:
    value = value.lstrip("#")
    if len(value) != 6:
        raise ValueError(f"Expected a six-digit hex colour, received: {value}")
    return tuple(int(value[index : index + 2], 16) / 255 for index in (0, 2, 4))


def run_checked(
    command: list[str],
    *,
    cwd: Path | None = None,
    env: dict[str, str] | None = None,
    input_text: str | None = None,
) -> subprocess.CompletedProcess[str]:
    process = subprocess.run(
        command,
        cwd=cwd,
        env=env,
        text=True,
        encoding="utf-8",
        errors="replace",
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        input=input_text,
        check=False,
    )
    if process.returncode != 0:
        raise RuntimeError(
            f"Command failed ({process.returncode}): {' '.join(command)}\n{process.stdout}"
        )
    return process


def find_repo_root(explicit: str | None) -> Path:
    if explicit:
        root = Path(explicit).expanduser().resolve()
    else:
        root = Path(__file__).resolve().parents[4]
    if not (root / "docs" / "detailed-designs").is_dir():
        raise RuntimeError(f"TwinkleTune detailed designs not found below: {root}")
    return root


def read_png_size(path: Path) -> tuple[int, int]:
    with path.open("rb") as stream:
        header = stream.read(24)
    if len(header) < 24 or header[:8] != b"\x89PNG\r\n\x1a\n":
        raise RuntimeError(f"Not a valid PNG: {path}")
    return struct.unpack(">II", header[16:24])


def clean_markdown_excerpt(lines: list[str], start: int) -> str:
    parts: list[str] = []
    for line in lines[start : min(start + 4, len(lines))]:
        stripped = line.strip()
        if not stripped:
            if parts:
                break
            continue
        parts.append(stripped.lstrip("- "))
        if len(" ".join(parts)) > 265:
            break
    text = " ".join(parts)
    text = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", text)
    text = text.replace("**", "").replace("`", "")
    text = re.sub(r"\s+", " ", text).strip()
    if len(text) > 310:
        text = text[:307].rstrip() + "…"
    return text


def extract_requirements(text: str) -> list[tuple[str, str]]:
    requirements: list[tuple[str, str]] = []
    for line in text.splitlines():
        if not line.lstrip().startswith("|"):
            continue
        cells = [cell.strip() for cell in line.strip().strip("|").split("|")]
        if len(cells) < 3:
            continue
        identifier = cells[0].strip("`")
        if REQ_ID_RE.fullmatch(identifier):
            requirements.append((identifier, cells[-1].strip()))
    return requirements


def walk_pandoc_nodes(value: object) -> Iterable[dict[str, object]]:
    if isinstance(value, dict):
        yield value
        for child in value.values():
            yield from walk_pandoc_nodes(child)
    elif isinstance(value, list):
        for child in value:
            yield from walk_pandoc_nodes(child)


def pandoc_inline_text(value: object) -> str:
    parts: list[str] = []
    for node in walk_pandoc_nodes(value):
        node_type = node.get("t")
        content = node.get("c")
        if node_type == "Str" and isinstance(content, str):
            parts.append(content)
        elif node_type in {"Space", "SoftBreak", "LineBreak"}:
            parts.append(" ")
        elif node_type == "Code" and isinstance(content, list) and len(content) > 1:
            parts.append(str(content[1]))
    return re.sub(r"\s+", " ", "".join(parts)).strip()


def parse_markdown_evidence(
    text: str, pandoc: str, source: Path
) -> tuple[list[str], list[str], list[tuple[str, str]]]:
    result = run_checked(
        [pandoc, f"--from={PANDOC_READER}", "--to=json"], input_text=text
    )
    try:
        document = json.loads(result.stdout)
    except json.JSONDecodeError as exc:
        raise RuntimeError(f"Pandoc returned invalid JSON while auditing: {source}") from exc

    placeholders: list[str] = []
    code_samples: list[str] = []
    images: list[tuple[str, str]] = []
    for node in walk_pandoc_nodes(document.get("blocks", [])):
        node_type = node.get("t")
        content = node.get("c")
        if node_type == "RawInline" and isinstance(content, list) and len(content) == 2:
            if content[0] == "html" and isinstance(content[1], str):
                match = RAW_SIMPLE_TAG_RE.fullmatch(content[1])
                if match and match.group(1).lower() not in HTML_ELEMENTS:
                    placeholders.append(content[1])
        elif node_type == "Code" and isinstance(content, list) and len(content) > 1:
            code_samples.append(str(content[1]))
        elif node_type == "CodeBlock" and isinstance(content, list) and len(content) > 1:
            code_samples.append(str(content[1]))
        elif node_type == "Image" and isinstance(content, list) and len(content) == 3:
            target = content[2]
            if isinstance(target, list) and target:
                images.append((pandoc_inline_text(content[1]), str(target[0])))
    return placeholders, code_samples, images


def build_input_fingerprint(paths: Iterable[Path], base: Path) -> str:
    digest = hashlib.sha256()
    digest.update(b"TwinkleTune build-input manifest v2\0")
    for path in sorted({item.resolve() for item in paths}, key=lambda item: str(item).lower()):
        relative = path.relative_to(base).as_posix().encode("utf-8")
        digest.update(len(relative).to_bytes(4, "big"))
        digest.update(relative)
        digest.update(path.stat().st_size.to_bytes(8, "big"))
        with path.open("rb") as stream:
            for chunk in iter(lambda: stream.read(1024 * 1024), b""):
                digest.update(chunk)
    return digest.hexdigest()


def scan_sources(source_root: Path, repo_root: Path, pandoc: str) -> dict[str, object]:
    actual_readmes = {path.resolve() for path in source_root.rglob("README.md")}
    expected_readmes = {
        (source_root / domain.slug / feature / "README.md").resolve()
        for domain in DOMAIN_SPECS
        for feature in domain.features
    }
    missing = sorted(expected_readmes - actual_readmes)
    unexpected = sorted(actual_readmes - expected_readmes)
    if missing or unexpected:
        details = ["The explicit chapter manifest does not match the source tree."]
        details.extend(f"Missing: {path}" for path in missing)
        details.extend(f"Unexpected: {path}" for path in unexpected)
        raise RuntimeError("\n".join(details))

    designs: list[Design] = []
    all_diagrams: list[Diagram] = []
    requirements: list[tuple[str, str, Design]] = []
    literal_placeholders: list[tuple[str, Design]] = []
    code_samples: list[tuple[Design, str]] = []
    watch_items: list[dict[str, object]] = []
    word_count = 0

    for domain_number, domain in enumerate(DOMAIN_SPECS, start=1):
        for feature_number, feature_slug in enumerate(domain.features, start=1):
            path = source_root / domain.slug / feature_slug / "README.md"
            text = path.read_text(encoding="utf-8")
            title_match = re.search(r"^#\s+(.+?)\s*$", text, flags=re.MULTILINE)
            if not title_match:
                raise RuntimeError(f"Missing level-one title: {path}")
            placeholders, source_code_samples, image_specs = parse_markdown_evidence(
                text, pandoc, path
            )
            diagrams: list[Diagram] = []
            for alt, target in image_specs:
                target = target.strip()
                image_path = (path.parent / target).resolve()
                if not image_path.is_file():
                    raise RuntimeError(f"Missing referenced image: {path}: {target}")
                width, height = read_png_size(image_path)
                diagram = Diagram(alt.strip(), target, image_path, width, height)
                diagrams.append(diagram)
                all_diagrams.append(diagram)
                puml = image_path.with_suffix(".puml")
                if not puml.is_file():
                    raise RuntimeError(f"PNG has no paired PlantUML source: {image_path}")
            if not diagrams:
                raise RuntimeError(f"Feature has no diagrams: {path}")

            design = Design(
                domain=domain,
                domain_number=domain_number,
                feature_number=feature_number,
                feature_slug=feature_slug,
                title=title_match.group(1).strip(),
                path=path.resolve(),
                source_relative=path.relative_to(repo_root).as_posix(),
                text=text,
                diagrams=diagrams,
            )
            designs.append(design)
            requirements.extend((identifier, wording, design) for identifier, wording in extract_requirements(text))
            literal_placeholders.extend((token, design) for token in placeholders)
            code_samples.extend((design, sample) for sample in source_code_samples)
            lines = text.splitlines()
            for line_number, line in enumerate(lines, start=1):
                if "<TO SUPPLY>" in line:
                    watch_items.append(
                        {
                            "design": design,
                            "line": line_number,
                            "excerpt": clean_markdown_excerpt(lines, line_number - 1),
                        }
                    )
            word_count += len(re.findall(r"\b[\w’'-]+\b", text, flags=re.UNICODE))

    pngs = {path.resolve() for path in source_root.rglob("*.png")}
    pumls = {path.resolve() for path in source_root.rglob("*.puml")}
    referenced = [diagram.path.resolve() for diagram in all_diagrams]
    if len(referenced) != len(set(referenced)):
        duplicate_refs = [str(path) for path, count in Counter(referenced).items() if count > 1]
        raise RuntimeError("Diagram referenced more than once:\n" + "\n".join(duplicate_refs))
    if set(referenced) != pngs:
        raise RuntimeError("Referenced diagram set does not exactly match the PNG source set")
    if len(pngs) != len(pumls):
        raise RuntimeError(f"PNG/PlantUML parity failed: {len(pngs)} PNG, {len(pumls)} PUML")

    path_to_design = {design.path.resolve(): design for design in designs}
    code_hazards: list[str] = []
    for design, sample in code_samples:
        for line in sample.splitlines():
            transformed = process_body_line(line, design, path_to_design)
            if (
                line.startswith(("## ", "### "))
                or IMAGE_RE.search(line)
                or extract_requirements(line)
                or transformed != line
            ):
                code_hazards.append(f"{design.source_relative}: {line[:180]}")
    if code_hazards:
        raise RuntimeError(
            "The line-oriented chapter assembler would alter parsed code; update it before publishing:\n"
            + "\n".join(code_hazards)
        )

    requirement_by_id: dict[str, list[tuple[str, Design]]] = defaultdict(list)
    for identifier, wording, design in requirements:
        requirement_by_id[identifier].append((wording, design))
    duplicates = {
        identifier: entries
        for identifier, entries in requirement_by_id.items()
        if len(entries) > 1
    }
    skill_root = Path(__file__).resolve().parent.parent
    skill_files = [
        path.resolve()
        for path in skill_root.rglob("*")
        if path.is_file()
        and "__pycache__" not in path.parts
        and path.suffix.lower() != ".pyc"
    ]
    brand_assets = [
        repo_root / "marketing" / "assets" / "icon.svg",
        repo_root / "marketing" / "assets" / "screenshots" / "home.png",
        repo_root / "marketing" / "assets" / "screenshots" / "results.png",
    ]
    pinned_manifests = [repo_root / "e2e" / "package.json", repo_root / "e2e" / "package-lock.json"]
    fingerprint_paths = (
        [design.path for design in designs]
        + [diagram.path for diagram in all_diagrams]
        + list(pumls)
        + skill_files
        + brand_assets
        + pinned_manifests
    )
    missing_fingerprint_inputs = [path for path in fingerprint_paths if not path.is_file()]
    if missing_fingerprint_inputs:
        raise RuntimeError(
            "Fingerprint input is missing:\n"
            + "\n".join(str(path) for path in missing_fingerprint_inputs)
        )
    fingerprint_paths = list({path.resolve() for path in fingerprint_paths})
    fingerprint = build_input_fingerprint(fingerprint_paths, repo_root)
    changed_readmes = [
        design.path
        for design in designs
        if design.path.read_text(encoding="utf-8") != design.text
    ]
    if changed_readmes or build_input_fingerprint(fingerprint_paths, repo_root) != fingerprint:
        raise RuntimeError("Build inputs changed while the source baseline was being audited")

    return {
        "designs": designs,
        "diagrams": all_diagrams,
        "requirements": requirements,
        "literal_placeholders": literal_placeholders,
        "requirement_ids": requirement_by_id,
        "duplicates": duplicates,
        "watch_items": watch_items,
        "word_count": word_count,
        "fingerprint": fingerprint,
        "fingerprinted_files": len(fingerprint_paths),
        "fingerprint_paths": fingerprint_paths,
    }


def raw_html(markup: str) -> str:
    """Keep nested HTML out of Pandoc's indented-code interpretation."""
    return "\n".join(line.lstrip() for line in markup.strip().splitlines())


def build_cover(repo_root: Path, stats: dict[str, object]) -> tuple[str, int]:
    icon = repo_root / "marketing" / "assets" / "icon.svg"
    home = repo_root / "marketing" / "assets" / "screenshots" / "home.png"
    results = repo_root / "marketing" / "assets" / "screenshots" / "results.png"
    for asset in (icon, home, results):
        if not asset.is_file():
            raise RuntimeError(f"Required brand asset not found: {asset}")
    designs = len(stats["designs"])
    requirements = len(stats["requirements"])
    diagrams = len(stats["diagrams"])
    fingerprint = str(stats["fingerprint"])
    content = f"""
<section class="cover">
  <div class="brand-lockup">
    <img src="{html.escape(icon.resolve().as_uri(), quote=True)}" alt="TwinkleTune smiling star app icon">
    <div class="brand-wordmark">TwinkleTune</div>
  </div>
  <div class="cover-layout">
    <div class="cover-copy">
      <div class="cover-kicker">Production engineering reference</div>
      <h1>Engineering<br><span>design handbook</span></h1>
      <p class="cover-subtitle">A production-reading edition of the complete detailed-design baseline—from the installable PWA and voice-aware singing loop to family data, duets, and the home-LAN platform.</p>
      <div class="cover-stats">
        <div class="cover-stat"><b>{designs}</b><span>Feature designs</span></div>
        <div class="cover-stat"><b>{requirements}</b><span>L2 requirement rows</span></div>
        <div class="cover-stat"><b>{diagrams}</b><span>Architecture figures</span></div>
      </div>
    </div>
    <div class="cover-visual" aria-label="TwinkleTune product screens">
      <div class="cover-device back"><img src="{html.escape(home.resolve().as_uri(), quote=True)}" alt="TwinkleTune home screen"></div>
      <div class="cover-device front"><img src="{html.escape(results.resolve().as_uri(), quote=True)}" alt="TwinkleTune results screen"></div>
    </div>
  </div>
  <div class="cover-edition">Detailed-design baseline · Build-input fingerprint {fingerprint[:12]}</div>
</section>
""".strip()
    return raw_html(content), 3


def build_at_a_glance(stats: dict[str, object]) -> str:
    requirement_ids = len(stats["requirement_ids"])
    words = int(stats["word_count"])
    return raw_html(f"""
<section class="front-page" id="handbook-profile">
  <div class="front-kicker">Handbook profile</div>
  <h1>Built for production reading</h1>
  <p class="front-lede">This edition preserves every detailed design, requirement row, implementation note, and figure while adding the navigation and review signals expected from a long-lived engineering reference.</p>
  <div class="metric-grid">
    <div class="metric-card"><b>{len(DOMAIN_SPECS)}</b><span>Product and platform areas</span></div>
    <div class="metric-card"><b>{len(stats['designs'])}</b><span>Feature-level designs</span></div>
    <div class="metric-card"><b>{requirement_ids}</b><span>Unique L2 identifiers</span></div>
    <div class="metric-card"><b>{words:,}</b><span>Source words retained</span></div>
  </div>
  <div class="front-columns">
    <div class="front-card accent-blue">
      <h2>What is in scope</h2>
      <ul>
        <li>The offline-first browser application and installable shell.</li>
        <li>Voice-range personalization, Web Audio playback, pitch capture, gameplay, and results.</li>
        <li>Profiles, progress, family scores, duet rooms, and grown-up controls.</li>
        <li>The optional ASP.NET Core family server, SignalR, EF Core, SQLite, and local photo storage.</li>
      </ul>
    </div>
    <div class="front-card accent-pink">
      <h2>How each design reads</h2>
      <ul>
        <li><strong>Overview</strong> establishes user value and terminology.</li>
        <li><strong>Description</strong> names shipped components, contracts, algorithms, and tests.</li>
        <li><strong>Requirements</strong> retains L2-to-L1 traceability verbatim.</li>
        <li><strong>Diagrams</strong> presents C4 context, container, component, class, and behavior views.</li>
      </ul>
    </div>
  </div>
  <div class="notice-bar"><strong>Editorial policy.</strong> Source content is not silently “fixed.” Known gaps, duplicate identifiers, and shipped-versus-required mismatches remain visible so review decisions can be made against the authored baseline.</div>
</section>
""")


def build_system_map() -> str:
    nodes = (
        ("01", "Shell and identity", "PWA, routing, active singer, songbook, offline cache"),
        ("02", "Personalized audio", "Vocal range, transposition, Web Audio clock, microphone pitch"),
        ("03", "Live performance", "Lyrics, playfield, note capture, avatar motion, encouragement"),
        ("04", "Results and growth", "Summaries, tricky parts, rewards, streaks, family boards"),
        ("05", "Optional family layer", "REST, SignalR duets, SQLite, photos, home-LAN ownership"),
    )
    node_html = "".join(
        f'<div class="flow-node"><span class="flow-index">{number}</span><b>{html.escape(title)}</b><span>{html.escape(detail)}</span></div>'
        for number, title, detail in nodes
    )
    return raw_html(f"""
<section class="front-page" id="system-in-one-view">
  <div class="front-kicker">System in one view</div>
  <h1>From a singer’s voice to a family celebration</h1>
  <p class="front-lede">The handbook follows the runtime path through five connected concerns. The browser remains the primary execution and privacy boundary; the family server is optional and narrowly scoped.</p>
  <div class="system-flow">{node_html}</div>
  <div class="front-columns">
    <div class="front-card accent-blue">
      <h2>Client runtime</h2>
      <p>The TypeScript PWA owns microphone access, audio synthesis, pitch analysis, note judgment, local rewards, offline behavior, and the kid-facing interaction model.</p>
      <p>Service-worker caching and a bundled catalogue preserve solo play when the family server is absent.</p>
    </div>
    <div class="front-card accent-gold">
      <h2>Family runtime</h2>
      <p>The home-LAN API owns shared singers, songs, photos, and high scores. SignalR adds short-lived duet rooms and live score events without introducing accounts.</p>
      <p>Domain, Application, Infrastructure, and API layers keep persistence and transport outside the core rules.</p>
    </div>
  </div>
  <div class="trust-boundary">
    <h2>Trust and data boundary</h2>
    <p>Singing audio stays on the device. Rewards remain in browser storage. Shared profiles, songs, photos, and scores stay on family-owned hardware. Only duet coordination and live score events cross the local network.</p>
  </div>
</section>
""")


def build_review_notes(stats: dict[str, object]) -> str:
    items: list[dict[str, object]] = list(stats["watch_items"])
    cards = []
    for item in items:
        design: Design = item["design"]  # type: ignore[assignment]
        cards.append(
            "".join(
                (
                    '<div class="watch-item">',
                    f"<b>{html.escape(design.title)}</b>",
                    f'<span class="watch-path">{html.escape(design.source_relative)}:{item["line"]}</span>',
                    f'<p>{html.escape(str(item["excerpt"]))}</p>',
                    "</div>",
                )
            )
        )

    duplicate_parts: list[str] = []
    duplicates: dict[str, list[tuple[str, Design]]] = stats["duplicates"]  # type: ignore[assignment]
    for identifier, entries in sorted(duplicates.items()):
        locations = "; ".join(entry_design.source_relative for _, entry_design in entries)
        duplicate_parts.append(
            f"<strong>{html.escape(identifier)}</strong> occurs {len(entries)} times with feature-specific wording ({html.escape(locations)})."
        )
    duplicate_note = " ".join(duplicate_parts) or "No duplicate L2 identifiers were found."
    return raw_html(f"""
<section class="front-page" id="production-review-notes">
  <div class="front-kicker">Production review</div>
  <h1>Open design items remain explicit</h1>
  <p class="front-lede">The source contains {len(items)} explicit <code>&lt;TO SUPPLY&gt;</code> markers. They are surfaced here as review inputs and remain in their original feature chapters.</p>
  <div class="watch-list">{''.join(cards)}</div>
  <div class="notice-bar"><strong>Traceability notice.</strong> {duplicate_note} This edition retains every authored row rather than selecting an undocumented winner.</div>
  <div class="front-columns" style="margin-top: 6mm;">
    <div class="front-card accent-blue">
      <h2>Related repository references</h2>
      <p>Several designs cite the backend architecture decision records and the deployment guide outside <code>docs/detailed-designs</code>. Their content is not duplicated here; reviewers should consult <code>docs/adr</code> and <code>docs/deployment.md</code> alongside this baseline.</p>
    </div>
    <div class="front-card accent-pink">
      <h2>Not inferred by this edition</h2>
      <p>Operational SLOs, observability, backup and recovery, release readiness, ownership, and change history are not consistently specified in the source. Their absence is not treated as evidence of a shipped design.</p>
    </div>
  </div>
</section>
""")


def marker_page(page_map: dict[str, int] | None, marker: str) -> str:
    if page_map is None:
        return "000"
    return str(page_map.get(marker, 0)).zfill(3)


def build_contents(designs: list[Design], page_map: dict[str, int] | None) -> str:
    by_domain: dict[str, list[Design]] = defaultdict(list)
    for design in designs:
        by_domain[design.domain.slug].append(design)
    groups: list[str] = []
    for domain_number, domain in enumerate(DOMAIN_SPECS, start=1):
        domain_marker = f"AREA {domain_number:02d}"
        rows = []
        for design in by_domain[domain.slug]:
            rows.append(
                f"""
<a class="toc-item" href="#{design.anchor}">
  <span class="toc-feature-no">{design.number}</span>
  <span>{html.escape(design.title)}</span>
  <span class="toc-dots"></span>
  <span class="toc-page">{marker_page(page_map, f'DESIGN {design.number}')}</span>
</a>
""".strip()
            )
        groups.append(
            f"""
<div class="toc-group" style="--toc-accent: {domain.accent}; --toc-wash: {domain.wash};">
  <a class="toc-domain" href="#area-{domain.slug}">
    <span class="toc-no">{domain_number:02d}</span>
    <span class="toc-title">{html.escape(domain.title)}</span>
    <span class="toc-page">{marker_page(page_map, domain_marker)}</span>
  </a>
  {''.join(rows)}
</div>
""".strip()
        )
    return raw_html(f"""
<section class="contents" id="contents">
  <div class="front-kicker">Navigation</div>
  <h1>Contents</h1>
  <p class="contents-lede">Page numbers are generated from the rendered layout. Every entry is also an internal PDF link; bookmarks mirror the area and feature hierarchy.</p>
  {''.join(groups)}
</section>
""")


def build_domain_opener(domain: DomainSpec, domain_number: int, designs: list[Design]) -> str:
    features = "".join(
        f'<a class="domain-feature" href="#{design.anchor}"><span>{design.number}</span><span>{html.escape(design.title)}</span></a>'
        for design in designs
    )
    return raw_html(f"""
<section class="domain-opener" style="--domain-accent: {domain.accent}; --domain-wash: {domain.wash};">
  <div class="domain-kicker">{html.escape(domain.part)} · AREA {domain_number:02d}</div>
  <div class="domain-number">{domain_number:02d}</div>
  <h1 id="area-{domain.slug}">{html.escape(domain.title)}</h1>
  <p class="domain-summary">{html.escape(domain.summary)}</p>
  <div class="domain-rule"></div>
  <div class="domain-feature-label">Designs in this area</div>
  <div class="domain-features">{features}</div>
  <div class="domain-footer-note">{len(designs)} feature designs · full requirements and architecture views</div>
</section>
""")


def rewrite_links(line: str, design: Design, path_to_design: dict[Path, Design]) -> str:
    def replace(match: re.Match[str]) -> str:
        label, raw_target = match.group(1), match.group(2).strip()
        if raw_target.startswith(("#", "http://", "https://", "mailto:")):
            return match.group(0)
        path_text, separator, fragment = raw_target.partition("#")
        target_path = (design.path.parent / path_text).resolve()
        target_design = path_to_design.get(target_path)
        if target_design:
            return f"[{label}](#{target_design.anchor})"
        if target_path.exists():
            uri = target_path.as_uri() + (f"#{fragment}" if separator else "")
            return f"[{label}]({uri})"
        return match.group(0)

    return LINK_RE.sub(replace, line)


def rewrite_image(line: str, design: Design) -> str:
    def replace(match: re.Match[str]) -> str:
        alt, target = match.group(1), match.group(2).strip()
        image_path = (design.path.parent / target).resolve()
        return f"![{alt}]({image_path.as_uri()})"

    return IMAGE_RE.sub(replace, line)


def process_body_line(
    line: str, design: Design, path_to_design: dict[Path, Design]
) -> str:
    if line.startswith("## "):
        heading = line[3:].strip()
        class_name = heading.lower().replace(" ", "-") + "-heading"
        line = f"### {heading} {{.{class_name}}}"
    elif line.startswith("### "):
        line = "#### " + line[4:]
    line = rewrite_links(line, design, path_to_design)
    line = rewrite_image(line, design)
    return line


def build_chapter(design: Design, path_to_design: dict[Path, Design]) -> str:
    lines = design.text.splitlines()
    first_title = next((index for index, line in enumerate(lines) if line.startswith("# ")), None)
    if first_title is None:
        raise RuntimeError(f"No title found while building chapter: {design.path}")
    source_lines = lines[first_title + 1 :]
    output: list[str] = []
    in_diagrams = False
    diagram_card: list[str] | None = None
    diagram_lookup = {diagram.relative_target: diagram for diagram in design.diagrams}

    def flush_card() -> None:
        nonlocal diagram_card
        if diagram_card is None:
            return
        image_target = None
        for card_line in diagram_card:
            match = IMAGE_RE.search(card_line)
            if match:
                image_target = match.group(2).strip()
                break
        if image_target is None:
            raise RuntimeError(f"Diagram subsection has no image: {design.path}")
        diagram = diagram_lookup.get(image_target)
        if diagram is None:
            raise RuntimeError(f"Diagram metadata missing for {image_target}: {design.path}")
        classes = [".diagram-card"]
        if diagram.is_wide:
            classes.append(".diagram-wide")
        if diagram.is_tall:
            classes.append(".diagram-tall")
        output.append(f"::: {{{' '.join(classes)}}}")
        output.extend(
            process_body_line(card_line, design, path_to_design) for card_line in diagram_card
        )
        output.append(":::")
        output.append("")
        diagram_card = None

    for line in source_lines:
        if line.startswith("## Diagrams"):
            flush_card()
            in_diagrams = True
            output.append(process_body_line(line, design, path_to_design))
            output.append("")
            continue
        if in_diagrams and line.startswith("### "):
            flush_card()
            diagram_card = [line]
            continue
        if in_diagrams and diagram_card is not None:
            diagram_card.append(line)
            continue
        output.append(process_body_line(line, design, path_to_design))
    flush_card()

    chapter_header = f"""
::: {{.chapter style="--chapter-accent: {design.domain.accent};"}}
<div class="chapter-eyebrow"><span>DESIGN {design.number}</span><span class="chapter-area">{html.escape(design.domain.title)}</span></div>

## {design.title} {{#{design.anchor}}}

<div class="chapter-source">Source · {html.escape(design.source_relative)}</div>
""".strip()
    return chapter_header + "\n\n" + "\n".join(output).strip() + "\n\n:::"


def build_markdown(
    repo_root: Path, stats: dict[str, object], page_map: dict[str, int] | None
) -> tuple[str, int]:
    designs: list[Design] = stats["designs"]  # type: ignore[assignment]
    path_to_design = {design.path.resolve(): design for design in designs}
    cover, cover_images = build_cover(repo_root, stats)
    chunks = [
        cover,
        build_at_a_glance(stats),
        build_system_map(),
        build_review_notes(stats),
        build_contents(designs, page_map),
    ]
    by_domain: dict[str, list[Design]] = defaultdict(list)
    for design in designs:
        by_domain[design.domain.slug].append(design)
    for domain_number, domain in enumerate(DOMAIN_SPECS, start=1):
        domain_designs = by_domain[domain.slug]
        chunks.append(build_domain_opener(domain, domain_number, domain_designs))
        chunks.extend(build_chapter(design, path_to_design) for design in domain_designs)
    return "\n\n".join(chunks) + "\n", len(stats["diagrams"]) + cover_images


def check_toolchain(repo_root: Path) -> dict[str, str]:
    if sys.version_info[:2] != (3, 11):
        raise RuntimeError(
            f"Python 3.11 is required for the validated pipeline; found {sys.version.split()[0]}"
        )
    dependency_versions = {
        "PyMuPDF": importlib.metadata.version("PyMuPDF"),
        "pypdf": importlib.metadata.version("pypdf"),
    }
    expected_dependencies = {"PyMuPDF": "1.27.1", "pypdf": "6.7.5"}
    if dependency_versions != expected_dependencies:
        raise RuntimeError(
            "Pinned Python document dependencies are required; found "
            f"{dependency_versions}, expected {expected_dependencies}"
        )
    pandoc = shutil.which("pandoc")
    node = shutil.which("node")
    if not pandoc:
        raise RuntimeError("pandoc is required and was not found on PATH (validated baseline: 3.9)")
    if not node:
        raise RuntimeError("Node.js is required and was not found on PATH")
    pandoc_version_output = run_checked([pandoc, "--version"]).stdout.splitlines()[0]
    version_match = re.search(r"(\d+)\.(\d+)", pandoc_version_output)
    if not version_match or tuple(map(int, version_match.groups())) != (3, 9):
        raise RuntimeError(f"Pandoc 3.9 is required for stable HTML output; found: {pandoc_version_output}")
    node_version = run_checked([node, "--version"]).stdout.strip()
    playwright_root = repo_root / "e2e"
    playwright_package = playwright_root / "node_modules" / "playwright" / "package.json"
    if not playwright_package.is_file():
        raise RuntimeError(
            "Pinned Playwright dependencies are missing. Run `npm ci` in the repository's e2e directory."
        )
    playwright_version = json.loads(playwright_package.read_text(encoding="utf-8"))["version"]
    if playwright_version != "1.60.0":
        raise RuntimeError(
            f"Playwright 1.60.0 is required for stable PDF output; found {playwright_version}. "
            "Run `npm ci` in e2e."
        )
    return {
        "pandoc": pandoc,
        "pandoc_version": pandoc_version_output,
        "node": node,
        "node_version": node_version,
        "playwright_version": playwright_version,
        "playwright_root": str(playwright_root),
        "python_version": sys.version.split()[0],
        "pymupdf_version": dependency_versions["PyMuPDF"],
        "pypdf_version": dependency_versions["pypdf"],
    }


def prepare_build_assets(build_dir: Path, skill_root: Path) -> None:
    assets = skill_root / "assets"
    shutil.copy2(assets / "design-book.css", build_dir / "design-book.css")
    shutil.copytree(assets / "fonts", build_dir / "fonts")


def render_html(
    markdown: str,
    build_dir: Path,
    stem: str,
    toolchain: dict[str, str],
    expected_images: int,
    renderer: Path,
) -> tuple[Path, dict[str, object]]:
    markdown_path = build_dir / f"{stem}.md"
    html_path = build_dir / f"{stem}.html"
    pdf_path = build_dir / f"{stem}.pdf"
    markdown_path.write_text(markdown, encoding="utf-8", newline="\n")
    run_checked(
        [
            toolchain["pandoc"],
            markdown_path.name,
            f"--from={PANDOC_READER}",
            "--to=html5",
            "--standalone",
            "--section-divs",
            "--wrap=none",
            "--lua-filter",
            str(renderer.with_name("publication_fidelity.lua")),
            f"--metadata=pagetitle:{TITLE}",
            "--metadata=lang:en-CA",
            "--css=design-book.css",
            f"--output={html_path.name}",
        ],
        cwd=build_dir,
    )
    result = run_checked(
        [
            toolchain["node"],
            str(renderer),
            "--input",
            str(html_path),
            "--output",
            str(pdf_path),
            "--module-root",
            toolchain["playwright_root"],
            "--expected-images",
            str(expected_images),
        ],
        cwd=build_dir,
    )
    output_lines = [line for line in result.stdout.splitlines() if line.strip()]
    if not output_lines:
        raise RuntimeError("Renderer produced no status output")
    try:
        report = json.loads(output_lines[-1])
    except json.JSONDecodeError as exc:
        raise RuntimeError(f"Renderer status was not JSON:\n{result.stdout}") from exc
    return pdf_path, report


def extract_marker_pages(pdf_path: Path) -> tuple[dict[str, int], int]:
    marker_pages: dict[str, int] = {}
    document = fitz.open(pdf_path)
    try:
        for page_index, page in enumerate(document):
            text = re.sub(r"\s+", "", page.get_text("text")).upper()
            for area in AREA_MARKER_RE.findall(text):
                marker_pages.setdefault(f"AREA {area}", page_index + 1)
            for design in DESIGN_MARKER_RE.findall(text):
                marker_pages.setdefault(f"DESIGN {design}", page_index + 1)
        return marker_pages, document.page_count
    finally:
        document.close()


def expected_markers(designs: list[Design]) -> set[str]:
    return {
        *(f"AREA {index:02d}" for index in range(1, len(DOMAIN_SPECS) + 1)),
        *(f"DESIGN {design.number}" for design in designs),
    }


def require_complete_marker_map(marker_pages: dict[str, int], designs: list[Design]) -> None:
    missing = sorted(expected_markers(designs) - set(marker_pages))
    if missing:
        raise RuntimeError("Rendered PDF is missing navigation markers:\n" + "\n".join(missing))


def current_at_page(starts: list[tuple[int, object]], page_number: int) -> object | None:
    current = None
    for start, value in starts:
        if start > page_number:
            break
        current = value
    return current


def locate_text_page(document: fitz.Document, needle: str, before_page: int) -> int:
    normalized_needle = " ".join(needle.split())
    for page_index in range(min(before_page, document.page_count)):
        normalized_text = " ".join(document[page_index].get_text("text").split())
        if normalized_needle in normalized_text:
            return page_index + 1
    raise RuntimeError(f"Could not locate front-matter heading in rendered PDF: {needle}")


def build_pdf_outline(
    document: fitz.Document,
    marker_pages: dict[str, int],
    designs: list[Design],
) -> list[list[object]]:
    first_domain_page = min(
        marker_pages[f"AREA {index:02d}"] for index in range(1, len(DOMAIN_SPECS) + 1)
    )
    outline: list[list[object]] = [[1, TITLE, 1]]
    for title in (
        "Built for production reading",
        "From a singer’s voice to a family celebration",
        "Open design items remain explicit",
        "Contents",
    ):
        outline.append([2, title, locate_text_page(document, title, first_domain_page)])
    by_domain: dict[str, list[Design]] = defaultdict(list)
    for design in designs:
        by_domain[design.domain.slug].append(design)
    for domain_index, domain in enumerate(DOMAIN_SPECS, start=1):
        outline.append([1, f"{domain_index:02d} · {domain.title}", marker_pages[f"AREA {domain_index:02d}"]])
        for design in by_domain[domain.slug]:
            outline.append([2, f"{design.number} · {design.title}", marker_pages[f"DESIGN {design.number}"]])
    return outline


def mark_new_content_as_pagination_artifact(
    document: fitz.Document,
    page: fitz.Page,
    previous_xrefs: set[int],
    subtype: str,
) -> None:
    """Exclude PyMuPDF-added running navigation from the reading order."""
    if subtype not in {"Header", "Footer"}:
        raise ValueError(f"Invalid pagination artifact subtype: {subtype}")
    new_xrefs = list(dict.fromkeys(page.get_contents()))
    new_xrefs = [xref for xref in new_xrefs if xref not in previous_xrefs]
    if not new_xrefs:
        raise RuntimeError(
            f"{subtype} running navigation created no content on page {page.number + 1}"
        )
    prefix = f"/Artifact <</Type /Pagination /Subtype /{subtype}>> BDC\n".encode("ascii")
    suffix = b"\nEMC\n"
    for xref in new_xrefs:
        stream = document.xref_stream(xref)
        stripped = stream.strip()
        if not stripped or not (stripped.startswith(b"q") and stripped.endswith(b"Q")):
            raise RuntimeError(
                f"Inserted {subtype.lower()} stream is not graphics-state balanced: {xref}"
            )
        document.update_stream(xref, prefix + stream + suffix)


def add_running_navigation(
    raw_pdf: Path,
    output: Path,
    marker_pages: dict[str, int],
    designs: list[Design],
    fingerprint: str,
) -> None:
    document = fitz.open(raw_pdf)
    try:
        _add_running_navigation_to_document(
            document, output, marker_pages, designs, fingerprint
        )
    finally:
        document.close()


def _add_running_navigation_to_document(
    document: fitz.Document,
    output: Path,
    marker_pages: dict[str, int],
    designs: list[Design],
    fingerprint: str,
) -> None:
    domain_starts: list[tuple[int, DomainSpec]] = []
    design_starts: list[tuple[int, Design]] = []
    for index, domain in enumerate(DOMAIN_SPECS, start=1):
        domain_starts.append((marker_pages[f"AREA {index:02d}"], domain))
    for design in designs:
        design_starts.append((marker_pages[f"DESIGN {design.number}"], design))
    domain_starts.sort(key=lambda item: item[0])
    design_starts.sort(key=lambda item: item[0])
    domain_pages = {start for start, _ in domain_starts}
    total_pages = document.page_count
    first_domain_page = min(domain_pages)

    for page_index, page in enumerate(document):
        page_number = page_index + 1
        if page_number == 1:
            continue
        if not page.is_wrapped:
            page.wrap_contents()
        previous_xrefs = set(page.get_contents())
        width, height = page.rect.width, page.rect.height
        inset = 17 * MM
        current_domain = current_at_page(domain_starts, page_number)
        current_design = current_at_page(design_starts, page_number)
        if page_number in domain_pages:
            domain = current_domain if isinstance(current_domain, DomainSpec) else None
            accent = pdf_color(domain.accent if domain else "#286D99")
            page.draw_line(
                fitz.Point(width - 31 * MM, height - 10 * MM),
                fitz.Point(width - 17 * MM, height - 10 * MM),
                color=accent,
                width=1.7,
                overlay=True,
            )
            page.insert_textbox(
                fitz.Rect(width - 34 * MM, height - 9 * MM, width - 17 * MM, height - 4.5 * MM),
                str(page_number),
                fontsize=6.5,
                fontname="helv",
                color=pdf_color("#52778F"),
                align=fitz.TEXT_ALIGN_RIGHT,
                overlay=True,
            )
            mark_new_content_as_pagination_artifact(
                document, page, previous_xrefs, "Footer"
            )
            continue

        top_y = 12 * MM if width < height else 10.5 * MM
        bottom_y = height - (12 * MM if width < height else 10.5 * MM)
        domain = current_domain if isinstance(current_domain, DomainSpec) else None
        accent_hex = domain.accent if domain else "#286D99"
        accent = pdf_color(accent_hex)
        line = pdf_color("#D9E8F2")
        ink_soft = pdf_color("#52778F")
        ink = pdf_color("#16354A")
        page.draw_line(
            fitz.Point(inset, top_y),
            fitz.Point(width - inset, top_y),
            color=line,
            width=0.5,
            overlay=True,
        )
        page.draw_line(
            fitz.Point(inset, top_y),
            fitz.Point(inset + 19 * MM, top_y),
            color=accent,
            width=1.5,
            overlay=True,
        )
        page.insert_text(
            fitz.Point(inset, top_y - 2.1 * MM),
            "TWINKLETUNE",
            fontsize=6.1,
            fontname="hebo",
            color=accent,
            overlay=True,
        )
        if page_number < first_domain_page:
            header_right = "ENGINEERING DESIGN HANDBOOK  /  FRONT MATTER"
        elif isinstance(current_design, Design):
            header_right = f"{current_design.domain.title.upper()}  /  {current_design.title}"
        elif domain:
            header_right = domain.title.upper()
        else:
            header_right = "ENGINEERING DESIGN HANDBOOK"
        page.insert_textbox(
            fitz.Rect(inset + 35 * MM, top_y - 4.7 * MM, width - inset, top_y - 0.3 * MM),
            header_right,
            fontsize=5.8,
            fontname="helv",
            color=ink_soft,
            align=fitz.TEXT_ALIGN_RIGHT,
            overlay=True,
        )
        mark_new_content_as_pagination_artifact(
            document, page, previous_xrefs, "Header"
        )
        if not page.is_wrapped:
            page.wrap_contents()
        footer_xrefs = set(page.get_contents())
        page.draw_line(
            fitz.Point(inset, bottom_y),
            fitz.Point(width - inset, bottom_y),
            color=line,
            width=0.45,
            overlay=True,
        )
        page.insert_text(
            fitz.Point(inset, bottom_y + 4.1 * MM),
            f"INPUT {fingerprint[:12]}",
            fontsize=5.5,
            fontname="helv",
            color=ink_soft,
            overlay=True,
        )
        page.insert_textbox(
            fitz.Rect(width - 43 * MM, bottom_y + 1.8 * MM, width - inset, bottom_y + 6.2 * MM),
            f"{page_number}  /  {total_pages}",
            fontsize=6.1,
            fontname="hebo",
            color=ink,
            align=fitz.TEXT_ALIGN_RIGHT,
            overlay=True,
        )
        mark_new_content_as_pagination_artifact(
            document, page, footer_xrefs, "Footer"
        )

    metadata = document.metadata or {}
    metadata.update(
        {
            "title": TITLE,
            "author": "TwinkleTune Engineering",
            "subject": "Production-reading edition of the TwinkleTune detailed designs",
            "keywords": "TwinkleTune, software architecture, detailed design, requirements, C4, PlantUML",
            "creator": "create-twinkletune-design-book",
            "producer": "Pandoc + Playwright Chromium + PyMuPDF",
        }
    )
    document.set_metadata(metadata)
    document.set_toc(build_pdf_outline(document, marker_pages, designs), collapse=2)
    output.parent.mkdir(parents=True, exist_ok=True)
    if output.exists():
        output.unlink()
    # Preserve Chromium's already-compressed image streams. Repacking hundreds of
    # diagrams is slow and does not materially reduce the output size.
    document.save(output, garbage=0, deflate=False)


def resolve_pdf_object(value: object) -> object:
    get_object = getattr(value, "get_object", None)
    return get_object() if callable(get_object) else value


def count_tagged_figures(value: object, visited: set[tuple[int, int]]) -> tuple[int, int]:
    """Count structure-tree figures and figures carrying alternative text."""
    if isinstance(value, IndirectObject):
        key = (value.idnum, value.generation)
        if key in visited:
            return 0, 0
        visited.add(key)
    resolved = resolve_pdf_object(value)
    if isinstance(resolved, list):
        figures = 0
        figures_with_alt = 0
        for child in resolved:
            child_figures, child_with_alt = count_tagged_figures(child, visited)
            figures += child_figures
            figures_with_alt += child_with_alt
        return figures, figures_with_alt
    if not isinstance(resolved, dict):
        return 0, 0
    figures = int(str(resolved.get("/S", "")) == "/Figure")
    figures_with_alt = int(figures == 1 and bool(str(resolved.get("/Alt", "")).strip()))
    if "/K" in resolved:
        child_figures, child_with_alt = count_tagged_figures(resolved["/K"], visited)
        figures += child_figures
        figures_with_alt += child_with_alt
    return figures, figures_with_alt


def validate_pdf(
    output: Path,
    stats: dict[str, object],
    marker_pages: dict[str, int],
    render_report: dict[str, object],
) -> dict[str, object]:
    designs: list[Design] = stats["designs"]  # type: ignore[assignment]
    diagrams: list[Diagram] = stats["diagrams"]  # type: ignore[assignment]
    document = fitz.open(output)
    try:
        if not document.is_pdf or document.needs_pass:
            raise RuntimeError("Output is not an unencrypted readable PDF")
        if document.page_count <= len(designs):
            raise RuntimeError(f"Unexpectedly short PDF: {document.page_count} pages")
        toc = document.get_toc(simple=True)
        expected_outline_entries = 1 + 4 + len(DOMAIN_SPECS) + len(designs)
        if len(toc) != expected_outline_entries:
            raise RuntimeError(
                f"PDF outline has {len(toc)} entries; expected {expected_outline_entries}"
            )
        blank_pages = []
        portrait_pages = 0
        landscape_pages = 0
        image_xrefs: set[int] = set()
        sampled_fonts: set[tuple[object, ...]] = set()
        link_count = 0
        header_artifact_pages = 0
        footer_artifact_pages = 0
        header_artifact_streams = 0
        footer_artifact_streams = 0
        input_fingerprint_footer_pages = 0
        invalid_artifact_streams: list[tuple[int, int]] = []
        invalid_input_footer_pages: list[int] = []
        domain_pages = {
            marker_pages[f"AREA {index:02d}"]
            for index in range(1, len(DOMAIN_SPECS) + 1)
        }
        header_prefix = b"/Artifact <</Type /Pagination /Subtype /Header>> BDC"
        footer_prefix = b"/Artifact <</Type /Pagination /Subtype /Footer>> BDC"
        fingerprint_prefix = str(stats["fingerprint"])[:12]
        expected_input_label = f"INPUT {fingerprint_prefix}"
        all_text_parts: list[str] = []
        for page in document:
            text = page.get_text("text")
            all_text_parts.append(text)
            images = page.get_images(full=True)
            if not text.strip() and not images:
                blank_pages.append(page.number + 1)
            if page.rect.width > page.rect.height:
                landscape_pages += 1
            else:
                portrait_pages += 1
            image_xrefs.update(image[0] for image in images)
            if page.number < 12:
                sampled_fonts.update(page.get_fonts(full=True))
            link_count += len(page.get_links())
            page_has_header = False
            page_has_footer = False
            for xref in page.get_contents():
                stream = document.xref_stream(xref).strip()
                if header_prefix in stream:
                    page_has_header = True
                    header_artifact_streams += 1
                    if not (stream.startswith(header_prefix) and stream.endswith(b"EMC")):
                        invalid_artifact_streams.append((page.number + 1, xref))
                if footer_prefix in stream:
                    page_has_footer = True
                    footer_artifact_streams += 1
                    if not (stream.startswith(footer_prefix) and stream.endswith(b"EMC")):
                        invalid_artifact_streams.append((page.number + 1, xref))
            header_artifact_pages += int(page_has_header)
            footer_artifact_pages += int(page_has_footer)
            page_number = page.number + 1
            normalized_page_text = re.sub(r"\s+", " ", text)
            has_input_label = expected_input_label in normalized_page_text
            if page_number > 1 and page_number not in domain_pages:
                if has_input_label:
                    input_fingerprint_footer_pages += 1
                else:
                    invalid_input_footer_pages.append(page_number)
            elif has_input_label:
                invalid_input_footer_pages.append(page_number)
            if page_number == 1 and (page_has_header or page_has_footer):
                invalid_artifact_streams.append((page_number, -1))
            elif page_number in domain_pages:
                if page_has_header or not page_has_footer:
                    invalid_artifact_streams.append((page_number, -1))
            elif page_number > 1 and (not page_has_header or not page_has_footer):
                invalid_artifact_streams.append((page_number, -1))
        if blank_pages:
            raise RuntimeError(f"Blank PDF pages detected: {blank_pages}")
        if portrait_pages == 0 or (any(diagram.is_wide for diagram in diagrams) and landscape_pages == 0):
            raise RuntimeError(
                f"Mixed-orientation layout failed: {portrait_pages} portrait, {landscape_pages} landscape"
            )
        if len(image_xrefs) < len(diagrams):
            raise RuntimeError(
                f"PDF contains only {len(image_xrefs)} image objects for {len(diagrams)} source diagrams"
            )
        if not any(len(font) > 2 and font[2] == "Type3" for font in sampled_fonts):
            raise RuntimeError("Chromium's embedded Type3 web-font subsets were not found in the PDF")
        all_text = "\n".join(all_text_parts)
        compact_text = re.sub(r"\s+", "", all_text).upper()
        for marker in expected_markers(designs):
            if marker.replace(" ", "") not in compact_text:
                raise RuntimeError(f"PDF text is missing marker: {marker}")
        if designs[0].title not in all_text or designs[-1].title not in all_text:
            raise RuntimeError("First or last feature title is missing from searchable PDF text")
        cover_text = re.sub(r"\s+", " ", all_text_parts[0])
        if (
            "Build-input fingerprint" not in cover_text
            or fingerprint_prefix.lower() not in cover_text.lower()
        ):
            raise RuntimeError("Cover build-input fingerprint does not match the audited inputs")
        if "TO SUPPLY" not in all_text:
            raise RuntimeError("Production review markers are missing from PDF text")
        placeholders_by_design: dict[str, Counter[str]] = defaultdict(Counter)
        for token, design in stats["literal_placeholders"]:
            placeholders_by_design[design.number][str(token)] += 1
        watch_items_by_design = Counter(
            item["design"].number for item in stats["watch_items"]
        )
        for design_index, design in enumerate(designs):
            expected_placeholders = placeholders_by_design.get(design.number)
            expected_watch_items = watch_items_by_design.get(design.number, 0)
            if not expected_placeholders and not expected_watch_items:
                continue
            start_index = marker_pages[f"DESIGN {design.number}"] - 1
            end_index = (
                marker_pages[f"DESIGN {designs[design_index + 1].number}"] - 1
                if design_index + 1 < len(designs)
                else document.page_count
            )
            chapter_text = re.sub(r"\s+", " ", "\n".join(all_text_parts[start_index:end_index]))
            for token, expected_count in (expected_placeholders or {}).items():
                normalized_token = re.sub(r"\s+", " ", token)
                actual_count = chapter_text.count(normalized_token)
                if actual_count < expected_count:
                    raise RuntimeError(
                        "PDF chapter lost literal placeholder occurrences: "
                        f"{design.number} {token} {actual_count}/{expected_count}"
                    )
            if chapter_text.count("TO SUPPLY") < expected_watch_items:
                raise RuntimeError(
                    "PDF chapter lost production-review markers: "
                    f"{design.number} {chapter_text.count('TO SUPPLY')}/{expected_watch_items}"
                )
        if link_count < len(DOMAIN_SPECS) + len(designs):
            raise RuntimeError(f"Internal PDF links are incomplete: {link_count}")
        expected_header_pages = document.page_count - 1 - len(domain_pages)
        expected_footer_pages = document.page_count - 1
        expected_input_footer_pages = expected_header_pages
        if (
            invalid_artifact_streams
            or header_artifact_pages != expected_header_pages
            or footer_artifact_pages != expected_footer_pages
            or invalid_input_footer_pages
            or input_fingerprint_footer_pages != expected_input_footer_pages
        ):
            raise RuntimeError(
                "Running-navigation artifact classification failed: "
                f"headers {header_artifact_pages}/{expected_header_pages}, "
                f"footers {footer_artifact_pages}/{expected_footer_pages}, "
                f"input labels {input_fingerprint_footer_pages}/{expected_input_footer_pages}, "
                f"invalid artifacts {invalid_artifact_streams[:8]}, "
                f"invalid input labels {invalid_input_footer_pages[:8]}"
            )
        page_count = document.page_count
        outline_count = len(toc)
    finally:
        document.close()

    expected_html_images = len(diagrams) + 3
    reader = PdfReader(str(output), strict=True)
    root = resolve_pdf_object(reader.trailer["/Root"])
    if not isinstance(root, dict):
        raise RuntimeError("PDF catalog could not be read")
    for required_key in ("/StructTreeRoot", "/Outlines", "/MarkInfo"):
        if required_key not in root:
            raise RuntimeError(f"Tagged/outlined PDF catalog entry missing: {required_key}")
    mark_info = resolve_pdf_object(root["/MarkInfo"])
    if not isinstance(mark_info, dict) or not bool(mark_info.get("/Marked")):
        raise RuntimeError("PDF is not marked as tagged")
    if str(root.get("/Lang", "")) != "en-CA":
        raise RuntimeError("PDF document language is not en-CA")
    struct_tree = resolve_pdf_object(root["/StructTreeRoot"])
    if not isinstance(struct_tree, dict) or "/K" not in struct_tree:
        raise RuntimeError("PDF structure tree has no content")
    tagged_figures, figures_with_alt = count_tagged_figures(struct_tree["/K"], set())
    expected_tagged_figures = 2 * len(diagrams) + 3
    if tagged_figures != expected_tagged_figures:
        raise RuntimeError(
            "PDF structure-tree figure count changed: "
            f"{tagged_figures}/{expected_tagged_figures}"
        )
    if figures_with_alt != tagged_figures:
        raise RuntimeError(
            "PDF figure alternative text is incomplete: "
            f"{figures_with_alt}/{tagged_figures}"
        )
    metadata = reader.metadata
    if not metadata or metadata.title != TITLE or metadata.author != "TwinkleTune Engineering":
        raise RuntimeError("PDF title/author metadata is missing or incorrect")

    if int(render_report.get("imageCount", -1)) != expected_html_images:
        raise RuntimeError("Renderer image-count evidence does not match the source inventory")
    if int(render_report.get("areas", -1)) != len(DOMAIN_SPECS):
        raise RuntimeError("Renderer area-count evidence does not match the manifest")
    if int(render_report.get("chapters", -1)) != len(designs):
        raise RuntimeError("Renderer chapter-count evidence does not match the manifest")
    if int(render_report.get("figures", -1)) != len(diagrams):
        raise RuntimeError("Renderer figure-count evidence does not match the diagram inventory")
    if int(render_report.get("labelledFigures", -1)) != len(diagrams):
        raise RuntimeError("Renderer did not label every diagram figure wrapper")
    browser_version = str(render_report.get("browserVersion", "")).strip()
    if not re.fullmatch(r"\d+(?:\.\d+){2,3}", browser_version):
        raise RuntimeError("Renderer did not report the bundled Chromium version")
    loaded_fonts = render_report.get("loadedFonts", [])
    for family in ("Baloo 2", "Manrope"):
        if not any(
            family in str(font.get("family", "")).replace('"', "")
            and font.get("status") == "loaded"
            for font in loaded_fonts
            if isinstance(font, dict)
        ):
            raise RuntimeError(f"Renderer did not prove the branded font loaded: {family}")

    return {
        "path": str(output),
        "bytes": output.stat().st_size,
        "pages": page_count,
        "portrait_pages": portrait_pages,
        "landscape_pages": landscape_pages,
        "bookmarks": outline_count,
        "links": link_count,
        "image_objects": len(image_xrefs),
        "header_artifact_pages": header_artifact_pages,
        "footer_artifact_pages": footer_artifact_pages,
        "header_artifact_streams": header_artifact_streams,
        "footer_artifact_streams": footer_artifact_streams,
        "input_fingerprint_footer_pages": input_fingerprint_footer_pages,
        "tagged_figures": tagged_figures,
        "figures_with_alt": figures_with_alt,
        "browser_version": browser_version,
        "source_designs": len(designs),
        "source_diagrams": len(diagrams),
        "source_requirements": len(stats["requirements"]),
        "source_literal_placeholders": len(stats["literal_placeholders"]),
        "source_watch_items": len(stats["watch_items"]),
        "build_input_fingerprint": str(stats["fingerprint"]),
        "fingerprinted_files": int(stats["fingerprinted_files"]),
        "markers": len(marker_pages),
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo-root", help="TwinkleTune repository root; auto-detected by default")
    parser.add_argument("--output", help=f"Output PDF path; defaults to docs/{DEFAULT_OUTPUT}")
    parser.add_argument(
        "--keep-build",
        action="store_true",
        help="Keep the intermediate Markdown, HTML, and raw PDFs beside the final PDF",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    repo_root = find_repo_root(args.repo_root)
    source_root = repo_root / "docs" / "detailed-designs"
    output = (
        Path(args.output).expanduser().resolve()
        if args.output
        else repo_root / "docs" / DEFAULT_OUTPUT
    )
    skill_root = Path(__file__).resolve().parent.parent
    renderer = Path(__file__).with_name("render_pdf.mjs")
    retained: Path | None = None
    if args.keep_build:
        retained = output.with_suffix("").with_name(output.stem + "-build")
        if retained.exists():
            raise RuntimeError(
                f"Refusing to replace an existing retained-build directory: {retained}"
            )

    log("[1/7] Checking the pinned document toolchain")
    toolchain = check_toolchain(repo_root)
    log(
        f"      Python {toolchain['python_version']} · PyMuPDF {toolchain['pymupdf_version']} · "
        f"pypdf {toolchain['pypdf_version']} · {toolchain['pandoc_version']} · "
        f"Node {toolchain['node_version']} · Playwright {toolchain['playwright_version']}"
    )

    log("[2/7] Auditing the detailed-design source baseline")
    stats = scan_sources(source_root, repo_root, toolchain["pandoc"])
    designs: list[Design] = stats["designs"]  # type: ignore[assignment]
    log(
        f"      {len(designs)} designs · {len(stats['requirements'])} requirement rows · "
        f"{len(stats['diagrams'])} diagrams · fingerprint {str(stats['fingerprint'])[:12]}"
    )

    temporary_context = tempfile.TemporaryDirectory(prefix="twinkletune-design-book-")
    build_dir = Path(temporary_context.name)
    try:
        prepare_build_assets(build_dir, skill_root)
        log("[3/7] Rendering the pagination pass")
        draft_markdown, expected_images = build_markdown(repo_root, stats, None)
        draft_pdf, draft_report = render_html(
            draft_markdown,
            build_dir,
            "pagination-pass",
            toolchain,
            expected_images,
            renderer,
        )
        page_map, draft_page_count = extract_marker_pages(draft_pdf)
        require_complete_marker_map(page_map, designs)
        log(f"      Pagination resolved across {draft_page_count} pages")

        log("[4/7] Rendering the final handbook with resolved contents pages")
        final_markdown, expected_images_again = build_markdown(repo_root, stats, page_map)
        if expected_images_again != expected_images:
            raise RuntimeError("HTML image inventory changed between pagination passes")
        raw_pdf, final_report = render_html(
            final_markdown,
            build_dir,
            "final-pass",
            toolchain,
            expected_images,
            renderer,
        )
        final_page_map, final_page_count = extract_marker_pages(raw_pdf)
        require_complete_marker_map(final_page_map, designs)
        if final_page_map != page_map:
            log("      Contents pagination shifted; running one stabilizing pass")
            stable_markdown, _ = build_markdown(repo_root, stats, final_page_map)
            raw_pdf, final_report = render_html(
                stable_markdown,
                build_dir,
                "stabilized-final-pass",
                toolchain,
                expected_images,
                renderer,
            )
            stable_page_map, final_page_count = extract_marker_pages(raw_pdf)
            require_complete_marker_map(stable_page_map, designs)
            if stable_page_map != final_page_map:
                raise RuntimeError("Contents page numbers did not stabilize after three passes")
            final_page_map = stable_page_map
        log(f"      Final content spans {final_page_count} pages")

        log("[5/7] Adding running navigation and publication metadata")
        candidate_pdf = build_dir / "validated-publication-candidate.pdf"
        add_running_navigation(
            raw_pdf,
            candidate_pdf,
            final_page_map,
            designs,
            str(stats["fingerprint"]),
        )

        log("[6/7] Validating structure, traceability, fonts, links, and figures")
        qa = validate_pdf(candidate_pdf, stats, final_page_map, final_report)
        log(
            f"      {qa['pages']} pages · {qa['bookmarks']} bookmarks · "
            f"{qa['landscape_pages']} landscape figure pages · {qa['image_objects']} image objects"
        )

        final_stats = scan_sources(source_root, repo_root, toolchain["pandoc"])
        initial_paths = {Path(path).resolve() for path in stats["fingerprint_paths"]}
        final_paths = {Path(path).resolve() for path in final_stats["fingerprint_paths"]}
        if (
            final_stats["fingerprint"] != stats["fingerprint"]
            or final_paths != initial_paths
        ):
            raise RuntimeError("Build inputs changed after rendering; the candidate was not published")

        if retained is not None:
            shutil.copytree(build_dir, retained)
            qa["build_artifacts"] = str(retained)

        output.parent.mkdir(parents=True, exist_ok=True)
        with tempfile.NamedTemporaryFile(
            prefix=f".{output.stem}-",
            suffix=".pdf",
            dir=output.parent,
            delete=False,
        ) as staged_file:
            staged_output = Path(staged_file.name)
        try:
            shutil.copy2(candidate_pdf, staged_output)
            os.replace(staged_output, output)
        finally:
            if staged_output.exists():
                staged_output.unlink()
        qa["path"] = str(output)
        qa["bytes"] = output.stat().st_size

        log("[7/7] Build complete")
        print(json.dumps(qa, indent=2), flush=True)
        return 0
    finally:
        temporary_context.cleanup()


if __name__ == "__main__":
    raise SystemExit(main())
