const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  // Navigate to index.html
  await page.goto(`file://${path.join(__dirname, 'src/ui/index.html')}`);

  // Click settings button (the gear icon in Controls)
  // Based on renderer.js: document.getElementById('btn-settings').addEventListener('click', () => { ... })
  // In index.html: <button id="btn-settings" class="icon-button" title="Settings">⚙️</button>
  await page.click('#btn-settings');

  // Wait for settings overlay to be visible
  await page.waitForSelector('#settings-overlay', { state: 'visible' });

  // Take screenshot of settings
  await page.screenshot({ path: 'settings_ui.png' });

  await browser.close();
})();
