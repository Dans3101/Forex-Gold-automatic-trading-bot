// saveCookies.js
import fs from "fs";
import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium";

const EMAIL = process.env.POCKET_EMAIL;
const PASSWORD = process.env.POCKET_PASSWORD;

async function run() {
  const browser = await puppeteer.launch({
    args: chromium.args,
    executablePath: await chromium.executablePath(),
    headless: false, // 👈 IMPORTANT: show browser so you solve captcha manually
    defaultViewport: chromium.defaultViewport,
  });

  const page = await browser.newPage();
  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36"
  );

  console.log("🌐 Navigating to Pocket Option login...");
  await page.goto("https://pocketoption.com/en/login/", {
    waitUntil: "networkidle2",
    timeout: 180000,
  });

  // If EMAIL and PASSWORD exist, auto-fill (you can still edit manually)
  if (EMAIL && PASSWORD) {
    if (await page.$("#email")) {
      await page.type("#email", EMAIL, { delay: 80 });
    }
    if (await page.$("#password")) {
      await page.type("#password", PASSWORD, { delay: 80 });
    }
  }

  console.log("✋ Please solve captcha & finish login manually in the browser...");
  // Wait 30 sec so you can login manually
  await new Promise((r) => setTimeout(r, 30000));

  // After 30 sec, save cookies
  const cookies = await page.cookies();
  fs.writeFileSync("cookies.json", JSON.stringify(cookies, null, 2));

  console.log("✅ Cookies saved to cookies.json");

  await browser.close();
}

run().catch((err) => {
  console.error("❌ saveCookies error:", err);
});