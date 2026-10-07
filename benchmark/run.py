"""Sequential, revision-pinned Blink benchmarks; SDK caches persist across runs."""

from __future__ import annotations

import argparse
import hashlib
import io
import json
import re
import shlex
import shutil
import subprocess
import tarfile
from datetime import UTC, datetime
from importlib.metadata import version as package_version
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
VERSIONS = [f"3.10.{i}" for i in range(7)] + ["master"]
BOARDS = ["uno", "esp32s3", "esp32dev", "teensy41"]
FBUILD = package_version("fbuild")


def latest_releases(tags: list[str]) -> list[str]:
    stable = [tag for tag in tags if re.fullmatch(r"v?\d+\.\d+\.\d+", tag)]
    stable.sort(key=lambda tag: tuple(map(int, tag.removeprefix("v").split("."))))
    if len(stable) < 7:
        raise ValueError("Seven stable release tags are required")
    return stable[-7:]


def command(args: list[str], cwd: Path = ROOT, timeout: int = 1800) -> str:
    result = subprocess.run(
        args, cwd=cwd, capture_output=True, text=True, timeout=timeout, check=False
    )
    output = (result.stdout or "") + (result.stderr or "")
    if result.returncode:
        raise RuntimeError(
            f"Command failed ({result.returncode}): {args}\n{output[-8000:]}"
        )
    return output


def parse_size(output: str) -> tuple[int, int]:
    match = re.search(r"\(flash: (\d+) bytes, ram: (\d+) bytes\)", output)
    if not match:
        raise ValueError("Missing exact fbuild flash/RAM byte measurements")
    return tuple(map(int, match.groups()))


