import puppeteer from 'puppeteer-core';

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function main() {
  console.log('Launching Chromium...');
  const browser = await puppeteer.launch({
    executablePath: '/data/data/com.termux/files/usr/bin/chromium-browser',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });

  console.log('Navigating to http://localhost:5173...');
  await page.goto('http://localhost:5173', { waitUntil: 'load', timeout: 30000 });
  await sleep(3000);

  // Screenshot 1: Initial load
  await page.screenshot({ path: '/data/data/com.termux/files/home/chili-visual-01-initial.png', fullPage: false });
  console.log('✓ Screenshot 1: Initial app load');

  // Get page content
  const pageTitle = await page.title();
  const bodyText = await page.evaluate(() => document.body.innerText.substring(0, 2000));
  console.log(`\nPage title: ${pageTitle}`);
  console.log(`Page text preview:\n${bodyText.substring(0, 500)}\n`);

  // Check for key elements
  const elements = await page.evaluate(() => {
    return {
      hasSmartCreate: document.body.innerText.includes('Smart Create'),
      hasTextarea: document.querySelectorAll('textarea').length,
      hasFileInput: document.querySelectorAll('input[type="file"]').length,
      hasButtons: document.querySelectorAll('button').length,
      hasAnalyzeButton: Array.from(document.querySelectorAll('button')).some(b => b.textContent.includes('Analyze')),
      hasCreateButton: Array.from(document.querySelectorAll('button')).some(b => b.textContent.includes('Create')),
    };
  });
  console.log('Element check:', elements);

  // Screenshot 2: Full page
  await page.screenshot({ path: '/data/data/com.termux/files/home/chili-visual-02-fullpage.png', fullPage: true });
  console.log('✓ Screenshot 2: Full page');

  // Try to interact with textarea if it exists
  if (elements.hasTextarea > 0) {
    console.log('Found textarea, attempting to type...');
    const textarea = await page.$('textarea');
    if (textarea) {
      await textarea.click();
      await textarea.type('Test prompt for visual verification');
      await sleep(1000);
      await page.screenshot({ path: '/data/data/com.termux/files/home/chili-visual-03-text-entered.png' });
      console.log('✓ Screenshot 3: Text entered in textarea');
    }
  }

  // Try to click Analyze button if it exists
  if (elements.hasAnalyzeButton) {
    console.log('Found Analyze button, attempting to click...');
    const buttons = await page.$$('button');
    for (const button of buttons) {
      const text = await page.evaluate(el => el.textContent, button);
      if (text && text.includes('Analyze')) {
        try {
          await button.click();
          await sleep(1500);
          await page.screenshot({ path: '/data/data/com.termux/files/home/chili-visual-04-after-analyze.png' });
          console.log('✓ Screenshot 4: After clicking Analyze');
        } catch (err) {
          console.log('⚠ Could not click Analyze:', err.message);
        }
        break;
      }
    }
  }

  // Final screenshot
  await sleep(2000);
  await page.screenshot({ path: '/data/data/com.termux/files/home/chili-visual-05-final.png' });
  console.log('✓ Screenshot 5: Final state');

  await browser.close();
  console.log('\n✓ Visual testing complete - screenshots saved to ~/chili-visual-*.png');
}

main().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
