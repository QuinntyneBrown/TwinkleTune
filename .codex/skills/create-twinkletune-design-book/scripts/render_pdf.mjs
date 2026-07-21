#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

function parseArgs(argv) {
  const args = {};
  for (let index = 2; index < argv.length; index += 1) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key.startsWith("--") || value === undefined) {
      throw new Error(`Expected --name value, received: ${key}`);
    }
    args[key.slice(2)] = value;
    index += 1;
  }
  return args;
}

function loadPlaywright(moduleRoot) {
  const packageJson = path.join(moduleRoot, "package.json");
  if (!fs.existsSync(packageJson)) {
    throw new Error(`Playwright module root has no package.json: ${moduleRoot}`);
  }
  const requireFromRoot = createRequire(packageJson);
  return requireFromRoot("playwright");
}

async function launchChromium(chromium) {
  try {
    return {
      browser: await chromium.launch({
        headless: true,
        args: ["--allow-file-access-from-files", "--font-render-hinting=none"],
      }),
      browserLabel: "bundled Chromium",
    };
  } catch (error) {
    throw new Error(
      "Unable to launch the lockfile-pinned Chromium. " +
        "Run `npx playwright install chromium` from the e2e directory.\n" +
        error.message,
    );
  }
}

async function collectReadiness(page) {
  return page.evaluate(async () => {
    await document.fonts.ready;
    const images = Array.from(document.images);
    await Promise.all(
      images.map((image) => {
        if (image.complete) return Promise.resolve();
        return new Promise((resolve, reject) => {
          image.addEventListener("load", resolve, { once: true });
          image.addEventListener(
            "error",
            () => reject(new Error(`Image failed: ${image.currentSrc || image.src}`)),
            { once: true },
          );
        });
      }),
    );
    const broken = images
      .filter((image) => image.naturalWidth === 0 || image.naturalHeight === 0)
      .map((image) => image.currentSrc || image.src);
    const loadedFonts = Array.from(document.fonts).map((font) => ({
      family: font.family,
      status: font.status,
      weight: font.weight,
    }));
    const figures = Array.from(document.querySelectorAll("figure"));
    const labelledFigures = figures.filter(
      (figure) => (figure.getAttribute("aria-label") ?? "").trim().length > 0,
    ).length;
    return {
      imageCount: images.length,
      broken,
      loadedFonts,
      areas: document.querySelectorAll(".domain-opener").length,
      chapters: document.querySelectorAll(".chapter").length,
      wideDiagrams: document.querySelectorAll(".diagram-wide").length,
      figures: figures.length,
      labelledFigures,
      documentBytes: new Blob([document.documentElement.outerHTML]).size,
    };
  });
}

async function main() {
  const args = parseArgs(process.argv);
  const input = path.resolve(args.input ?? "");
  const output = path.resolve(args.output ?? "");
  const moduleRoot = path.resolve(args["module-root"] ?? "");
  const expectedImages = Number.parseInt(args["expected-images"] ?? "0", 10);

  if (!fs.existsSync(input)) {
    throw new Error(`Input HTML does not exist: ${input}`);
  }
  if (!moduleRoot) {
    throw new Error("--module-root is required");
  }
  fs.mkdirSync(path.dirname(output), { recursive: true });

  const { chromium } = loadPlaywright(moduleRoot);
  const { browser, browserLabel } = await launchChromium(chromium);
  const browserVersion = browser.version();
  try {
    const page = await browser.newPage({
      viewport: { width: 1440, height: 1000 },
      deviceScaleFactor: 1,
    });
    page.setDefaultTimeout(180_000);
    const consoleErrors = [];
    page.on("console", (message) => {
      if (message.type() === "error") {
        consoleErrors.push(message.text());
      }
    });
    page.on("pageerror", (error) => consoleErrors.push(error.message));

    await page.goto(pathToFileURL(input).href, {
      waitUntil: "networkidle",
      timeout: 180_000,
    });
    await page.emulateMedia({ media: "print" });

    let readiness;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      readiness = await collectReadiness(page);
      if (
        readiness.broken.length === 0 &&
        (expectedImages === 0 || readiness.imageCount === expectedImages)
      ) {
        break;
      }
      if (attempt < 3) {
        await page.reload({ waitUntil: "networkidle", timeout: 180_000 });
        await page.emulateMedia({ media: "print" });
      }
    }

    if (readiness.broken.length > 0) {
      throw new Error(`Broken images:\n${readiness.broken.join("\n")}`);
    }
    if (expectedImages > 0 && readiness.imageCount !== expectedImages) {
      throw new Error(
        `Expected ${expectedImages} HTML images, found ${readiness.imageCount} ` +
          `(DOM bytes: ${readiness.documentBytes})`,
      );
    }
    const requiredFonts = ["Baloo 2", "Manrope"];
    for (const family of requiredFonts) {
      const matching = readiness.loadedFonts.filter((font) =>
        font.family.replaceAll('"', "").includes(family),
      );
      if (matching.length === 0 || matching.some((font) => font.status !== "loaded")) {
        throw new Error(`Required font did not load: ${family}`);
      }
    }
    if (consoleErrors.length > 0) {
      throw new Error(`Browser console errors:\n${consoleErrors.join("\n")}`);
    }

    await page.pdf({
      path: output,
      printBackground: true,
      preferCSSPageSize: true,
      tagged: true,
      outline: true,
      scale: 1,
      margin: { top: "0", right: "0", bottom: "0", left: "0" },
      timeout: 180_000,
    });

    process.stdout.write(
      `${JSON.stringify({
        browser: browserLabel,
        browserVersion,
        ...readiness,
        output,
        bytes: fs.statSync(output).size,
      })}\n`,
    );
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exitCode = 1;
});
