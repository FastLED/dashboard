import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import type { BloatReport, Success } from "../src/models.ts";
import { auditUrl, makeReferenceAudit } from "../src/references.ts";
export function elfEntry(binary: Buffer): number {
  if (!binary.subarray(0, 4).equals(Buffer.from([0x7f, 0x45, 0x4c, 0x46])))
    throw new Error("Reference analysis requires ELF");
  if (binary[4] !== 1 || binary[5] !== 1)
    throw new Error("Expected 32-bit little-endian benchmark ELF");
  const entry = binary.readUInt32LE(24);
  return binary.readUInt16LE(18) === 40 ? entry - (entry % 2) : entry;
}
export function writeReferenceAudit(
  root: string,
  report: BloatReport,
  row: Pick<Success, "bloat_report" | "elf_digest" | "fbuild">,
  objdump: string | undefined,
): void {
  let status: "analyzed" | "unavailable" | "error" = "unavailable";
  let entry: number | null = null;
  let elfVerified = false;
  const warnings: string[] = [];
  try {
    const binary = readFileSync(report.elf_path);
    if (createHash("sha256").update(binary).digest("hex") !== row.elf_digest)
      throw new Error("ELF provenance mismatch");
    entry = elfEntry(binary);
    elfVerified = true;
    if (report.reference_analysis) {
      status = report.reference_analysis.disassembly.status;
      for (const pass of [
        report.reference_analysis.disassembly,
        report.reference_analysis.static_data,
        report.reference_analysis.object_references,
      ])
        if (pass.reason) warnings.push(pass.reason);
    } else if (!objdump || !existsSync(objdump))
      warnings.push("Cross-toolchain objdump is unavailable.");
    else {
      const text = execFileSync(
        objdump,
        ["-d", "--no-show-raw-insn", report.elf_path],
        { encoding: "utf8", timeout: 120000, maxBuffer: 128 * 1024 * 1024 },
      );
      if (!/^[a-f0-9]+ <.+>:/m.test(text))
        throw new Error("No function headers found in disassembly");
      status = "analyzed";
      if (
        !report.symbols.some(
          (s) => s.called_by.length || s.references_to.length,
        )
      ) {
        status = "error";
        warnings.push(
          "Disassembly succeeded but fbuild recorded no symbol edges.",
        );
      }
    }
  } catch (error) {
    status = "error";
    warnings.push(error instanceof Error ? error.message : String(error));
  }
  const cref =
    report.map_path && existsSync(report.map_path)
      ? readFileSync(report.map_path, "utf8").includes("Cross Reference Table")
        ? "present"
        : "absent"
      : "unknown";
  const audit = makeReferenceAudit(
    report,
    row,
    entry,
    status,
    cref,
    warnings,
    elfVerified,
  );
  const target = join(root, "docs", auditUrl(row.bloat_report));
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, JSON.stringify(audit, null, 2) + "\n");
}
