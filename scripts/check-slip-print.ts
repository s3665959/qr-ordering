import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";

export async function checkSlipPrint(baseUrl: string, cookie: string, porkPath: string, beefPath: string) {
  assert.equal(process.env.DATABASE_URL, process.env.TEST_DATABASE_URL, "print checks require the test database");
  assert(["127.0.0.1", "localhost", "::1"].includes(new URL(baseUrl).hostname), "print checks require a local server");
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
        }
        else assert.equal(await qr.count(), 0);
        await page.getByRole("button", { name: "พิมพ์ใบโต๊ะ" }).click();
        assert.equal(await page.evaluate(() => Reflect.get(window, "printCalls")), 1);
        await page.emulateMedia({ media: "print" });
        const slip = page.getByRole("region", { name: "ใบพิมพ์รอบโต๊ะ" });
        const metrics = await page.evaluate(() => {
          const html = document.documentElement;
          const body = document.body;
          const slip = document.querySelector("section")!;
          const r = slip.getBoundingClientRect();
          const qr = slip.querySelector("img")?.getBoundingClientRect();
          return { pageWidth: document.querySelector("main")!.getBoundingClientRect().width, slipHeight: r.height, bodyHeight: body.getBoundingClientRect().height, htmlHeight: html.getBoundingClientRect().height, tail: body.getBoundingClientRect().bottom - r.bottom, qrInside: !qr || (qr.top >= r.top && qr.bottom <= r.bottom && qr.right <= r.right) };
        });
        assert(metrics.pageWidth <= 220 && metrics.pageWidth >= 200, `${kind}: slip width is not 58 mm`);
        assert(metrics.tail < 20, `${kind}: trailing print area is ${metrics.tail}px`);
        assert(metrics.qrInside, `${kind}: QR exceeds slip bounds`);
        assert(metrics.slipHeight > 100, `${kind}: slip is unexpectedly short`);
        const text = await slip.innerText();
        for (const field of ["NIRA SHABU", "วันที่:", "โต๊ะที่:", "เวลาเริ่ม:", "ถึงเวลา:", "ผู้ใหญ่: 3", "เด็ก: 2"]) assert(text.includes(field), `${kind}: missing ${field}`);
        const heightMm = Math.ceil(metrics.slipHeight / 96 * 25.4 + 4);
        const pdf = await page.pdf({ width: "58mm", height: `${heightMm}mm`, margin: { top: 0, right: 0, bottom: 0, left: 0 }, printBackground: true });
        const pdfInfo = execFileSync("pdfinfo", ["-"], { input: pdf, encoding: "utf8" });
        assert.match(pdfInfo, /Pages:\s+1\b/, `${kind}: PDF has a blank or overflow page`);
        const pageWidthPt = Number(pdfInfo.match(/Page size:\s+([\d.]+) x/)?.[1]);
        assert(pageWidthPt >= 164 && pageWidthPt <= 166, `${kind}: PDF width is ${pageWidthPt} pt, expected 58 mm`);
        if (previewDir) await slip.screenshot({ path: `${previewDir}/58mm-${kind}.png`, mask: hasQr ? [qr] : [], maskColor: "#222222" });
        console.log(`${kind}: 58 mm print media, one PDF page, ${metrics.tail.toFixed(1)} px trailing layout, one print call, content complete`);
      } finally {
        await page.close();
      }
    }
    await context.close();
  } finally {
    await browser.close();
  }
}
