import { referenceAuditSchema } from "../src/references.ts";
import { reportSchema } from "../src/models.ts";
import { test } from "node:test";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { preview } from "../scripts/preview.ts";
import type { MotionChart } from "../src/chart-types.ts";

declare global {
  interface Window {
    dashboardCharts: Partial<Record<"flash" | "ram", MotionChart>>;
    axisFonts: string[];
  }
}

test("smooth, evenly spaced axes and lazy platform reports", async () => {
  const server = await preview();
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({
      viewport: { width: 1440, height: 900 },
      timezoneId: "America/Los_Angeles",
    });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(server.url, { waitUntil: "networkidle" });
    await page.waitForSelector("#blink-flash canvas");
    assert.equal(await page.locator(".sketch-section").count(), 3);
    assert.equal(await page.locator("#results").count(), 0);
    await page.evaluate(async () => {
      const script = document.querySelector<HTMLScriptElement>(
        "script[type=module]",
      )!;
      const module: { charts: Window["dashboardCharts"] } = await import(
        script.src
      );
      window.dashboardCharts = module.charts;
      window.axisFonts = [];
      for (const chart of Object.values(module.charts)) {
        if (!chart) continue;
        const draw = chart.ctx.fillText.bind(chart.ctx);
        chart.ctx.fillText = (text, x, y) => {
          const t = chart.ctx.getTransform(),
            px = (t.a * x + t.c * y + t.e) / chart.currentDevicePixelRatio,
            py = (t.b * x + t.d * y + t.f) / chart.currentDevicePixelRatio;
          if (
            px < chart.chartArea.left &&
            py >= chart.chartArea.top - 1 &&
            py <= chart.chartArea.bottom + 1 &&
            chart.ctx.globalAlpha > 0.99
          )
            window.axisFonts.push(chart.ctx.font);
          draw(text, x, y);
        };
      }
    });
    for (const log of [true, false, true]) {
      await page.evaluate((log) => {
        for (const metric of ["flash", "ram"]) {
          const input = document.querySelector<HTMLInputElement>(
            `input[name="blink-${metric}-scale"][value="${log ? "logarithmic" : "linear"}"]`,
          )!;
          input.checked = true;
          input.dispatchEvent(new Event("change", { bubbles: true }));
        }
      }, log);
      await page.waitForTimeout(180);
      const first = await page.evaluate(() =>
        Object.values(window.dashboardCharts).map(
          (c) => c?.$scaleTransition?.ticks,
        ),
      );
      await page.waitForTimeout(250);
      const next = await page.evaluate(() =>
        Object.values(window.dashboardCharts).map(
          (c) => c?.$scaleTransition?.ticks,
        ),
      );
      for (let i = 0; i < first.length; i++) {
        assert.deepEqual(
          first[i]?.map((t) => t.value),
          next[i]?.map((t) => t.value),
        );
        assert.ok(
          first[i]?.some((t, j) => Math.abs(t.y - (next[i]?.[j].y ?? t.y)) > 1),
        );
      }
      await page.waitForTimeout(700);
      assert.ok(
        await page.evaluate(() =>
          Object.values(window.dashboardCharts).every(
            (c) => !c?.$scaleTransition,
          ),
        ),
      );
      if (log) {
        const positions = await page.evaluate(() =>
          Object.values(window.dashboardCharts).map((c) =>
            c?.scales.y.ticks.map((t) => c.scales.y.getPixelForValue(t.value)),
          ),
        );
        for (const ys of positions) {
          assert.ok(ys);
          const gaps = ys.slice(1).map((y, i) => y - ys[i]);
          assert.ok(Math.max(...gaps) - Math.min(...gaps) < 0.001);
        }
      }
    }
    assert.deepEqual(
      new Set(await page.evaluate(() => window.axisFonts)),
      new Set(["12px sans-serif"]),
    );
    for (const platform of ["Uno AVR", "ESP32-S3", "ESP32 Dev", "Teensy 4.1"]) {
      const location = await page.evaluate((platform) => {
        const chart = window.dashboardCharts.flash!;
        const dataset = chart.data.datasets.findIndex(
          (d) => d.label === platform,
        );
        const point = chart.getDatasetMeta(dataset).data[0];
        const rect = chart.canvas.getBoundingClientRect();
        return { x: rect.left + point.x, y: rect.top + point.y };
      }, platform);
      await page.mouse.click(location.x, location.y);
      await page.waitForSelector(".bloat-section");
      assert.equal(await page.locator("#bloat-report tbody tr").count(), 10);
      const flash = page.locator(".bloat-section").first();
      assert.equal(await page.locator(".bloat-section").count(), 1);
      assert.equal(await page.locator("#bloat-ram-symbols").count(), 0);
      await flash.getByRole("button", { name: /^Load/ }).click();
      assert.ok((await flash.locator("tbody tr").count()) <= 60);
      assert.ok((await flash.locator("tbody tr").count()) > 10);
      await page.locator("#close-modal").click();
    }
    for (const metric of ["flash", "ram"])
      await page
        .locator(`#blink-${metric}-scale label`)
        .filter({ hasText: "Linear" })
        .click();
    await page.waitForTimeout(150);
    for (const metric of ["flash", "ram"])
      await page
        .locator(`#blink-${metric}-scale label`)
        .filter({ hasText: "Logarithmic" })
        .click();
    await page.waitForTimeout(1100);
    assert.ok(
      await page.evaluate(() =>
        Object.values(window.dashboardCharts).every(
          (c) => !c?.$scaleTransition,
        ),
      ),
    );
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(200);
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    for (const checkbox of await page.locator("#blink-platforms input").all())
      await checkbox.uncheck();
    for (const metric of ["flash", "ram"])
      await page
        .locator(`#blink-${metric}-scale label`)
        .filter({ hasText: "Linear" })
        .click();
    await page.waitForTimeout(1100);
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
    await server.close();
  }
});

