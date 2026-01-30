import { chromium } from "playwright";

(async () => {
  console.log("🧪 Testing OAuth Flow...\n");
  
  const browser = await chromium.launch({ args: ["--no-sandbox"] });
  const page = await browser.newPage();
  
  // Capture console messages
  const errors = [];
  page.on("console", msg => {
    if (msg.type() === "error") {
      errors.push(msg.text());
    }
  });
  
  console.log("1️⃣  Loading homepage...");
  await page.goto("http://localhost:5173", { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  
  console.log("2️⃣  Looking for Get Started button...");
  const getStartedBtn = await page.locator('button:has-text("Get Started")').first();
  
  if (await getStartedBtn.isVisible()) {
    console.log("✅ Get Started button found");
    console.log("3️⃣  Clicking button...");
    await getStartedBtn.click();
    await page.waitForTimeout(3000);
    
    console.log("4️⃣  Checking for onboarding screen...");
    const bodyText = await page.evaluate(() => document.body.innerText);
    
    if (bodyText.includes("API Key") || bodyText.includes("OAuth") || bodyText.includes("billing")) {
      console.log("✅ Onboarding screen loaded successfully");
      
      // Try to find OAuth button if exists
      const oauthBtn = await page.locator('button:has-text("OAuth")').first();
      if (await oauthBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
        console.log("5️⃣  Found OAuth button, testing...");
        await oauthBtn.click();
        await page.waitForTimeout(2000);
        
        // Check for errors
        if (errors.some(e => e.includes("startClaudeOAuth"))) {
          console.log("❌ OAuth call failed:", errors.filter(e => e.includes("OAuth")));
        } else {
          console.log("✅ OAuth button clicked without errors");
        }
      } else {
        console.log("ℹ️  OAuth button not found on this screen");
      }
    } else {
      console.log("⚠️  Unexpected content:", bodyText.substring(0, 200));
    }
  } else {
    console.log("❌ Get Started button not found");
  }
  
  console.log("\n📸 Taking screenshot...");
  await page.screenshot({ path: "/tmp/oauth-flow-test.png", fullPage: true });
  
  console.log("\n📊 Summary:");
  console.log("- Errors found:", errors.length);
  if (errors.length > 0) {
    console.log("\n❌ Console errors:");
    errors.slice(0, 5).forEach((err, i) => {
      console.log(`  ${i+1}. ${err.substring(0, 150)}...`);
    });
  }
  
  await browser.close();
  console.log("\n✅ Test completed\!");
})();
