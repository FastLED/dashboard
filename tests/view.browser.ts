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
    await page.waitForSelector("#results tbody button");
    assert.equal(await page.locator("#results tbody tr").count(), 32);
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
      await page.locator("#log").setChecked(log);
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
      await page
        .locator("#results tbody tr")
        .filter({ hasText: platform })
        .first()
        .getByRole("button")
        .click();
      await page.waitForSelector(".bloat-section");
      assert.equal(await page.locator("#bloat-report tbody tr").count(), 10);
      const flash = page.locator(".bloat-section").first();
      await flash.getByRole("button").click();
      assert.ok((await flash.locator("tbody tr").count()) > 5);
      await flash.getByRole("button").click();
      assert.equal(await flash.locator("tbody tr").count(), 5);
      await page.keyboard.press("Escape");
    }
    await page.locator("#log").uncheck();
    await page.waitForTimeout(150);
    await page.locator("#log").check();
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
    for (const checkbox of await page.locator("#platforms input").all())
      await checkbox.uncheck();
    await page.locator("#log").uncheck();
    await page.waitForTimeout(1100);
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
    await server.close();
  }
});