test("first painted scale frame preserves points and hides entering ticks", async () => {
  const server = await preview();
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.goto(server.url, { waitUntil: "networkidle" });
    await page.waitForSelector("#blink-flash canvas");
    for (const log of [true, false]) {
      const states = await page.evaluate(async (logarithmic) => {
        const script = document.querySelector<HTMLScriptElement>(
          "script[type=module]",
        )!;
        const module: { charts: Window["dashboardCharts"] } = await import(
          script.src
        );
        const traces = Object.values(module.charts).map((chart) => {
          if (!chart) throw new Error("Missing chart");
          const positions = () =>
            chart.data.datasets.map((_, index) =>
              chart
                .getDatasetMeta(index)
                .data.map((point) => (point as { y: number }).y),
            );
          const before = positions();
          const source = chart.scales.y.ticks.map((tick) => tick.value);
          const frames: {
            points: number[][];
            ticks: { value: number; opacity: number }[];
          }[] = [];
          const draw = chart.draw;
          chart.draw = () => {
            frames.push({
              points: positions(),
              ticks: (chart.$scaleTransition?.ticks ?? []).map((tick) => ({
                value: tick.value,
                opacity: tick.opacity,
              })),
            });
            draw.call(chart);
          };
          return { chart, before, source, frames, draw };
        });
        for (const metric of ["flash", "ram"]) {
          const toggle = document.querySelector<HTMLInputElement>(
            `input[name="blink-${metric}-scale"][value="${logarithmic ? "logarithmic" : "linear"}"]`,
          )!;
          toggle.checked = true;
          toggle.dispatchEvent(new Event("change", { bubbles: true }));
        }
        return traces.map(({ chart, before, source, frames, draw }) => {
          chart.draw = draw;
          return {
            before,
            source,
            target: chart.scales.y.ticks.map((tick) => tick.value),
            frames,
          };
        });
      }, log);
      for (const state of states) {
        assert.equal(
          state.frames.length,
          1,
          "destination layout must not paint before initial frame",
        );
        const first = state.frames[0];
        assert.deepEqual(
          first.points,
          state.before,
          "first frame must retain the visible point positions",
        );
        assert.deepEqual(
          new Set(first.ticks.map((tick) => tick.value)),
          new Set([...state.source, ...state.target]),
        );
        const entering = first.ticks.filter(
          (tick) => !state.source.includes(tick.value),
        );
        assert.ok(entering.length > 0);
        assert.ok(
          entering.every((tick) => tick.opacity === 0),
          "newly active labels and lines must start transparent",
        );
      }
      await page.waitForTimeout(1100);
    }
  } finally {
    await browser.close();
    await server.close();
  }
});

