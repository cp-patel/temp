/* Playwright resolution shared by the UI tests.
   Works in two worlds without configuration:
   - Claude Code cloud env: playwright + chromium preinstalled at fixed paths
   - a laptop: `npm i -D playwright && npx playwright install chromium`
   CHROMIUM_PATH env var overrides the browser binary in either. */
const fs = require('fs');

let chromium;
try {
  ({ chromium } = require('playwright'));
} catch (e) {
  ({ chromium } = require('/opt/node22/lib/node_modules/playwright'));
}

const candidates = [
  process.env.CHROMIUM_PATH,
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
].filter(Boolean);
const executablePath = candidates.find((p) => fs.existsSync(p));

// executablePath undefined → playwright launches its own managed chromium
module.exports = { chromium, launchOpts: executablePath ? { executablePath } : {} };
