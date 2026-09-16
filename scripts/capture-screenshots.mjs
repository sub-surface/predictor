import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync, mkdirSync } from 'node:fs';
import { resolve, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const publicDir = resolve(root, 'public');
const outDir = resolve(root, 'docs/screenshots');

if (!existsSync(outDir)) {
  mkdirSync(outDir, { recursive: true });
}

// Simple static HTTP server for publicDir
const MIME = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.json': 'application/json'
};

const server = createServer((req, res) => {
  let reqPath = req.url.split('?')[0];
  if (reqPath === '/' || reqPath === '') reqPath = '/index.html';
  const filePath = resolve(publicDir, '.' + reqPath);

  if (existsSync(filePath) && !statSync(filePath).isDirectory()) {
    const ext = extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(readFileSync(filePath));
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

server.listen(8099, async () => {
  console.log('Test static server running at http://localhost:8099');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 1
  });
  const page = await context.newPage();

  try {
    // 1. Capture BIOS Boot Screen
    console.log('Capturing BIOS boot screen...');
    await page.goto('http://localhost:8099');
    await page.waitForTimeout(1200); // Allow memory test and lines to render
    await page.screenshot({ path: resolve(outDir, '01_bios_boot.png') });
    console.log('Saved 01_bios_boot.png');

    // 2. Skip BIOS to DOS Main Menu
    console.log('Capturing DOS main menu...');
    await page.keyboard.press('Space');
    await page.waitForTimeout(300);
    await page.screenshot({ path: resolve(outDir, '02_main_menu.png') });
    console.log('Saved 02_main_menu.png');

    // 3. Open Pre-Run Loadout Modal
    console.log('Capturing Pre-Run loadout setup...');
    await page.keyboard.press('1'); // [1] ENTER ACTIVE EXPEDITION
    await page.waitForTimeout(300);
    await page.screenshot({ path: resolve(outDir, '03_loadout_setup.png') });
    console.log('Saved 03_loadout_setup.png');

    // 4. Start Run with Scout Class
    console.log('Starting run as Scout and capturing Tactical Board...');
    await page.click('.class-card[data-class="scout"]');
    await page.click('#btn-start-configured-run');
    await page.waitForTimeout(500);

    // Make 3 moves in the game to populate board & predictions
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(200);
    await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(200);
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(400);

    await page.screenshot({ path: resolve(outDir, '04_tactical_board.png') });
    console.log('Saved 04_tactical_board.png');

    // 5. Toggle to Neural Diagnostic Suite View
    console.log('Capturing Neural Diagnostic Suite...');
    await page.keyboard.press('v'); // Press V to toggle monitor to Neural Mode
    await page.waitForTimeout(400);
    await page.screenshot({ path: resolve(outDir, '05_neural_diagnostic.png') });
    console.log('Saved 05_neural_diagnostic.png');

    // 6. Open FTL Sector Navigation Route Map
    console.log('Capturing Sector Route Map...');
    await page.keyboard.press('m'); // Press M to open route map
    await page.waitForTimeout(400);
    await page.screenshot({ path: resolve(outDir, '06_sector_map.png') });
    console.log('Saved 06_sector_map.png');

    console.log('All 6 high-fidelity screenshots captured successfully!');
  } catch (err) {
    console.error('Screenshot capture error:', err);
  } finally {
    await browser.close();
    server.close();
    process.exit(0);
  }
});
