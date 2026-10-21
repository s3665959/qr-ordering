import assert from "node:assert/strict";
import { chromium, devices, type BrowserContextOptions } from "playwright";

const databaseUrl = process.env.DATABASE_URL;
const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const baseUrl = process.env.TEST_BASE_URL ?? "http://127.0.0.1:3001";

async function main() {
  if (!databaseUrl || databaseUrl !== testDatabaseUrl || !["127.0.0.1", "localhost", "::1"].includes(new URL(databaseUrl).hostname)) {
    throw new Error("Browser test requires the separate local test database configuration");
  }
  if (new URL(baseUrl).protocol !== "http:" || !["127.0.0.1", "localhost", "::1"].includes(new URL(baseUrl).hostname)) {
    throw new Error("Browser test requires a local HTTP server");
  }

  const browser = await chromium.launch({
    executablePath: process.env.CHROME_BIN ?? "/usr/bin/google-chrome",
    headless: true,
    args: ["--no-sandbox"],
  });
  try {
    const profiles: Array<[string, BrowserContextOptions]> = [
      ["desktop", { viewport: { width: 1440, height: 900 } }],
      ["mobile touch", { ...devices["Pixel 7"] }],
    ];
    for (const [profile, options] of profiles) {
      const context = await browser.newContext(options);
      try {
        const page = await context.newPage();
        await page.route("**/api/auth/me", (route) => route.fulfill({ json: { staff: { displayName: "Browser test", permissions: ["TABLE_VIEW", "TABLE_OPEN"] } } }));
        await page.route("**/api/staff/tables", (route) => route.fulfill({ json: {
          serverNow: new Date().toISOString(),
          tables: [{ id: "00000000-0000-4000-8000-000000000001", tableNumber: "2", displayName: "โต๊ะ 2", capacity: null, effectiveStatus: "AVAILABLE", activeSession: null }],
        } }));
        await page.route("**/api/staff/packages", (route) => route.fulfill({ json: {
          packages: [{ id: "00000000-0000-4000-8000-000000000002", name: "บุฟเฟต์หมูและเนื้อวัว", pricePerPerson: 339, childPricePerPerson: 169, durationMinutes: 120, allowsBeefOrdering: true }],
        } }));

        await page.goto(baseUrl);
        await page.getByRole("heading", { name: "เปิดรอบใหม่" }).waitFor();
        await page.getByLabel("แพ็กเกจทั้งโต๊ะ").selectOption("00000000-0000-4000-8000-000000000002");
        await page.getByLabel("ผู้ใหญ่", { exact: true }).fill("3");

        const childToggle = page.getByRole("button", { name: /เด็ก/ });
        await childToggle.click();
        assert.equal(await childToggle.getAttribute("aria-expanded"), "true");
        await page.getByLabel("เด็ก", { exact: true }).fill("2");
        await page.getByLabel("สรุปราคา").getByText("1,355 บาท").waitFor();

        await childToggle.click();
        assert.equal(await childToggle.getAttribute("aria-expanded"), "false");
        assert.equal(await page.getByLabel("เด็ก", { exact: true }).count(), 0);
        await page.getByText("กำลังกรอก: ผู้ใหญ่").waitFor();
        const numberPad = page.getByLabel("แป้นตัวเลข");
        await numberPad.getByRole("button", { name: "ล้างค่า" }).click();
        await numberPad.getByRole("button", { name: "4", exact: true }).click();

        assert.equal(await page.getByLabel("ผู้ใหญ่", { exact: true }).inputValue(), "4");
        await page.getByLabel("สรุปราคา").getByText("เด็ก 2 × 169 บาท").waitFor();
        await page.getByLabel("สรุปราคา").getByText("1,694 บาท").waitFor();
        await childToggle.click();
        assert.equal(await page.getByLabel("เด็ก", { exact: true }).inputValue(), "2");
        console.log(`${profile}: hidden child count preserved; number pad updated adults and total`);
      } finally {
        await context.close();
      }
    }
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
