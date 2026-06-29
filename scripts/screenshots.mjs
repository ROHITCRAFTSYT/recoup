import { chromium } from "playwright";
import fs from "fs";
const BASE = "http://localhost:3000";
const OUT = "docs/assets";
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1.5 });
const page = await ctx.newPage();
const shot = async (name, opts = {}) => { await page.waitForTimeout(1300); await page.screenshot({ path: `${OUT}/${name}.png`, ...opts }); console.log("captured", name); };

await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await shot("login");

await page.click('button[type=submit]');
await page.waitForLoadState("networkidle");
await shot("dashboard");

await page.goto(`${BASE}/board`, { waitUntil: "networkidle" });
await shot("board");

await page.goto(`${BASE}/authorizations`, { waitUntil: "networkidle" });
await shot("authorizations");

await page.goto(`${BASE}/analytics`, { waitUntil: "networkidle" });
await shot("analytics");

await page.goto(`${BASE}/board`, { waitUntil: "networkidle" });
const href = await page.locator('a[href^="/invoices/"]').first().getAttribute("href");
if (href) { await page.goto(`${BASE}${href}`, { waitUntil: "networkidle" }); await shot("case"); }

await page.goto(`${BASE}/integrations`, { waitUntil: "networkidle" });
await shot("integrations", { fullPage: true });

await browser.close();
console.log("ALL DONE");
