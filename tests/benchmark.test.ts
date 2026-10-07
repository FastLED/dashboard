import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { latestReleases, parseSize } from "../scripts/benchmark.ts";
import {
  dashboardSchema,
  reportSchema,
  boardSchema,
  sketchSchema,
} from "../src/models.ts";
test("latest seven stable tags sorted numerically, excluding prereleases", () => {
  assert.deepEqual(
    latestReleases([
      ...Array.from({ length: 11 }, (_, i) => `3.10.${i}`),
      "3.11.0-rc1",
    ]),
    Array.from({ length: 7 }, (_, i) => `3.10.${i + 4}`),
  );
  assert.throws(() => latestReleases(["3.10.0"]));
});
test("only exact board-aware byte summaries accepted", () => {
  assert.deepEqual(
    parseSize("done (flash: 3922 bytes, ram: 266 bytes)"),
    [3922, 266],
  );
  assert.throws(() => parseSize("Flash: 3.8 KB RAM: 0.2 KB"));
  assert.throws(() => parseSize("no ELF"));
});
test("canonical Blink contains no Serial calls", () => {
  const sketch = readFileSync("benchmark/Blink.ino", "utf8");
  assert.ok(!sketch.includes("Serial"));
  assert.ok(sketch.includes("NEOPIXEL, 3"));
});
test("all historical data and complete symbol reports satisfy strict schemas", () => {
  const data = dashboardSchema.parse(
    JSON.parse(readFileSync("docs/data/latest.json", "utf8")),
  );
  assert.ok(data.results.length >= 32);
  for (const row of data.results) {
    if (row.status === "ok") {
      const report = reportSchema.parse(
        JSON.parse(readFileSync("docs/" + row.bloat_report, "utf8")),
      );
      assert.equal(report.image_flash, row.image_flash);
      assert.equal(report.total_ram, row.attributed_ram);
    }
  }
  assert.throws(() => dashboardSchema.parse({ ...data, unexpected: 1 }));
  assert.throws(() =>
    dashboardSchema.parse({
      ...data,
      results: [{ ...data.results[0], flash: "3784" }],
    }),
  );
  assert.throws(() => dashboardSchema.parse({ ...data, schema: 1 }));
});

test("workloads stay distinct and every sketch avoids Serial", () => {
  const data = dashboardSchema.parse(
    JSON.parse(readFileSync("docs/data/latest.json", "utf8")),
  );
  const keys = data.results.map(
    (row) => `${row.sketch}/${row.board}/${row.version}`,
  );
  assert.equal(new Set(keys).size, keys.length);
  for (const sketch of sketchSchema.options)
    for (const board of boardSchema.options)
      for (const version of data.versions)
        assert.ok(
          keys.includes(`${sketch}/${board}/${version}`),
          `Missing ${sketch}/${board}/${version}`,
        );
  for (const name of ["Blink", "SPI", "Rainbow"]) {
    assert.ok(
      !readFileSync(`benchmark/${name}.ino`, "utf8").includes("Serial"),
    );
  }
  assert.ok(
    readFileSync("benchmark/SPI.ino", "utf8").includes("APA102, MOSI, SCK"),
  );
  assert.ok(
    readFileSync("benchmark/Rainbow.ino", "utf8").includes("CRGB leds[16]"),
  );
  assert.throws(() =>
    dashboardSchema.parse({
      ...data,
      results: [{ ...data.results[0], sketch: "unknown" }],
    }),
  );
});