test("Auto hysteresis, independent controls, pins and filter persistence", async () => {
  const server = await preview(),
    browser = await chromium.launch();
  try {
    const page = await browser.newPage({
      viewport: { width: 1440, height: 900 },
    });
    await page.goto(server.url, { waitUntil: "networkidle" });
    await page.waitForSelector("#blink-flash canvas");
    await page.evaluate(async () => {
      const module: { charts: Window["dashboardCharts"] } = await import(
        document.querySelector<HTMLScriptElement>("script[type=module]")!.src
      );
      window.dashboardCharts = module.charts;
    });
    const actual = () =>
      page.evaluate(() =>
        Object.fromEntries(
          Object.entries(window.dashboardCharts).map(([name, chart]) => [
            name,
            chart?.scales.y.type,
          ]),
        ),
      );
    const move = async (metric: "flash" | "ram", fraction: number) => {
      const target = await page.evaluate(
        ({ metric, fraction }) => {
          const c = window.dashboardCharts[metric]!,
            rect = c.canvas.getBoundingClientRect(),
            a = c.chartArea;
          return {
            x: rect.left + (((a.left + a.right) / 2) * rect.width) / c.width,
            y:
              rect.top +
              ((a.top + (a.bottom - a.top) * fraction) * rect.height) /
                c.height,
          };
        },
        { metric, fraction },
      );
      await page.mouse.move(target.x, target.y);
    };
    assert.deepEqual(await actual(), { flash: "linear", ram: "linear" });
    assert.equal(await page.locator('input[value="auto"]:checked').count(), 6);
    await move("ram", 0.96);
    await page.waitForTimeout(1100);
    assert.deepEqual(await actual(), { flash: "linear", ram: "logarithmic" });
    for (const p of [0.8, 0.5, 0.1]) {
      await move("ram", p);
      assert.equal((await actual()).ram, "logarithmic");
    }
    await move("ram", 0.03);
    await page.waitForTimeout(1100);
    assert.equal((await actual()).ram, "linear");
    await page
      .locator("#blink-ram-scale label")
      .filter({ hasText: "Linear" })
      .click();
    await move("ram", 0.98);
    assert.equal((await actual()).ram, "linear");
    await page
      .locator("#blink-ram-scale label")
      .filter({ hasText: "Logarithmic" })
      .click();
    await page.waitForTimeout(1100);
    await move("ram", 0.02);
    assert.equal((await actual()).ram, "logarithmic");
    await page
      .locator("#blink-flash-scale label")
      .filter({ hasText: "Logarithmic" })
      .click();
    await page.waitForTimeout(1100);
    await page.locator("#blink-platforms input").first().uncheck();
    assert.deepEqual(await actual(), {
      flash: "logarithmic",
      ram: "logarithmic",
    });
    await page
      .locator("#blink-ram-scale label")
      .filter({ hasText: "Auto" })
      .click();
    await move("ram", 0.04);
    await page.waitForTimeout(1100);
    assert.equal((await actual()).ram, "linear");
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(200);
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
  } finally {
    await browser.close();
    await server.close();
  }
});

