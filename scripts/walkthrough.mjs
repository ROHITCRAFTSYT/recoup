import { chromium } from "playwright";
import fs from "fs";
const BASE = "http://localhost:3000";
fs.mkdirSync("docs/assets/video", { recursive: true });
const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1280, height: 800 },
  deviceScaleFactor: 1,
  recordVideo: { dir: "docs/assets/video", size: { width: 1280, height: 800 } },
});
const page = await ctx.newPage();
const pause = (ms) => page.waitForTimeout(ms);
await page.goto(`${BASE}/login`, { waitUntil: "networkidle" }); await pause(2800);
await page.click("button[type=submit]"); await page.waitForLoadState("networkidle"); await pause(3000);
await page.goto(`${BASE}/board`, { waitUntil: "networkidle" }); await pause(2600);
await page.goto(`${BASE}/authorizations`, { waitUntil: "networkidle" }); await pause(3400);
await page.goto(`${BASE}/analytics`, { waitUntil: "networkidle" }); await pause(2400);
await page.goto(`${BASE}/integrations`, { waitUntil: "networkidle" }); await pause(3400);
await ctx.close();
await browser.close();
const files = fs.readdirSync("docs/assets/video").filter((f) => f.endsWith(".webm"));
console.log("WEBM:", files.join(","));
