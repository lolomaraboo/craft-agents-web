import { chromium } from "playwright";

(async () => {
  console.log("🔍 Starting detailed UI debug test...");
  
  const browser = await chromium.launch({
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"]
  });
  
  const page = await browser.newPage();
  
  const errors = [];
  const warnings = [];
  const logs = [];
  
  page.on("console", msg => {
    const type = msg.type();
    const text = msg.text();
    const logEntry = `[${type.toUpperCase()}] ${text}`;
    
    if (type === "error") {
      errors.push(text);
      console.log("❌", logEntry);
    } else if (type === "warning") {
      warnings.push(text);
      console.log("⚠️ ", logEntry);
    } else {
      logs.push(text);
      if (text.includes("failed") || text.includes("error")) {
        console.log("ℹ️ ", logEntry);
      }
    }
  });
  
  page.on("pageerror", error => {
    errors.push(error.message);
    console.log("💥 PAGE ERROR:", error.message);
  });
  
  page.on("requestfailed", request => {
    console.log("🚫 REQUEST FAILED:", request.url(), request.failure()?.errorText);
  });
  
  console.log("🌐 Opening http://localhost:5173...");
  try {
    await page.goto("http://localhost:5173", { 
      waitUntil: "networkidle",
      timeout: 30000 
    });
    console.log("✅ Page loaded");
  } catch (e) {
    console.log("❌ Failed to load:", e.message);
    await browser.close();
    process.exit(1);
  }
  
  // Wait for React to render
  await page.waitForTimeout(5000);
  
  console.log("\n📸 Taking screenshot...");
  await page.screenshot({ path: "/tmp/craft-agents-debug.png", fullPage: true });
  
  console.log("📄 Page title:", await page.title());
  
  const bodyText = await page.evaluate(() => {
    return document.body.innerText;
  });
  console.log("\n📝 Visible content:");
  console.log(bodyText.substring(0, 1000));
  
  const rootHtml = await page.evaluate(() => {
    const root = document.getElementById("root");
    return root ? root.innerHTML.substring(0, 500) : "NO ROOT ELEMENT";
  });
  console.log("\n🏗️  Root element HTML:");
  console.log(rootHtml);
  
  console.log("\n📊 Summary:");
  console.log("- Errors:", errors.length);
  console.log("- Warnings:", warnings.length);
  console.log("- Screenshot: /tmp/craft-agents-debug.png");
  
  if (errors.length > 0) {
    console.log("\n❌ ERRORS:");
    errors.forEach((err, i) => console.log(`  ${i+1}. ${err}`));
  }
  
  await browser.close();
  console.log("\n✅ Test completed\!");
})();