test("sketch sections isolate controls and keyboard reports", async () => {
  const server = await preview();
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({
      viewport: { width: 1440, height: 900 },
    });
    await page.goto(server.url, { waitUntil: "networkidle" });
    assert.equal(await page.locator("canvas").count(), 6);
    await page
      .locator('#spi-flash-scale input[value="logarithmic"]')
      .check({ force: true });
    assert.equal(
      await page.locator("#spi-flash-scale-status").textContent(),
      "Pinned · Logarithmic",
    );
    for (const id of [
      "blink-flash",
      "blink-ram",
      "spi-ram",
      "rainbow-flash",
      "rainbow-ram",
    ])
      assert.equal(
        await page.locator(`#${id}-scale-status`).textContent(),
        "Auto · Linear",
      );
    for (const [sketch, title] of [
      ["blink", "Blink"],
      ["spi", "APA102"],
      ["rainbow", "Rainbow"],
    ]) {
      const canvas = page.locator(`#${sketch}-flash-canvas`);
      await canvas.focus();
      await page.keyboard.press("ArrowRight");
      await page.keyboard.press("Enter");
      await page.waitForSelector(".bloat-section");
      assert.ok(
        (await page.locator("#bloat-title").textContent())?.startsWith(
          `${title} · Uno AVR`,
        ),
      );
      await page.locator("#close-modal").click();
    }
  } finally {
    await browser.close();
    await server.close();
  }
});

test("metric reports stay isolated and paginate in batches of 50", async () => {
  const server = await preview();
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({
      viewport: { width: 1440, height: 900 },
    });
    await page.goto(server.url, { waitUntil: "networkidle" });
    await page.locator("#blink-platforms input").first().uncheck();
    await page.locator("#blink-ram-canvas").focus();
    await page.keyboard.press("Enter");
    await page.waitForSelector("#bloat-ram-symbols");
    assert.equal(await page.locator("#bloat-flash-symbols").count(), 0);
    assert.ok(
      (await page.locator("#bloat-ram-symbols tbody tr").count()) <= 10,
    );
    assert.ok(
      !(await page.locator("#bloat-meta").textContent())?.includes("flash"),
    );
    await page.locator("#close-modal").click();
    await page.locator("#blink-flash-canvas").focus();
    await page.keyboard.press("Enter");
    await page.waitForSelector("#bloat-flash-symbols");
    assert.equal(await page.locator("#bloat-ram-symbols").count(), 0);
    const more = page.getByRole("button", { name: /^Load/ });
    const rows = page.locator("#bloat-flash-symbols tbody tr");
    const first = await rows.allTextContents();
    await page.evaluate(() => {
      const row = document.querySelector("#bloat-flash-symbols tbody tr")!;
      row.setAttribute("data-preserved", "true");
      const modal = document.querySelector<HTMLDialogElement>("#bloat-modal")!;
      modal.addEventListener(
        "click",
        () => {
          modal.dataset.beforeScroll = String(modal.scrollTop);
        },
        { capture: true },
      );
    });
    await more.click();
    assert.equal(await rows.count(), 60);
    assert.ok(
      await page.evaluate(() => {
        const modal =
          document.querySelector<HTMLDialogElement>("#bloat-modal")!;
        return (
          Math.abs(modal.scrollTop - Number(modal.dataset.beforeScroll)) < 1
        );
      }),
    );
    assert.deepEqual((await rows.allTextContents()).slice(0, 10), first);
    assert.equal(await page.locator('[data-preserved="true"]').count(), 1);
    const second = await rows.allTextContents();
    await more.click();
    assert.equal(await rows.count(), 110);
    assert.deepEqual((await rows.allTextContents()).slice(0, 60), second);
    assert.match(
      (await page.locator(".bloat-section .note").textContent()) ?? "",
      /Showing 110 of/,
    );
    assert.equal(
      await page.getByRole("button", { name: "Previous", exact: true }).count(),
      0,
    );
  } finally {
    await browser.close();
    await server.close();
  }
});

