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
    await page.waitForSelector("#results tbody button");
    await page.screenshot({ path: "docs/assets/dashboard.png" });
  } finally {
    await browser.close();
  }
} finally {
  await server.close();
}
