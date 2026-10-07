import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  existsSync,
  cpSync,
  readdirSync,
  statSync,
  renameSync,
} from "node:fs";
import {
  dirname,
  resolve,
  join,
  relative,
  basename,
  isAbsolute,
} from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "shell-quote";
import { z } from "zod";
import {
  boardSchema,
  sketchSchema,
  type Sketch,
  dashboardSchema,
  reportSchema,
  successSchema,
  type Board,
  type Dashboard,
  type Measurement,
  type Success,
} from "../src/models.ts";
export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const BOARDS = boardSchema.options;
export function latestReleases(tags: string[]): string[] {
  const stable = tags.filter((tag) => /^v?\d+\.\d+\.\d+$/.test(tag));
  stable.sort((a, b) => {
    const x = a.replace(/^v/, "").split(".").map(Number),
      y = b.replace(/^v/, "").split(".").map(Number);
    for (let i = 0; i < 3; i++) {
      if (x[i] !== y[i]) return x[i] - y[i];
    }
    return 0;
  });
  if (stable.length < 7)
    throw new Error("Seven stable release tags are required");
  return stable.slice(-7);
}
export function parseSize(output: string): [number, number] {
  const match = /\(flash: (\d+) bytes, ram: (\d+) bytes\)/.exec(output);
  if (!match)
    throw new Error("Missing exact fbuild flash/RAM byte measurements");
  return [Number(match[1]), Number(match[2])];
}
function command(args: string[], cwd = ROOT): string {
  try {
    return execFileSync(args[0], args.slice(1), {
      cwd,
      encoding: "utf8",
      timeout: 1800000,
      maxBuffer: 64 * 1024 * 1024,
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (error) {
    throw new Error(
      `Command failed: ${args.join(" ")}\n${error instanceof Error && "stderr" in error ? String(error.stderr).slice(-8000) : String(error).slice(-8000)}`,
      { cause: error },
    );
  }
}
function saveJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  const temp = path + ".tmp";
  writeFileSync(temp, JSON.stringify(value, null, 2) + "\n");
  renameSync(temp, path);
}
function json(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf8"));
}
function hash(...parts: (string | Buffer)[]): string {
  const digest = createHash("sha256");
  for (const part of parts) digest.update(part);
  return digest.digest("hex");
}
const infoSchema = z.object({
  prog_path: z.string(),
  aliases: z.record(z.string(), z.string()),
  defines: z.array(z.string()).optional(),
  cxx_flags: z.array(z.string()).optional(),
});
const compilationSchema = z.array(
  z.object({
    file: z.string(),
    arguments: z.array(z.string()).optional(),
    command: z.string().optional(),
  }),
);
function files(directory: string): string[] {
  return readdirSync(directory)
    .flatMap((name) => {
      const p = join(directory, name);
      return statSync(p).isDirectory() ? files(p) : [p];
    })
    .sort();
}
function measure(
  source: string,
  workload: Sketch,
  board: Board,
  version: string,
  sha: string,
  fbuild: string,
): Success {
  const sketch = readFileSync(
      join(
        ROOT,
        `benchmark/${{ blink: "Blink", spi: "SPI", rainbow: "Rainbow" }[workload]}.ino`,
      ),
    ),
    config = readFileSync(join(ROOT, `benchmark/config/${board}.ini`));
  const protocol = hash(sketch, config, fbuild, "stub-v1-delay0");
  const project = join(
      ROOT,
      ".cache/build",
      board,
      `${sha}-${protocol.slice(0, 12)}`,
    ),
    lib = join(project, "lib/FastLED");
  mkdirSync(project, { recursive: true });
  if (!existsSync(join(project, "staged.json"))) {
    const archive = execFileSync(
      "git",
      ["archive", sha, "src", "library.json"],
      { cwd: source, maxBuffer: 64 * 1024 * 1024 },
    );
    const tar = join(project, "source.tar"),
      extracted = join(project, "archive");
    mkdirSync(extracted, { recursive: true });
    writeFileSync(tar, archive);
    command(["tar", "-xf", tar, "-C", extracted]);
    cpSync(join(extracted, "src"), lib, { recursive: true });
    cpSync(join(extracted, "library.json"), join(lib, "library.json"));
    mkdirSync(join(project, "src/sketch"), { recursive: true });
    writeFileSync(join(project, "src/sketch/Blink.ino"), sketch);
    writeFileSync(
      join(project, "src/main.cpp"),
      '#include <Arduino.h>\n#include "sketch/Blink.ino"\nvoid init(void) __attribute__((weak));\n__attribute__((weak)) int main() { init(); setup(); while (true) { loop(); ::delay(0); } }\n',
    );
    writeFileSync(join(project, "platformio.ini"), config);
    saveJson(join(project, "staged.json"), { sha, protocol });
  }
  if (
    !readFileSync(join(project, "src/sketch/Blink.ino")).equals(sketch) ||
    !readFileSync(join(project, "platformio.ini")).equals(config)
  )
    throw new Error("Staged workload/config mismatch");
  const fbuildCommand = ["uv", "run", "fbuild"];
  const log = command([...fbuildCommand, project, "build", "-e", board]);
  writeFileSync(join(project, "build.log"), log);
  const infoPath = [
    join(project, `build_info_${board}.json`),
    join(project, "build_info.json"),
  ].find(existsSync);
  let info: z.infer<typeof infoSchema>;
  if (infoPath)
    info = infoSchema.parse(
      z.record(z.string(), infoSchema).parse(json(infoPath))[board],
    );
  else {
    const out = join(project, ".fbuild/build", board, "release");
    const entries = compilationSchema.parse(
      json(join(out, "compile_commands.raw.json")),
    );
    const entry =
      entries.find((e) => e.file.endsWith("main.cpp")) ?? entries[0];
    if (!entry) throw new Error("Missing compiler metadata");
    const args =
      entry.arguments ??
      parse(entry.command ?? "").map((arg) => {
        if (typeof arg !== "string")
          throw new Error("Unsupported shell expression in compiler metadata");
        return arg;
      });
    const compiler = args[0],
      prefix = basename(compiler).replace(/(?:gcc|g\+\+)$/, "");
    if (prefix === basename(compiler))
      throw new Error("Unsupported compiler metadata");
    info = {
      aliases: Object.fromEntries(
        ["size", "nm", "objdump", "ar", "c++filt"].map((tool) => [
          tool,
          join(dirname(compiler), prefix + tool),
        ]),
      ),
      prog_path: join(out, "firmware.elf"),
      defines: args.filter((a) => a.startsWith("-D")).map((a) => a.slice(2)),
      cxx_flags: args.slice(1),
    };
    info.aliases["g++"] = compiler;
    saveJson(join(project, "build_info.json"), { [board]: info });
  }
  let elf = info.prog_path.replace(/\.[^.]+$/, ".elf");
  if (!isAbsolute(elf)) elf = join(project, elf);
  if (!existsSync(elf))
    elf = join(project, ".fbuild/build/release/firmware.elf");
  const binary = readFileSync(elf);
  if (!binary.subarray(0, 4).equals(Buffer.from([0x7f, 0x45, 0x4c, 0x46])))
    throw new Error("ELF required, not HEX/BIN");
  const [flash, ram] = parseSize(log);
  const reportDir = join(project, "symbols");
  command([...fbuildCommand, "symbols", elf, "--output-dir", reportDir]);
  const report = reportSchema.parse(json(join(reportDir, "report.json")));
  const reportUrl = `data/reports/${board}/${sha}-${protocol.slice(0, 12)}.json`;
  saveJson(join(ROOT, "docs", reportUrl), report);
  const digest = createHash("sha256");
  const extracted = join(project, "archive/src");
  for (const file of files(extracted)) {
    const name = relative(extracted, file),
      content = readFileSync(file);
    if (!content.equals(readFileSync(join(lib, name))))
      throw new Error(`Stale library: ${name}`);
    digest.update(name);
    digest.update(content);
  }
  return successSchema.parse({
    sketch: workload,
    board,
    version,
    sha,
    measured_at: new Date().toISOString(),
    status: "ok",
    flash,
    ram,
    image_flash: report.image_flash,
    attributed_ram: report.total_ram,
    protocol,
    source_digest: digest.digest("hex"),
    bloat_report: reportUrl,
    fbuild,
    serial_symbols: report.symbols
      .filter(
        (s) =>
          s.size > 0 &&
          (s.demangled === "Serial" ||
            s.demangled.startsWith("HardwareSerial::") ||
            s.demangled.startsWith("Print::println")),
      )
      .map((s) => s.demangled),
    toolchain: info.aliases["g++"] ?? null,
    defines: info.defines ?? null,
    flags: info.cxx_flags ?? null,
    config: config.toString(),
    elf_digest: hash(binary),
  });
}
export function main(args = process.argv.slice(2)): void {
  let source = join(ROOT, ".cache/FastLED"),
    boards: Board[] = [...BOARDS],
    sketches: Sketch[] = [...sketchSchema.options],
    versions: string[] | undefined,
    noFetch = false;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--no-fetch") noFetch = true;
    else if (arg === "--source") source = resolve(args[++i]);
    else if (
      arg === "--boards" ||
      arg === "--versions" ||
      arg === "--sketches"
    ) {
      const values: string[] = [];
      while (args[i + 1] && !args[i + 1].startsWith("--"))
        values.push(args[++i]);
      if (!values.length) throw new Error(`Values required for ${arg}`);
      if (arg === "--boards") boards = values.map((v) => boardSchema.parse(v));
      else if (arg === "--sketches")
        sketches = values.map((v) => sketchSchema.parse(v));
      else versions = values;
    } else throw new Error(`Unknown option ${arg}`);
  }
  if (!existsSync(source)) {
    mkdirSync(dirname(source), { recursive: true });
    command([
      "git",
      "clone",
      "--filter=blob:none",
      "https://github.com/FastLED/FastLED.git",
      source,
    ]);
  }
  if (!noFetch) command(["git", "fetch", "origin", "master", "--tags"], source);
  const horizon = [
    ...latestReleases(
      command(["git", "tag", "--list"], source).trim().split("\n"),
    ),
    "master",
  ];
  versions ??= horizon;
  if (versions.some((v) => !horizon.includes(v)))
    throw new Error(
      "Requested versions must belong to latest seven releases or master",
    );
  const shas = new Map(
    versions.map((v) => [
      v,
      command(
        [
          "git",
          "rev-parse",
          v === "master" ? "origin/master" : `refs/tags/${v}^{commit}`,
          "--",
        ],
        source,
      )
        .trim()
        .split("\n")[0],
    ]),
  );
  const fbuild = command(["uv", "run", "fbuild", "--version"])
    .trim()
    .replace(/^fbuild\s+/, "");
  const path = join(ROOT, "docs/data/latest.json");
  let data: Dashboard = existsSync(path)
    ? dashboardSchema.parse(json(path))
    : {
        schema: 2,
        results: [],
        versions: horizon,
        fbuild,
        updated_at: new Date().toISOString(),
      };
  const results = new Map(
    data.results
      .filter((r) => horizon.includes(r.version))
      .map((r) => [`${r.sketch}/${r.board}/${r.version}`, r]),
  );
  let failures = 0;
  for (const workload of sketches)
    for (const board of boards)
      for (const version of versions) {
        const sha = shas.get(version)!;
        console.log(
          `Benchmark ${workload} ${board} ${version} ${sha.slice(0, 10)}`,
        );
        let row: Measurement;
        try {
          row = measure(source, workload, board, version, sha, fbuild);
        } catch (error) {
          failures++;
          row = {
            sketch: workload,
            board,
            version,
            sha,
            status: "error",
            flash: null,
            ram: null,
            measured_at: new Date().toISOString(),
            error: error instanceof Error ? error.message : String(error),
          };
          console.error(row.error);
        }
        results.set(`${workload}/${board}/${version}`, row);
        data = dashboardSchema.parse({
          ...data,
          updated_at: new Date().toISOString(),
          versions: horizon,
          fbuild,
          results: [...results.values()],
        });
        saveJson(path, data);
        saveJson(
          join(
            ROOT,
            "docs/data/history",
            new Date().toISOString().slice(0, 10) + ".json",
          ),
          data,
        );
        console.log(`  ${row.status}: flash=${row.flash} RAM=${row.ram}`);
      }
  if (failures)
    throw new Error(
      `${failures} benchmark rows failed; explicit gaps published`,
    );
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  main();
