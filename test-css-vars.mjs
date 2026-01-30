import { chromium } from "playwright";

(async () => {
  const browser = await chromium.launch({ args: ["--no-sandbox"] });
  const page = await browser.newPage();
  
  await page.goto("http://localhost:5173", { waitUntil: "networkidle" });
  await page.waitForTimeout(3000);
  
  const cssVars = await page.evaluate(() => {
    const styles = window.getComputedStyle(document.documentElement);
    return {
      background: styles.getPropertyValue("--background").trim(),
      foreground: styles.getPropertyValue("--foreground").trim(),
      accent: styles.getPropertyValue("--accent").trim(),
      bgColor: styles.backgroundColor,
      color: styles.color,
    };
  });
  
  console.log("CSS Variables:", JSON.stringify(cssVars, null, 2));
  
  const styleSheets = await page.evaluate(() => {
    const sheets = [];
    for (const sheet of Array.from(document.styleSheets)) {
      try {
        const rules = Array.from(sheet.cssRules || []);
        const rootRules = rules.filter(r => r.selectorText === ":root");
        if (rootRules.length > 0) {
          sheets.push({
            href: sheet.href,
            rootRules: rootRules.map(r => r.cssText.substring(0, 500))
          });
        }
      } catch (e) {
        // Skip CORS errors
      }
    }
    return sheets;
  });
  
  console.log("\n:root rules found:", styleSheets.length);
  styleSheets.forEach((sheet, i) => {
    console.log(`\nStyleSheet ${i+1}:`, sheet.href);
    console.log(sheet.rootRules.join("\n\n"));
  });
  
  await browser.close();
})();
