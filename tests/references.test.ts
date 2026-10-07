import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dashboardSchema, reportSchema } from "../src/models.ts";
import {
  auditMatches,
  auditUrl,
  makeReferenceAudit,
  referenceAuditSchema,
  referenceState,
  symbolIndex,
} from "../src/references.ts";
import { elfEntry } from "../scripts/reference-analysis.ts";
const data = dashboardSchema.parse(
  JSON.parse(readFileSync("docs/data/latest.json", "utf8")),
);
const row = data.results.find((r) => r.status === "ok")!;
if (row.status !== "ok") throw new Error("Missing fixture");
const report = reportSchema.parse(
  JSON.parse(readFileSync("docs/" + row.bloat_report, "utf8")),
);
test("empty references distinguish proven entry roots, unavailable analysis and unexplained retention", () => {
  const symbol = { ...report.symbols[0], called_by: [], referenced_by: [] };
  const audit = makeReferenceAudit(
    report,
    row,
    symbol.address,
    "analyzed",
    "absent",
    [],
  );
  assert.match(referenceState(symbol, audit), /entry point/);
  assert.match(
    referenceState({ ...symbol, address: symbol.address + 2 }, audit),
    /unexplained/,
  );
  assert.match(referenceState(symbol, null), /unavailable/);
  assert.match(
    referenceState(
      { ...symbol, address: symbol.address + 2 },
      { ...audit, disassembly: "error" },
    ),
    /unavailable/,
  );
  assert.match(
    referenceState({ ...symbol, called_by: ["caller"] }, null),
    /Incoming symbol/,
  );
  assert.match(
    referenceState(
      { ...symbol, referenced_by: [{ archive: null, object: "caller.o" }] },
      null,
    ),
    /Object-file/,
  );
  assert.equal(
    auditMatches({ ...audit, elf_digest: "0".repeat(64) }, row),
    false,
  );
  assert.throws(() =>
    referenceAuditSchema.parse({ ...audit, unexpected: true }),
  );
});
test("symbol index preserves aliases and demangled-name collisions", () => {
  const a = { ...report.symbols[0], mangled: "_Zfirst", demangled: "same" };
  const b = { ...a, mangled: "_Zsecond", address: a.address + 2 };
  const index = symbolIndex({ ...report, symbols: [a, b] });
  assert.equal(index.get("same")?.length, 2);
  assert.equal(index.get("_Zfirst")?.[0], a);
  assert.equal(index.get("missing"), undefined);
});
test("ELF entry roots use the binary entry and normalize ARM Thumb bit", () => {
  const binary = Buffer.alloc(52);
  binary.set([0x7f, 0x45, 0x4c, 0x46, 1, 1]);
  binary.writeUInt16LE(40, 18);
  binary.writeUInt32LE(0x1235, 24);
  assert.equal(elfEntry(binary), 0x1234);
  binary.writeUInt16LE(94, 18);
  assert.equal(elfEntry(binary), 0x1235);
  assert.throws(() => elfEntry(Buffer.alloc(52)));
});
test("published reference audits match each measurement and its report", () => {
  for (const row of data.results) {
    if (row.status !== "ok") continue;
    const audit = referenceAuditSchema.parse(
      JSON.parse(readFileSync("docs/" + auditUrl(row.bloat_report), "utf8")),
    );
    assert.equal(auditMatches(audit, row), true);
    const report = reportSchema.parse(
      JSON.parse(readFileSync("docs/" + row.bloat_report, "utf8")),
    );
    assert.equal(
      audit.incoming_edges,
      report.symbols.reduce((n, s) => n + s.called_by.length, 0),
    );
    assert.equal(
      audit.outgoing_edges,
      report.symbols.reduce((n, s) => n + s.references_to.length, 0),
    );
  }
});