def save_json(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(".tmp")
    temporary.write_text(json.dumps(value, indent=2) + "\n")
    temporary.replace(path)


def measure(source: Path, board: str, version: str, sha: str) -> dict:
    sketch = (ROOT / "benchmark/Blink.ino").read_bytes()
    config = (ROOT / "benchmark/config" / f"{board}.ini").read_bytes()
    protocol = hashlib.sha256(
        sketch + config + FBUILD.encode() + b"stub-v1-delay0"
    ).hexdigest()
    project = ROOT / ".cache/build" / board / f"{sha}-{protocol[:12]}"
    project.mkdir(parents=True, exist_ok=True)
    lib = project / "lib/FastLED"
    if not (project / "staged.json").exists():
        archive = subprocess.run(
            ["git", "archive", sha, "src", "library.json"],
            cwd=source,
            capture_output=True,
            check=True,
        ).stdout
        extracted = project / "archive"
        extracted.mkdir(exist_ok=True)
        with tarfile.open(fileobj=io.BytesIO(archive)) as tar:
            tar.extractall(extracted, filter="data")
        shutil.copytree(extracted / "src", lib, dirs_exist_ok=True)
        shutil.copy2(extracted / "library.json", lib / "library.json")
        (project / "src/sketch").mkdir(parents=True, exist_ok=True)
        (project / "src/sketch/Blink.ino").write_bytes(sketch)
        # Equivalent weak Arduino entry point across all revisions. ::delay
        # avoids relying on fl::delay, which older releases do not provide.
        (project / "src/main.cpp").write_text(
            '#include <Arduino.h>\n#include "sketch/Blink.ino"\n'
            "void init(void) __attribute__((weak));\n"
            "__attribute__((weak)) int main() { init(); setup(); "
            "while (true) { loop(); ::delay(0); } }\n"
        )
        (project / "platformio.ini").write_bytes(config)
        save_json(project / "staged.json", {"sha": sha, "protocol": protocol})
    assert (project / "src/sketch/Blink.ino").read_bytes() == sketch
    assert (project / "platformio.ini").read_bytes() == config
    # Immutable revision/config-specific project directories prevent one
    # release's ELF or stale source files being reused as another release.
    log = command(["fbuild", str(project), "build", "-e", board])
    (project / "build.log").write_text(log)
    infos = [project / f"build_info_{board}.json", project / "build_info.json"]
    info_path = next((p for p in infos if p.exists()), None)
    if info_path:
        info = json.loads(info_path.read_text())[board]
    else:
        out = project / ".fbuild/build" / board / "release"
        entries = json.loads((out / "compile_commands.raw.json").read_text())
        entry = next(
            (e for e in entries if str(e.get("file", "")).endswith("main.cpp")),
            entries[0],
        )
        arguments = entry.get("arguments") or shlex.split(entry["command"])
        compiler = Path(arguments[0])
        prefix = re.sub(r"(?:gcc|g\+\+)$", "", compiler.name)
        if prefix == compiler.name:
            raise ValueError(f"Unsupported compiler metadata: {compiler}")
        aliases = {
            tool: str(compiler.parent / (prefix + tool))
            for tool in ("size", "nm", "objdump", "ar", "c++filt")
        }
        aliases["g++"] = str(compiler)
        info = {
            "aliases": aliases,
            "prog_path": str(out / "firmware.elf"),
            "defines": [a[2:] for a in arguments if a.startswith("-D")],
            "cxx_flags": arguments[1:],
        }
        save_json(project / "build_info.json", {board: info})
    elf = Path(info["prog_path"]).with_suffix(".elf")
    if not elf.is_absolute():
        elf = project / elf
    if not elf.exists():
        elf = project / ".fbuild/build/release/firmware.elf"
    assert elf.exists(), "Missing newly built firmware ELF"
    assert elf.read_bytes()[:4] == b"\x7fELF", (
        "Size measurement requires ELF, not HEX/BIN"
    )
    # fbuild's board-aware measurement excludes ESP32 reserved dummy sections.
    # Generic GNU size counts those as RAM and is not a board-usage metric.
    flash, ram = parse_size(log)
    report_dir = project / "symbols"
    command(["fbuild", "symbols", str(elf), "--output-dir", str(report_dir)])
    report = json.loads((report_dir / "report.json").read_text())
    report_url = f"data/reports/{board}/{sha}-{protocol[:12]}.json"
    save_json(ROOT / "docs" / report_url, report)
    serial = [
        s["demangled"]
        for s in report["symbols"]
        if s.get("size", 0)
        and (
            s["demangled"] == "Serial"
            or s["demangled"].startswith(("HardwareSerial::", "Print::println"))
        )
    ]
    source_digest = hashlib.sha256()
    for file in sorted((extracted := project / "archive/src").rglob("*")):
        if file.is_file():
            staged = lib / file.relative_to(extracted)
            assert file.read_bytes() == staged.read_bytes(), f"Stale library: {staged}"
            source_digest.update(str(file.relative_to(extracted)).encode())
            source_digest.update(file.read_bytes())
    return {
        "board": board,
        "version": version,
        "sha": sha,
        "measured_at": datetime.now(UTC).isoformat(),
        "status": "ok",
        "flash": flash,
        "ram": ram,
        "image_flash": report["image_flash"],
        "attributed_ram": report["total_ram"],
        "protocol": protocol,
        "source_digest": source_digest.hexdigest(),
        "bloat_report": report_url,
        "fbuild": FBUILD,
        "serial_symbols": serial,
        "toolchain": info["aliases"].get("g++"),
        "defines": info.get("defines"),
        "flags": info.get("cxx_flags"),
        "config": config.decode(),
        "elf_digest": hashlib.sha256(elf.read_bytes()).hexdigest(),
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", type=Path, default=ROOT / ".cache/FastLED")
    parser.add_argument("--boards", nargs="+", choices=BOARDS, default=BOARDS)
    parser.add_argument("--versions", nargs="+")
    parser.add_argument("--no-fetch", action="store_true")
    args = parser.parse_args()
    source = args.source.resolve()
    if not source.exists():
        source.parent.mkdir(parents=True, exist_ok=True)
        command(
            [
                "git",
                "clone",
                "--filter=blob:none",
                "https://github.com/FastLED/FastLED.git",
                str(source),
            ]
        )
    if not args.no_fetch:
        command(["git", "fetch", "origin", "master", "--tags"], cwd=source)
    tags = command(["git", "tag", "--list"], cwd=source).splitlines()
    horizon = latest_releases(tags) + ["master"]
    if args.versions is None:
        args.versions = horizon
    if any(v not in horizon for v in args.versions):
        parser.error(
            "Requested versions must be in the latest seven releases or master"
        )
    shas = {
        v: command(
            [
                "git",
                "rev-parse",
                "origin/master" if v == "master" else f"refs/tags/{v}^{{commit}}",
                "--",
            ],
            cwd=source,
        ).splitlines()[0]
        for v in args.versions
    }
    path = ROOT / "docs/data/latest.json"
    data = (
        json.loads(path.read_text()) if path.exists() else {"schema": 1, "results": []}
    )
    results = {
        (r["board"], r["version"]): r
        for r in data["results"]
        if r["version"] in horizon
    }
    failures = 0
    for board in args.boards:
        for version in args.versions:
            print(f"Benchmark {board} {version} {shas[version][:10]}", flush=True)
            try:
                row = measure(source, board, version, shas[version])
            except (
                RuntimeError,
                ValueError,
                AssertionError,
                OSError,
                subprocess.SubprocessError,
            ) as error:
                failures += 1
                row = {
                    "board": board,
                    "version": version,
                    "sha": shas[version],
                    "status": "error",
                    "flash": None,
                    "ram": None,
                    "measured_at": datetime.now(UTC).isoformat(),
                    "error": str(error),
                }
                print(str(error), flush=True)
            results[board, version] = row
            data.update(
                updated_at=datetime.now(UTC).isoformat(),
                versions=horizon,
                fbuild=FBUILD,
                results=list(results.values()),
            )
            save_json(path, data)
            save_json(
                ROOT / "docs/data/history" / f"{datetime.now(UTC):%Y-%m-%d}.json", data
            )
            print(
                f"  {row['status']}: flash={row['flash']} RAM={row['ram']}", flush=True
            )
    if failures:
        raise SystemExit(
            f"{failures} benchmark rows failed; errors published, never graphed as zero"
        )


if __name__ == "__main__":
    main()
