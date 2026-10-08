import { readFileSync, writeFileSync } from "node:fs";
import { dashboardSchema, reportSchema } from "../src/models.ts";
import {
  auditMatches,
  auditUrl,
  referenceAuditSchema,
} from "../src/references.ts";
const data = dashboardSchema.parse(
  JSON.parse(readFileSync("docs/data/latest.json", "utf8")),
);
const lines = [
  "# Symbol-reference audit",
  "",
  `Measurement analyzer versions: ${[...new Set(data.results.flatMap((row) => (row.status === "ok" ? [row.fbuild] : [])))].sort().join(", ")}. Dashboard updated ${data.updated_at}.`,
  "Each profile records its measurement analyzer version and ELF digest; linked audit sidecars record the reference-analysis timestamp and tool version.",
  "Producer reference contracts report exact symbol identities, typed edges and confirmed roots. Legacy profiles use name-based references and verified ELF entry points. Unexplained retention is a review candidate, not proof of dead code.",
  "Unresolved targets may be ROM/external addresses or targets without a report identity; legacy entries are unresolved names. They are not automatically missing live symbols.",
  "",
  "Tracking: [dashboard #18](https://github.com/FastLED/dashboard/issues/18), [fbuild #1659](https://github.com/FastLED/fbuild/issues/1659), [#1660](https://github.com/FastLED/fbuild/issues/1660), [#1661](https://github.com/FastLED/fbuild/issues/1661).",
  "",
  "| Sketch | Platform | Version | Unexplained live rows | Unresolved targets / legacy names | Audit | Report |",
  "|---|---|---|---:|---:|---|---|",
];
let unexplained = 0,
  unresolved = 0,
  errors = 0,
  objectUnavailable = 0;
for (const row of data.results) {
  if (row.status !== "ok") continue;
  const audit = referenceAuditSchema.parse(
    JSON.parse(readFileSync("docs/" + auditUrl(row.bloat_report), "utf8")),
  );
  const report = reportSchema.parse(
    JSON.parse(readFileSync("docs/" + row.bloat_report, "utf8")),
  );
  if (
    !auditMatches(audit, row) ||
    (report.reference_analysis && audit.elf_verified !== true)
  )
    throw new Error(`Unverified reference audit: ${row.bloat_report}`);
  unexplained += audit.unexplained_symbols.length;
  unresolved += audit.unresolved_names.length;
  if (report.reference_analysis?.object_references.status === "unavailable")
    objectUnavailable++;
  if (
    report.reference_analysis
      ? report.reference_analysis.disassembly.status !== "analyzed" ||
        report.reference_analysis.static_data.status !== "analyzed"
      : audit.disassembly !== "analyzed"
  )
    errors++;
  lines.push(
    `| ${row.sketch} | ${row.board} | ${row.version} | ${audit.unexplained_symbols.length} | ${audit.unresolved_names.length} | [JSON](docs/${auditUrl(row.bloat_report)}) | [JSON](docs/${row.bloat_report}) |`,
  );
  if (row.version === "master")
    console.log(
      `${row.sketch}/${row.board}: ${report.symbols.filter((s) => s.size > 0).length} live rows, ${audit.unexplained_symbols.length} unexplained, ${audit.unresolved_names.length} unresolved targets / legacy names`,
    );
}
lines.splice(
  7,
  0,
  `Across ${data.results.length} profiles: ${unexplained.toLocaleString()} unexplained live-row occurrences; ${unresolved.toLocaleString()} unresolved-target / legacy-name occurrences; ${errors} profiles with unavailable/failed disassembly or static analysis; ${objectUnavailable} profiles without object cross-reference metadata.`,
  "",
);
writeFileSync("REFERENCE-AUDIT.md", lines.join("\n") + "\n");
console.log(
  `TOTAL ${unexplained} unexplained; ${unresolved} unresolved; ${errors} analysis errors`,
);