test("symbol references support hover, focus, direct links and unexplained retention", async () => {
  const server = await preview();
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({
      viewport: { width: 1440, height: 900 },
    });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(server.url, { waitUntil: "networkidle" });
    await page.locator("#blink-platforms input").first().uncheck();
    await page.mouse.move(0, 0);
    await page.locator("#blink-flash-canvas").focus();
    await page.keyboard.press("Enter");
    await page.waitForSelector(".symbol-reference");
    const symbol = page
      .locator(
        '.symbol-reference[data-reference-state="Incoming symbol references recorded"]',
      )
      .first();
    await symbol.hover();
    const popup = page.locator("#symbol-reference-popup");
    await popup.waitFor({ state: "visible" });
    assert.match(
      (await popup.textContent()) ?? "",
      /Incoming symbols|Disassembly references/,
    );
    assert.match((await popup.textContent()) ?? "", /Referencing object files/);
    assert.match((await popup.textContent()) ?? "", /Level 1 only/);
    assert.ok((await popup.locator("li").count()) > 0);
    await popup
      .getByRole("button", { name: "Close symbol references" })
      .click();
    assert.equal(await popup.isHidden(), true);
    await page.locator("#close-modal").click();
    await page.locator("#spi-platforms input").first().uncheck();
    await page.locator("#spi-platforms input").nth(1).uncheck();
    await page.locator("#spi-flash-canvas").focus();
    for (let i = 0; i < 7; i++) await page.keyboard.press("ArrowRight");
    await page.keyboard.press("Enter");
    await page.waitForSelector(".symbol-reference");
    const unexplained = page
      .locator(
        '.symbol-reference[data-reference-state*="retention unexplained"]',
      )
      .first();
    if (!(await unexplained.count()))
      await page.getByRole("button", { name: /^Load/ }).click();
    assert.ok(
      await unexplained.count(),
      "Expanded rows include unexplained retention",
    );
    await unexplained.focus();
    await popup.waitFor({ state: "visible" });
    assert.match((await popup.textContent()) ?? "", /retention unexplained/);
    assert.match(
      (await popup.textContent()) ?? "",
      /empty list does not prove/,
    );
    await page.keyboard.press("Escape");
    assert.equal(await popup.isHidden(), true);
    assert.equal(
      await page
        .locator("#bloat-modal")
        .evaluate((node) => (node as HTMLDialogElement).open),
      true,
    );
    await page.keyboard.press("Escape");
    assert.equal(
      await page
        .locator("#bloat-modal")
        .evaluate((node) => (node as HTMLDialogElement).open),
      false,
    );
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
    await server.close();
  }
});

