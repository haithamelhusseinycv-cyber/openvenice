import puppeteer from 'puppeteer-core';

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function main() {
  console.log('Launching Chromium...');
  const browser = await puppeteer.launch({
    executablePath: '/data/data/com.termux/files/usr/bin/chromium-browser',
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--window-size=390,844',
    ],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 3 });

  console.log('Navigating to http://localhost:5173...');
  await page.goto('http://localhost:5173', { waitUntil: 'load', timeout: 30000 });
  await sleep(3000);

  // Test 1: Initial load
  await page.screenshot({ path: '/data/data/com.termux/files/home/chili-visual-01-initial.png' });
  console.log('✓ Screenshot 1: Initial app load');

  // Test 2: Navigate to Noor (playground)
  console.log('Looking for Noor tab...');
  const noorTab = await page.$('text=Noor');
  if (noorTab) {
    await noorTab.click();
    await sleep(1500);
    console.log('✓ Clicked Noor tab');
  } else {
    console.log('⚠ Noor tab not found, may already be active');
  }
  await page.screenshot({ path: '/data/data/com.termux/files/home/chili-visual-02-playground.png' });
  console.log('✓ Screenshot 2: Playground view');

  // Test 3: Look for SmartActionBar
  console.log('Looking for SmartActionBar...');
  const smartActionBar = await page.$('text=Smart Create');
  if (smartActionBar) {
    console.log('✓ SmartActionBar found');
  } else {
    console.log('⚠ SmartActionBar not visible, scrolling...');
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await sleep(1000);
  }
  await page.screenshot({ path: '/data/data/com.termux/files/home/chili-visual-03-smartactionbar.png' });
  console.log('✓ Screenshot 3: SmartActionBar');

  // Test 4: Enter text in SmartActionBar
  console.log('Entering text prompt...');
  const textarea = await page.$('textarea[placeholder*="Describe"]');
  if (textarea) {
    await textarea.type('A beautiful sunset over mountains with dramatic clouds');
    await sleep(1000);
    console.log('✓ Text entered');
  } else {
    console.log('⚠ Textarea not found');
  }
  await page.screenshot({ path: '/data/data/com.termux/files/home/chili-visual-04-text-input.png' });
  console.log('✓ Screenshot 4: Text input');

  // Test 5: Click Analyze button
  console.log('Clicking Analyze button...');
  const analyzeButton = await page.$('button:has-text("Analyze")');
  if (analyzeButton) {
    await analyzeButton.click();
    await sleep(1500);
    console.log('✓ Analyze button clicked');
  } else {
    console.log('⚠ Analyze button not found');
  }
  await page.screenshot({ path: '/data/data/com.termux/files/home/chili-visual-05-routing-decision.png' });
  console.log('✓ Screenshot 5: Routing decision');

  // Test 6: Check for routing preview
  console.log('Checking for routing preview...');
  const routingPreview = await page.$('text=create from scratch');
  if (routingPreview) {
    console.log('✓ Routing preview displayed');
  } else {
    console.log('⚠ Routing preview not found');
  }
  await page.screenshot({ path: '/data/data/com.termux/files/home/chili-visual-06-routing-preview.png' });
  console.log('✓ Screenshot 6: Routing preview');

  // Test 7: Click Create button
  console.log('Clicking Create button...');
  const createButtons = await page.$$('button');
  let createButton = null;
  for (const btn of createButtons) {
    const text = await page.evaluate(el => el.textContent, btn);
    if (text && text.includes('Create')) {
      createButton = btn;
      break;
    }
  }
  if (createButton) {
    await createButton.click();
    await sleep(3000);
    console.log('✓ Create button clicked');
  } else {
    console.log('⚠ Create button not found');
  }
  await page.screenshot({ path: '/data/data/com.termux/files/home/chili-visual-07-generation.png' });
  console.log('✓ Screenshot 7: Generation');

  // Test 8: Photo attachment
  console.log('Testing photo attachment...');
  const fileInput = await page.$('input[type="file"]');
  if (fileInput) {
    const testImagePath = '/data/data/com.termux/files/home/projects/localdream-unified/public/favicon.svg';
    await fileInput.uploadFile(testImagePath);
    await sleep(1500);
    console.log('✓ Photo attached');
  } else {
    console.log('⚠ File input not found');
  }
  await page.screenshot({ path: '/data/data/com.termux/files/home/chili-visual-08-photo-attached.png' });
  console.log('✓ Screenshot 8: Photo attached');

  // Test 9: Check for error messages
  console.log('Checking for errors...');
  const errorMessages = await page.$$('[role="alert"]');
  console.log(`Found ${errorMessages.length} error messages`);

  // Test 10: Final state
  await sleep(2000);
  await page.screenshot({ path: '/data/data/com.termux/files/home/chili-visual-09-final.png' });
  console.log('✓ Screenshot 9: Final state');

  // Dump page info
  const pageTitle = await page.title();
  const url = page.url();
  console.log(`\nPage title: ${pageTitle}`);
  console.log(`Current URL: ${url}`);

  // Check for key elements
  const elements = {
    smartActionBar: await page.$$('text=Smart Create'),
    analyzeButton: await page.$$('button:has-text("Analyze")'),
    textarea: await page.$$('textarea'),
    fileInput: await page.$$('input[type="file"]'),
  };
  console.log('\nElement counts:', {
    smartActionBar: elements.smartActionBar.length,
    analyzeButton: elements.analyzeButton.length,
    textarea: elements.textarea.length,
    fileInput: elements.fileInput.length,
  });

  await browser.close();
  console.log('\n✓ Visual testing complete');
}

main().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
