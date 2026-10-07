import { readFileSync, writeFileSync } from "node:fs";
import { dashboardSchema, reportSchema } from "../src/models.ts";
import { auditUrl, referenceAuditSchema } from "../src/references.ts";
const data = dashboardSchema.parse(
  JSON.parse(readFileSync("docs/data/latest.json", "utf8")),
);
const lines = [
  "# Symbol-reference audit",
  "",
  "fbuild 2.5.37; saved benchmark ELFs reanalyzed with explicit cross-toolchain tools.",
  "Memory totals, symbol sizes and ELF digests were verified unchanged.",
  "Unexplained means no recorded symbol/object reference and not the ELF entry point; it is a review candidate, not proof of dead code.",
  "",
  "Tracking: [dashboard #18](https://github.com/FastLED/dashboard/issues/18), [fbuild #1659](https://github.com/FastLED/fbuild/issues/1659), [#1660](https://github.com/FastLED/fbuild/issues/1660), [#1661](https://github.com/FastLED/fbuild/issues/1661).",
  "",
  "| Sketch | Platform | Version | Unexplained live rows | Missing graph names | Audit |",
  "|---|---|---|---:|---:|---|",
];
let unexplained = 0,
  unresolved = 0,
  errors = 0;
for (const row of data.results) {
  if (row.status !== "ok") continue;
  const audit = referenceAuditSchema.parse(
    JSON.parse(readFileSync("docs/" + auditUrl(row.bloat_report), "utf8")),
  );
  const report = reportSchema.parse(
    JSON.parse(readFileSync("docs/" + row.bloat_report, "utf8")),
  );
  unexplained += audit.unexplained_symbols.length;
  unresolved += audit.unresolved_names.length;
  if (audit.disassembly !== "analyzed") errors++;
  lines.push(
    `| ${row.sketch} | ${row.board} | ${row.version} | ${audit.unexplained_symbols.length} | ${audit.unresolved_names.length} | [JSON](docs/${auditUrl(row.bloat_report)}) |`,
  );
  if (row.version === "master")
    console.log(
      `${row.sketch}/${row.board}: ${report.symbols.filter((s) => s.size > 0).length} live rows, ${audit.unexplained_symbols.length} unexplained, ${audit.unresolved_names.length} unresolved graph names`,
    );
}
lines.splice(
  6,
  0,
  `Across ${data.results.length} profiles: ${unexplained.toLocaleString()} unexplained live-row occurrences; ${unresolved.toLocaleString()} unresolved-name occurrences; ${errors} unavailable/failed analyses.`,
  "",
);
writeFileSync("REFERENCE-AUDIT.md", lines.join("\n") + "\n");
console.log(
  `TOTAL ${unexplained} unexplained; ${unresolved} unresolved; ${errors} analysis errors`,
);
