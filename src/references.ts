import * as z from "zod/mini";
import type {
  BloatReport,
  Success,
  ReferenceAnalysis,
  ReferenceIdentity,
} from "./models.ts";
export type ReportSymbol = BloatReport["symbols"][number];
const count = z.number().check(z.int(), z.nonnegative());
export const referenceAuditSchema = z.strictObject({
  schema: z.literal(1),
  report: z.string(),
  elf_digest: z.string().check(z.regex(/^[a-f0-9]{64}$/)),
  fbuild: z.string(),
  elf_verified: z.optional(z.boolean()),
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
export function sameIdentity(
  symbol: ReportSymbol,
  identity: ReferenceIdentity,
): boolean {
  return (
    symbol.mangled === identity.name &&
    symbol.address === identity.address &&
    symbol.source === identity.source
  );
}
export function identityKey(identity: ReferenceIdentity): string {
  return JSON.stringify([identity.name, identity.address, identity.source]);
}
function rowKey(symbol: ReportSymbol): string {
  return identityKey({
    name: symbol.mangled,
    address: symbol.address,
    source: symbol.source,
  });
}
export class ReferenceIndex {
  readonly symbols = new Map<string, ReportSymbol[]>();
  readonly incoming = new Map<string, ReferenceAnalysis["edges"]>();
  readonly roots = new Map<string, ReferenceAnalysis["roots"]>();
  readonly report: BloatReport;
  readonly audit: ReferenceAudit | null;
  constructor(report: BloatReport, audit: ReferenceAudit | null) {
    this.report = report;
    this.audit =
      report.reference_analysis && audit?.elf_verified !== true ? null : audit;
    for (const symbol of report.symbols) {
      const key = rowKey(symbol);
      const matches = this.symbols.get(key) ?? [];
      matches.push(symbol);
      this.symbols.set(key, matches);
    }
    if (!this.audit) return;
    for (const edge of report.reference_analysis?.edges ?? []) {
      const key = identityKey(edge.target);
      const edges = this.incoming.get(key) ?? [];
      edges.push(edge);
      this.incoming.set(key, edges);
    }
    for (const root of report.reference_analysis?.roots ?? []) {
      const key = identityKey(root.symbol);
      const roots = this.roots.get(key) ?? [];
      roots.push(root);
      this.roots.set(key, roots);
    }
  }
  state(symbol: ReportSymbol): string {
    if (this.report.reference_analysis && !this.audit)
      return "Reference analysis unverified";
    return referenceState(
      symbol,
      this.audit,
      this.report.reference_analysis,
      this,
    );
  }
}
export function incomingEdges(
  symbol: ReportSymbol,
  analysis: ReferenceAnalysis,
) {
  return analysis.edges.filter((edge) => sameIdentity(symbol, edge.target));
}
export function analysisAvailable(analysis: ReferenceAnalysis): boolean {
  return (
    analysis.disassembly.status === "analyzed" &&
    analysis.static_data.status === "analyzed"
  );
}
export function referenceState(
  symbol: ReportSymbol,
  audit: ReferenceAudit | null,
  analysis?: ReferenceAnalysis,
  index?: ReferenceIndex,
): string {
  if (analysis) {
    const roots = index
      ? (index.roots.get(rowKey(symbol)) ?? [])
      : analysis.roots.filter((root) => sameIdentity(symbol, root.symbol));
    if (roots.length)
      return `Confirmed retention root · ${roots.map((root) => root.kind).join(", ")}`;
    if (
      (index
        ? (index.incoming.get(rowKey(symbol)) ?? [])
        : incomingEdges(symbol, analysis)
      ).length
    )
      return "Incoming symbol references recorded";
    if (symbol.referenced_by.length) return "Object-file references recorded";
    if (!analysisAvailable(analysis))
      return "Symbol reference analysis unavailable or incomplete";
    return "No incoming references recorded · retention unexplained";
  }
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
  elfVerified = false,
): ReferenceAudit {
  const index = symbolIndex(report);
  return referenceAuditSchema.parse({
    schema: 1,
    report: row.bloat_report,
    elf_digest: row.elf_digest,
    fbuild: row.fbuild,
    elf_verified: elfVerified,
    analyzed_at: new Date().toISOString(),
    entry_address: entry,
    disassembly,
    cross_reference_table: cref,
    incoming_edges:
      report.reference_analysis?.edges.length ??
      report.symbols.reduce((n, s) => n + s.called_by.length, 0),
    outgoing_edges:
      report.reference_analysis?.edges.length ??
      report.symbols.reduce((n, s) => n + s.references_to.length, 0),
    object_references: report.symbols.reduce(
      (n, s) => n + s.referenced_by.length,
      0,
    ),
    unexplained_symbols:
      report.reference_analysis?.unexplained.map(
        (s) => `${s.name} @ 0x${s.address.toString(16)} (${s.source})`,
      ) ??
      report.symbols
        .filter(
          (s) =>
            s.size > 0 &&
            !s.called_by.length &&
            !s.referenced_by.length &&
            s.address !== entry,
        )
        .map((s) => s.mangled),
    unresolved_names: report.reference_analysis?.unresolved.map(
      (s) => `${s.name} @ 0x${s.address.toString(16)}`,
    ) ?? [
      ...new Set(
        report.symbols
          .flatMap((s) => [...s.called_by, ...s.references_to])
          .filter((name) => !index.has(name)),
      ),
    ],
    warnings,
  });
}
