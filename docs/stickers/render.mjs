import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Reuse the Playwright/Chromium install already present under e2e/node_modules
// rather than adding a second copy of the dependency for this docs asset.
const require = createRequire(path.join("C:/projects/TwinkleTune/e2e", "package.json"));
const { chromium } = require("playwright");

const dir = path.dirname(fileURLToPath(import.meta.url));

const sheets = [
  { html: "sheet-1-twinkle-and-friends.html", pdf: "TwinkleTune-Stickers-1-Twinkle-and-Friends.pdf", png: "preview-1.png" },
  { html: "sheet-2-stars-and-sparkles.html", pdf: "TwinkleTune-Stickers-2-Stars-and-Sparkles.pdf", png: "preview-2.png" },
  { html: "sheet-3-practice-awards.html", pdf: "TwinkleTune-Stickers-3-Practice-Awards.pdf", png: "preview-3.png" },
];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 816, height: 1056 } });

for (const sheet of sheets) {
  const fileUrl = "file:///" + path.join(dir, sheet.html).replace(/\\/g, "/");
  await page.goto(fileUrl, { waitUntil: "load" });
  await page.screenshot({ path: path.join(dir, sheet.png), fullPage: true });
  await page.pdf({
    path: path.join(dir, sheet.pdf),
    width: "8.5in",
    height: "11in",
    printBackground: true,
    margin: { top: 0, bottom: 0, left: 0, right: 0 },
  });
  console.log("done:", sheet.pdf);
}

await browser.close();
