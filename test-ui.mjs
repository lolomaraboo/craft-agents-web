import { chromium } from "playwright";

(async () => {
  console.log("🚀 Starting Craft Agents Web UI test...");
  
  const browser = await chromium.launch({
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"]
  });
  
  const page = await browser.newPage();
  
  const errors = [];
  const warnings = [];
  
  page.on("console", msg => {
    const type = msg.type();
    const text = msg.text();
    if (type === "error") {
      errors.push(text);
      console.log("[ERROR]", text);
    } else if (type === "warning") {
      warnings.push(text);
      console.log("[WARN]", text);
    }
  });
  
  page.on("pageerror", error => {
    errors.push(error.message);
    console.log("[PAGE ERROR]", error.message);
  });
  
  console.log("🌐 Opening http://localhost:5173...");
  try {
    await page.goto("http://localhost:5173", { waitUntil: "domcontentloaded", timeout: 30000 });
    console.log("✅ Page loaded");
  } catch (e) {
    console.log("❌ Failed to load:", e.message);
    await browser.close();
    return;
  }
  
  await page.waitForTimeout(3000);
  
  console.log("📸 Taking screenshot...");
  await page.screenshot({ path: "/tmp/craft-agents-web.png", fullPage: false });
  
  console.log("📄 Page title:", await page.title());
  
  const bodyText = await page.evaluate(() => {
    return document.body.innerText.substring(0, 800);
  });
  console.log("\n📝 Visible content:\n", bodyText);
  
  console.log("\n📊 Summary:");
  console.log("- Errors:", errors.length);
  console.log("- Warnings:", warnings.length);
  console.log("- Screenshot: /tmp/craft-agents-web.png");
  
  await browser.close();
  console.log("✅ Test completed!");
})();
