// Screenshot helper — usage: node screenshot.mjs <url> [label]
// Saves auto-incremented PNGs to ./temporary screenshots/screenshot-N[-label].png
import puppeteer from "puppeteer";
import fs from "node:fs";
import path from "node:path";

const url = process.argv[2];
const label = process.argv[3];

if (!url || url.startsWith("file://")) {
  console.error("Usage: node screenshot.mjs http://localhost:3000 [label] (localhost only, never file://)");
  process.exit(1);
}

const dir = path.join(process.cwd(), "temporary screenshots");
fs.mkdirSync(dir, { recursive: true });

// Next free index — never overwrite
let n = 1;
while (
  fs.existsSync(path.join(dir, `screenshot-${n}.png`)) ||
  fs.readdirSync(dir).some((f) => f.startsWith(`screenshot-${n}-`))
) {
  n++;
}
const file = path.join(dir, `screenshot-${n}${label ? `-${label}` : ""}.png`);

const browser = await puppeteer.launch();
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 960, deviceScaleFactor: 2 });
await page.goto(url, { waitUntil: "networkidle0", timeout: 60000 });
await new Promise((r) => setTimeout(r, 800)); // settle animations/fonts
await page.screenshot({ path: file, fullPage: true });
await browser.close();

console.log(file);
