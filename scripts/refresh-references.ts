import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { dashboardSchema, reportSchema } from "../src/models.ts";
import { writeReferenceAudit } from "./reference-analysis.ts";
const root = fileURLToPath(new URL("../", import.meta.url));
const data = dashboardSchema.parse(
  JSON.parse(readFileSync(join(root, "docs/data/latest.json"), "utf8")),
);
const toolVersion = execFileSync(
  join(root, ".venv/bin/fbuild"),
  ["--version"],
  { encoding: "utf8" },
)
  .trim()
  .replace(/^fbuild\s+/, "");
let failed = 0;
for (const row of data.results) {
  if (row.status !== "ok") continue;
  const old = reportSchema.parse(
    JSON.parse(readFileSync(join(root, "docs", row.bloat_report), "utf8")),
  );
  try {
    if (toolVersion !== row.fbuild)
      throw new Error(
        "Reference refresh must use the measurement’s fbuild version",
      );
    const binary = readFileSync(old.elf_path);
    if (createHash("sha256").update(binary).digest("hex") !== row.elf_digest)
      throw new Error("Saved ELF digest does not match published measurement");
    if (!row.toolchain) throw new Error("Missing compiler provenance");
    const prefix = basename(row.toolchain).replace(/(?:gcc|g\+\+)$/, "");
    const tool = (name: string) => join(dirname(row.toolchain!), prefix + name);
    for (const name of ["nm", "c++filt", "objdump"])
      if (!existsSync(tool(name))) throw new Error(`Missing ${name}`);
    const out = join(
      root,
      ".cache/reference-refresh",
      row.board,
      row.sketch,
      row.version,
    );
    mkdirSync(out, { recursive: true });
    execFileSync(
      join(root, ".venv/bin/fbuild"),
      [
        "symbols",
        old.elf_path,
        "--nm",
        tool("nm"),
        "--cppfilt",
        tool("c++filt"),
        "--output-dir",
        out,
        "--no-graph",
      ],
      { timeout: 180000, maxBuffer: 16 * 1024 * 1024 },
    );
    const report = reportSchema.parse(
      JSON.parse(readFileSync(join(out, "report.json"), "utf8")),
    );
    if (
      report.image_flash !== old.image_flash ||
      report.total_ram !== old.total_ram ||
      report.total_flash !== old.total_flash
    )
      throw new Error("Symbol refresh changed memory totals");
    const identity = (r: typeof report) =>
      JSON.stringify(
        r.symbols.map((s) => [s.mangled, s.address, s.size, s.region]),
      );
    if (identity(report) !== identity(old))
      throw new Error("Symbol identity/size changed");
    writeFileSync(
      join(root, "docs", row.bloat_report),
      JSON.stringify(report, null, 2) + "\n",
    );
    writeReferenceAudit(root, report, row, tool("objdump"));
    console.log(
      `${row.sketch}/${row.board}/${row.version}: ${report.symbols.filter((s) => s.called_by.length).length} symbols with incoming references`,
    );
  } catch (error) {
    failed++;
    console.error(
      `${row.sketch}/${row.board}/${row.version}: ${String(error)}`,
    );
  }
}
if (failed) throw new Error(`${failed} saved-ELF reference refreshes failed`);
