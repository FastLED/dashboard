import { chromium } from "playwright";
import { preview } from "./preview.ts";
const server = await preview();
try {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({
      viewport: { width: 1440, height: 820 },
      deviceScaleFactor: 1,
    });
    await page.goto(server.url, { waitUntil: "networkidle" });
    await page.waitForSelector("#blink-flash canvas");
    const firstSection = await page
      .locator(".sketch-section")
      .first()
      .boundingBox();
    if (!firstSection) throw new Error("Missing overview section");
    await page.screenshot({
      path: "docs/assets/preview.png",
      fullPage: true,
      clip: {
        x: 0,
        y: 0,
        width: 1440,
        height: Math.ceil(firstSection.y + firstSection.height + 20),
      },
    });
    await page.screenshot({
      path: "docs/assets/dashboard.png",
      fullPage: true,
    });
  } finally {
    await browser.close();
  }
} finally {
  await server.close();
}
