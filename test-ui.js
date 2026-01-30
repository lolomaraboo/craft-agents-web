const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch({
    executablePath: "/usr/bin/chromium-browser",
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });
  
  const page = await browser.newPage();
  
  page.on("console", msg => {
    const type = msg.type();
    if (type === "error" || type === "warning") {
      console.log("[" + type.toUpperCase() + "]", msg.text());
    }
  });
  
  page.on("pageerror", error => {
    console.log("[PAGE ERROR]", error.message);
  });
  
  console.log("Opening http://localhost:5173...");
  await page.goto("http://localhost:5173", { waitUntil: "networkidle", timeout: 30000 });
  
  console.log("Taking screenshot...");
  await page.screenshot({ path: "/tmp/craft-agents-web.png", fullPage: true });
  
  console.log("Page title:", await page.title());
  
  const bodyText = await page.evaluate(() => {
    return document.body.innerText.substring(0, 500);
  });
  console.log("Visible text:", bodyText);
  
  console.log("Test completed!");
  
  await browser.close();
})();
