import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { chromium, type Page } from "playwright";

const paper = { width: "58mm", height: "200mm", margin: { top: 0, right: 0, bottom: 0, left: 0 }, printBackground: true } as const;

async function printMetrics(page: Page) {
  return page.evaluate(() => {
    const main = document.querySelector("main")!.getBoundingClientRect();
    const slip = document.querySelector("section")!.getBoundingClientRect();
    const image = document.querySelector("section img")?.getBoundingClientRect();
    return {
      main: [main.x, main.y, main.width, main.height],
      slip: [slip.x, slip.y, slip.width, slip.height],
      qr: image && [image.x, image.y, image.width, image.height],
      bodyHeight: document.body.getBoundingClientRect().height,
      qrInside: !image || (image.left >= slip.left && image.right <= slip.right && image.top >= slip.top && image.bottom <= slip.bottom),
      buttonHidden: getComputedStyle(document.querySelector("button")!).display === "none",
    };
  });
}

export async function checkSlipPrint(baseUrl: string, cookie: string, porkPath: string, beefPath: string) {
  assert.equal(process.env.DATABASE_URL, process.env.TEST_DATABASE_URL, "print checks require the test database");
  assert(["127.0.0.1", "localhost", "::1"].includes(new URL(baseUrl).hostname), "print checks require a local server");
  const slipCss = readFileSync("app/slip/session-slip.module.css", "utf8");
  assert(!/@page|\b(?:58|80)mm\b|:has\(/.test(slipCss), "slip CSS must not impose paper settings or root overrides");
  const globalCss = readFileSync("app/globals.css", "utf8");
  const pr9Css = execFileSync("git", ["show", "049e6bc:app/qr/[token]/page.module.css"], { encoding: "utf8" });
  const [name, value] = cookie.split("=");
  assert(name && value);
  const browser = await chromium.launch({ executablePath: process.env.CHROME_BIN ?? "/usr/bin/google-chrome", headless: true, args: ["--no-sandbox"] });
  try {
    const previewDir = process.env.PRINT_PREVIEW_DIR;
    if (previewDir) mkdirSync(previewDir, { recursive: true });
    const context = await browser.newContext({ viewport: { width: 219, height: 756 } });
    await context.addCookies([{ name, value, url: baseUrl }]);
    for (const [kind, path, hasQr] of [["pork", porkPath, false], ["beef", beefPath, true]] as const) {
      const page = await context.newPage();
      const baseline = await context.newPage();
      try {
        await page.addInitScript(() => {
          Object.assign(window, { printCalls: 0 });
          window.print = () => { Object.assign(window, { printCalls: Number(Reflect.get(window, "printCalls")) + 1 }); };
        });
        const response = await page.goto(`${baseUrl}${path}`);
        assert.equal(response?.status(), 200);
        const qr = page.getByAltText("QR สำหรับสั่งอาหาร");
        if (hasQr) {
          await qr.waitFor();
          assert(await qr.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0), "QR image did not load");
        } else assert.equal(await qr.count(), 0);
        await page.getByRole("button", { name: "พิมพ์ใบโต๊ะ" }).click();
        assert.equal(await page.evaluate(() => Reflect.get(window, "printCalls")), 1);
        const slip = page.getByRole("region", { name: "ใบพิมพ์รอบโต๊ะ" });
        const text = await slip.innerText();
        for (const field of ["NIRA SHABU", "วันที่:", "โต๊ะที่:", "เวลาเริ่ม:", "ถึงเวลา:", "ผู้ใหญ่: 3", "เด็ก: 2"]) assert(text.includes(field), `${kind}: missing ${field}`);

        const { html, classes } = await page.evaluate(() => ({
          html: document.querySelector("main")!.outerHTML,
          classes: {
            page: document.querySelector("main")!.className,
            card: document.querySelector("section")!.className,
            qr: document.querySelector("section img")?.className ?? "",
            loading: document.querySelector(".loading")?.className ?? "",
            printButton: document.querySelector("button")!.className,
          },
        }));
        let mappedCss = pr9Css;
        for (const [selector, className] of Object.entries(classes)) {
          if (className) mappedCss = mappedCss.replaceAll(`.${selector}`, `.${className}`);
        }
        await baseline.setContent(`<style>${globalCss}\n${mappedCss}</style>${html}`);
        await page.emulateMedia({ media: "print" });
        await baseline.emulateMedia({ media: "print" });
        const actual = await printMetrics(page);
        const expected = await printMetrics(baseline);
        assert.deepEqual(actual, expected, `${kind}: print geometry differs from PR #9 layout`);
        assert(actual.qrInside && actual.buttonHidden, `${kind}: QR clipped or print button visible`);
        const actualPdf = await page.pdf(paper);
        const baselinePdf = await baseline.pdf(paper);
        const pageCount = (pdf: Buffer) => Number(execFileSync("pdfinfo", ["-"], { input: pdf, encoding: "utf8" }).match(/Pages:\s+(\d+)/)?.[1]);
        assert.equal(pageCount(actualPdf), pageCount(baselinePdf), `${kind}: fixed-paper PDF pagination differs from PR #9`);
        assert.equal(pageCount(actualPdf), 1, `${kind}: fixed-paper PDF has an extra page`);
        const actualShot = await slip.screenshot({ mask: hasQr ? [qr] : [], maskColor: "#222222" });
        const baselineQr = baseline.getByAltText("QR สำหรับสั่งอาหาร");
        const baselineShot = await baseline.locator("section").screenshot({ mask: hasQr ? [baselineQr] : [], maskColor: "#222222" });
        assert.deepEqual(actualShot, baselineShot, `${kind}: masked print preview differs from PR #9 layout`);
        if (previewDir) {
          writeFileSync(`${previewDir}/pr9-${kind}.png`, baselineShot);
          writeFileSync(`${previewDir}/restored-${kind}.png`, actualShot);
        }
        console.log(`${kind}: PR #9 print geometry and masked preview match; fixed 58×200 mm PDF is one page; one print call`);
      } finally {
        await baseline.close();
        await page.close();
      }
    }
    await context.close();
  } finally {
    await browser.close();
  }
}
