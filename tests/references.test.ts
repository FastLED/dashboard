import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  dashboardSchema,
  reportSchema,
  referenceAnalysisSchema,
} from "../src/models.ts";
import {
  ReferenceIndex,
  identityKey,
  incomingEdges,
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
    if (report.reference_analysis) assert.equal(audit.elf_verified, true);
    assert.equal(
      audit.incoming_edges,
      report.reference_analysis?.edges.length ??
        report.symbols.reduce((n, s) => n + s.called_by.length, 0),
    );
    assert.equal(
      audit.outgoing_edges,
      report.reference_analysis?.edges.length ??
        report.symbols.reduce((n, s) => n + s.references_to.length, 0),
    );
  }
});
test("producer edges resolve exact symbol identity and distinguish static pointer owners", () => {
  const code = {
    ...report.symbols[0],
    mangled: "showPixels",
    address: 100,
    source: "nm",
    called_by: [],
    referenced_by: [],
  };
  const fragment = { ...code, address: 200, source: "map" };
  const identity = (symbol: typeof code) => ({
    name: symbol.mangled,
    address: symbol.address,
    source: symbol.source,
  });
  const pass = {
    status: "analyzed" as const,
    tool: "cross-objdump",
    reason: null,
  };
  const analysis = referenceAnalysisSchema.parse({
    schema: 1,
    disassembly: pass,
    static_data: pass,
    object_references: pass,
    edges: [
      {
        source: { name: "_ZTVcontroller", address: 300, source: "nm" },
        target: identity(code),
        kind: "static_data",
        offset: 72,
      },
    ],
    roots: [{ symbol: identity(fragment), kind: "elf_entry" }],
    unexplained: [],
    unresolved: [],
    limitations: ["Indirect calls are not resolved."],
  });
  assert.equal(incomingEdges(code, analysis)[0].kind, "static_data");
  assert.equal(incomingEdges(code, analysis)[0].offset, 72);
  assert.equal(incomingEdges(fragment, analysis).length, 0);
  assert.match(referenceState(code, null, analysis), /Incoming symbol/);
  assert.match(
    referenceState(fragment, null, analysis),
    /Confirmed retention root/,
  );
  assert.match(
    referenceState({ ...fragment, address: 201 }, null, analysis),
    /unexplained/,
  );
  assert.match(
    referenceState({ ...fragment, address: 201 }, null, {
      ...analysis,
      static_data: { ...pass, status: "error", reason: "bad ELF" },
    }),
    /incomplete/,
  );
  assert.throws(() =>
    referenceAnalysisSchema.parse({ ...analysis, extra: true }),
  );
  assert.throws(() =>
    referenceAnalysisSchema.parse({
      ...analysis,
      edges: [
        { ...analysis.edges[0], target: { ...identity(code), extra: true } },
      ],
    }),
  );
  assert.doesNotThrow(() =>
    reportSchema.parse({ ...report, reference_analysis: analysis }),
  );
  assert.doesNotThrow(() => reportSchema.parse(report));
  const typedReport = {
    ...report,
    reference_analysis: analysis,
    symbols: [code, fragment],
  };
  const producerAudit = makeReferenceAudit(
    {
      ...typedReport,
      reference_analysis: {
        ...analysis,
        unexplained: [identity(fragment)],
        unresolved: [{ name: "ROM", address: 4096 }],
      },
    },
    row,
    null,
    "analyzed",
    "absent",
    [],
  );
  assert.equal(producerAudit.incoming_edges, analysis.edges.length);
  assert.equal(producerAudit.outgoing_edges, analysis.edges.length);
  assert.deepEqual(producerAudit.unexplained_symbols, [
    "showPixels @ 0xc8 (map)",
  ]);
  assert.deepEqual(producerAudit.unresolved_names, ["ROM @ 0x1000"]);
  const unverified = new ReferenceIndex(typedReport, null);
  assert.equal(unverified.state(fragment), "Reference analysis unverified");
  assert.equal(unverified.incoming.size, 0);
  const verified = new ReferenceIndex(
    typedReport,
    makeReferenceAudit(typedReport, row, null, "analyzed", "absent", [], true),
  );
  assert.equal(verified.incoming.get(identityKey(identity(code)))?.length, 1);
  assert.match(verified.state(fragment), /Confirmed retention root/);
  for (const elfVerified of [false, undefined]) {
    const failedAudit = {
      ...producerAudit,
      elf_verified: elfVerified,
      disassembly: "error" as const,
      warnings: ["ELF provenance mismatch"],
    };
    assert.equal(auditMatches(failedAudit, row), true);
    const failed = new ReferenceIndex(typedReport, failedAudit);
    assert.equal(failed.state(fragment), "Reference analysis unverified");
    assert.equal(failed.incoming.size, 0);
    assert.equal(failed.roots.size, 0);
  }
});
