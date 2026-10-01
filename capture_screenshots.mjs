import { chromium, devices } from 'playwright';
import path from 'path';
import fs from 'fs';

const routes = [
  '/',
  '/workout',
  '/meal',
  '/habits',
  '/profile',
  '/journey'
];

const screenshotsDir = path.join(process.cwd(), 'screenshots');

if (!fs.existsSync(screenshotsDir)) {
  fs.mkdirSync(screenshotsDir);
}

(async () => {
  console.log('Starting Playwright for mobile capture (bypassing login)...');
  let browser;
  try {
    browser = await chromium.launch();
    
    // Setup for iPhone 13 view
    const iPhone = devices['iPhone 13'];
    const context = await browser.newContext({
      ...iPhone,
      colorScheme: 'dark',
    });
    
    const page = await context.newPage();

    console.log('Injecting session into localStorage...');
    // Go to an empty page on the same origin first, or just go to /login so origin matches
    await page.goto('http://localhost:3000/login', { waitUntil: 'domcontentloaded' });
    
    await page.evaluate(() => {
      localStorage.setItem('healthos_email', 'demo@healthos.app');
      localStorage.setItem('healthos_userId', 'local_demo_user');
    });

    console.log('Session injected. Navigating routes...');

    for (const route of routes) {
      console.log(`Navigating to http://localhost:3000${route}`);
      try {
        await page.goto(`http://localhost:3000${route}`, { waitUntil: 'load', timeout: 45000 });
        
        // Wait for the syncing text to disappear if it's there
        try {
           await page.waitForFunction(() => !document.body.innerText.includes('SYNCING HEALTH OS'), { timeout: 20000 });
        } catch(e) {}
        
        // Extra wait to let animations finish and UI settle
        await page.waitForTimeout(5000); 
        
        const fileName = route === '/' ? 'dashboard.png' : `${route.substring(1)}.png`;
        const filePath = path.join(screenshotsDir, fileName);
        
        await page.screenshot({ path: filePath });
        console.log(`Saved screenshot for ${route} to ${filePath}`);
      } catch (e) {
        console.error(`Failed to capture ${route}:`, e.message);
      }
    }
  } catch (error) {
    console.error('Error during capture:', error);
  } finally {
    if (browser) {
      await browser.close();
    }
    console.log('Done.');
    process.exit(0);
  }
})();
