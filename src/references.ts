import * as z from "zod/mini";
import type { BloatReport, Success } from "./models.ts";
export type ReportSymbol = BloatReport["symbols"][number];
const count = z.number().check(z.int(), z.nonnegative());
export const referenceAuditSchema = z.strictObject({
  schema: z.literal(1),
  report: z.string(),
  elf_digest: z.string().check(z.regex(/^[a-f0-9]{64}$/)),
  fbuild: z.string(),
  analyzed_at: z.iso.datetime({ offset: true }),
  entry_address: z.nullable(count),
  disassembly: z.enum(["analyzed", "unavailable", "error"]),
  cross_reference_table: z.enum(["present", "absent", "unknown"]),
  incoming_edges: count,
  outgoing_edges: count,
  object_references: count,
  unexplained_symbols: z.array(z.string()),
  unresolved_names: z.array(z.string()),
  warnings: z.array(z.string()),
});
export type ReferenceAudit = z.infer<typeof referenceAuditSchema>;
export function auditUrl(report: string): string {
  return report.replace(/\.json$/, "-references.json");
}
export function symbolIndex(report: BloatReport): Map<string, ReportSymbol[]> {
  const index = new Map<string, ReportSymbol[]>();
  for (const symbol of report.symbols)
    for (const name of new Set([symbol.mangled, symbol.demangled])) {
      const matches = index.get(name) ?? [];
      matches.push(symbol);
      index.set(name, matches);
    }
  return index;
}
export function auditMatches(audit: ReferenceAudit, row: Success): boolean {
  return (
    audit.report === row.bloat_report &&
    audit.elf_digest === row.elf_digest &&
    audit.fbuild === row.fbuild
  );
}
export function referenceState(
  symbol: ReportSymbol,
  audit: ReferenceAudit | null,
): string {
  if (symbol.called_by.length) return "Incoming symbol references recorded";
  if (symbol.referenced_by.length) return "Object-file references recorded";
  if (audit?.entry_address === symbol.address)
    return "ELF entry point · retention root";
  if (!audit || audit.disassembly !== "analyzed")
    return "Symbol reference analysis unavailable";
  return "No incoming references recorded · retention unexplained";
}
export function makeReferenceAudit(
  report: BloatReport,
  row: Pick<Success, "bloat_report" | "elf_digest" | "fbuild">,
  entry: number | null,
  disassembly: ReferenceAudit["disassembly"],
  cref: ReferenceAudit["cross_reference_table"],
  warnings: string[],
): ReferenceAudit {
  const index = symbolIndex(report);
  return referenceAuditSchema.parse({
    schema: 1,
    report: row.bloat_report,
    elf_digest: row.elf_digest,
    fbuild: row.fbuild,
    analyzed_at: new Date().toISOString(),
    entry_address: entry,
    disassembly,
    cross_reference_table: cref,
    incoming_edges: report.symbols.reduce((n, s) => n + s.called_by.length, 0),
    outgoing_edges: report.symbols.reduce(
      (n, s) => n + s.references_to.length,
      0,
    ),
    object_references: report.symbols.reduce(
      (n, s) => n + s.referenced_by.length,
      0,
    ),
    unexplained_symbols: report.symbols
      .filter(
        (s) =>
          s.size > 0 &&
          !s.called_by.length &&
          !s.referenced_by.length &&
          s.address !== entry,
      )
      .map((s) => s.mangled),
    unresolved_names: [
      ...new Set(
        report.symbols
          .flatMap((s) => [...s.called_by, ...s.references_to])
          .filter((name) => !index.has(name)),
      ),
    ],
    warnings,
  });
}