test("typed reference popup separates vtable pointers from callers and same-name fragments", async () => {
  const server = await preview();
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({
      viewport: { width: 1440, height: 900 },
    });
    await page.route("**/data/reports/**/*.json", async (route) => {
      if (route.request().url().endsWith("-references.json")) {
        const response = await route.fetch();
        const audit = referenceAuditSchema.parse(await response.json());
        await route.fulfill({ json: { ...audit, elf_verified: true } });
        return;
      }
      const response = await route.fetch();
      const report = reportSchema.parse(await response.json());
      const first = report.symbols
        .filter((s) => s.size > 0 && s.region === "flash")
        .sort((a, b) => b.size - a.size)[0];
      first.referenced_by = [{ object: "verified-owner.o", archive: null }];
      const identity = {
        name: first.mangled,
        address: first.address,
        source: first.source,
      };
      const owner = {
        ...first,
        mangled: "_ZTVfixture",
        demangled: "vtable for fixture",
        address: first.address + 100,
        size: 76,
        called_by: [],
        referenced_by: [],
      };
      report.symbols.push(owner, {
        ...owner,
        demangled: "wrong fragment",
        source: "map",
        address: owner.address + 20,
      });
      const pass = {
        status: "analyzed" as const,
        tool: "fixture-objdump",
        reason: null,
      };
      report.reference_analysis = {
        schema: 1,
        disassembly: pass,
        static_data: pass,
        object_references: pass,
        edges: [
          {
            source: {
              name: owner.mangled,
              address: owner.address,
              source: owner.source,
            },
            target: identity,
            kind: "static_data",
            offset: 72,
          },
        ],
        roots: [{ symbol: identity, kind: "elf_entry" }],
        unexplained: [],
        unresolved: [],
        limitations: ["Indirect calls are not resolved."],
      };
      await route.fulfill({ json: report });
    });
    await page.goto(server.url, { waitUntil: "networkidle" });
    await page.locator("#blink-flash-canvas").focus();
    await page.keyboard.press("Enter");
    await page.locator(".symbol-reference").first().hover();
    const popup = page.locator("#symbol-reference-popup");
    await popup.waitFor({ state: "visible" });
    const text = (await popup.textContent()) ?? "";
    const triggerBox = await page
      .locator(".symbol-reference")
      .first()
      .boundingBox();
    const popupBox = await popup.boundingBox();
    assert.ok(triggerBox && popupBox);
    assert.ok(
      popupBox.y + popupBox.height <= triggerBox.y ||
        popupBox.y >= triggerBox.y + triggerBox.height,
      "Reference popup must not cover its trigger",
    );
    assert.match(text, /Confirmed retention root/);
    assert.match(text, /Static pointer owners · 1/);
    assert.match(text, /verified-owner.o/);
    assert.match(text, /vtable for fixture \+ 0x48/);
    assert.doesNotMatch(text, /wrong fragment/);
    assert.match(text, /Disassembly references · 0/);
    assert.match(text, /not proven runtime callers/);
    assert.match(text, /static data: analyzed/);
    await page.locator("#close-modal").click();
    await page.route("**/*-references.json", async (route) => {
      const response = await route.fetch();
      const audit = referenceAuditSchema.parse(await response.json());
      await route.fulfill({ json: { ...audit, elf_digest: "0".repeat(64) } });
    });
    await page.locator("#blink-flash-canvas").focus();
    await page.keyboard.press("Enter");
    await page.locator(".symbol-reference").first().hover();
    await popup.waitFor({ state: "visible" });
    const unverified = (await popup.textContent()) ?? "";
    assert.match(unverified, /Reference analysis unverified/);
    assert.doesNotMatch(
      unverified,
      /Confirmed retention root|static data: analyzed|vtable for fixture|verified-owner.o/,
    );
    assert.match(
      (await page.locator("#bloat-report > .note").textContent()) ?? "",
      /Reference audit provenance mismatch/,
    );
    await page.locator("#close-modal").click();
    await page.route("**/*-references.json", async (route) => {
      const response = await route.fetch();
      const audit = referenceAuditSchema.parse(await response.json());
      await route.fulfill({
        json: {
          ...audit,
          elf_verified: false,
          disassembly: "error",
          warnings: ["ELF provenance mismatch"],
        },
      });
    });
    await page.locator("#blink-flash-canvas").focus();
    await page.keyboard.press("Enter");
    await page.locator(".symbol-reference").first().hover();
    await popup.waitFor({ state: "visible" });
    assert.match(
      (await popup.textContent()) ?? "",
      /Reference analysis unverified/,
    );
    assert.doesNotMatch(
      (await popup.textContent()) ?? "",
      /Confirmed retention root|static data: analyzed|vtable for fixture|verified-owner.o/,
    );
    assert.match(
      (await page.locator("#bloat-report > .note").textContent()) ?? "",
      /Reference audit ELF verification failed/,
    );
  } finally {
    await browser.close();
    await server.close();
  }
});
