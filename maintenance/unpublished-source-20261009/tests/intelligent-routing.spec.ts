import { test, expect } from '@playwright/test'

test.describe('Intelligent Routing System', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    // Wait for app to load
    await page.waitForSelector('[data-testid="mobile-nav"]', { timeout: 10000 })
  })

  test('FAB opens Quick Create bottom sheet', async ({ page }) => {
    // Click the FAB (center button in mobile nav)
    const fab = page.locator('button[aria-label="Quick create"]')
    await fab.click()

    // Bottom sheet should appear with title
    await expect(page.locator('text=Quick Create')).toBeVisible()
    
    // SmartActionBar should be visible
    await expect(page.locator('text=Smart Create')).toBeVisible()
  })

  test('SmartActionBar accepts text input', async ({ page }) => {
    // Open Quick Create
    await page.locator('button[aria-label="Quick create"]').click()
    
    // Find textarea and type
    const textarea = page.locator('textarea[placeholder*="Describe what you want"]')
    await textarea.fill('create a beautiful portrait')
    
    // Verify text was entered
    await expect(textarea).toHaveValue('create a beautiful portrait')
  })

  test('Analyze button shows routing decision', async ({ page }) => {
    // Open Quick Create
    await page.locator('button[aria-label="Quick create"]').click()
    
    // Enter prompt
    const textarea = page.locator('textarea')
    await textarea.fill('create a beautiful landscape')
    
    // Click Analyze
    const analyzeButton = page.locator('button:has-text("Analyze")')
    await analyzeButton.click()
    
    // Routing decision should appear
    await expect(page.locator('text=create from scratch')).toBeVisible()
    await expect(page.locator('text=/Cloud GPU|Local/')).toBeVisible()
    await expect(page.locator('text=/\\d+% match/')).toBeVisible()
  })

  test('NSFW prompt routes to best quality', async ({ page }) => {
    await page.locator('button[aria-label="Quick create"]').click()
    
    const textarea = page.locator('textarea')
    await textarea.fill('create a nude portrait with high quality')
    
    await page.locator('button:has-text("Analyze")').click()
    
    // Should show "best" quality
    await expect(page.locator('text=best quality')).toBeVisible()
    // Should route to cloud
    await expect(page.locator('text=Cloud GPU')).toBeVisible()
  })

  test('Photo attachment updates image count', async ({ page }) => {
    await page.locator('button[aria-label="Quick create"]').click()
    
    // Set up file chooser handler before clicking
    const fileChooserPromise = page.waitForEvent('filechooser')
    
    // Click Photos button
    await page.locator('button:has-text("Photos")').click()
    
    const fileChooser = await fileChooserPromise
    
    // Upload test images
    await fileChooser.setFiles([
      'tests/fixtures/test-image-1.jpg',
      'tests/fixtures/test-image-2.jpg',
    ])
    
    // Button should show "2 photos"
    await expect(page.locator('button:has-text("2 photos")')).toBeVisible()
  })

  test('Create button starts generation', async ({ page }) => {
    await page.locator('button[aria-label="Quick create"]').click()
    
    // Enter prompt
    await page.locator('textarea').fill('create a portrait')
    
    // Analyze first
    await page.locator('button:has-text("Analyze")').click()
    
    // Wait for routing decision
    await expect(page.locator('text=create from scratch')).toBeVisible()
    
    // Click Create
    await page.locator('button:has-text("Create")').click()
    
    // Job status should appear
    await expect(page.locator('text=/Venice API|Local Dream|Atelier GPU/')).toBeVisible()
    await expect(page.locator('text=/Queued|Starting|Generating/')).toBeVisible()
  })

  test('Generation progress bar displays', async ({ page }) => {
    await page.locator('button[aria-label="Quick create"]').click()
    await page.locator('textarea').fill('create a landscape')
    await page.locator('button:has-text("Analyze")').click()
    await page.locator('button:has-text("Create")').click()
    
    // Progress bar should be visible
    const progressBar = page.locator('[role="progressbar"], .bg-gradient-to-r')
    await expect(progressBar).toBeVisible()
    
    // Progress percentage should update
    await expect(page.locator('text=/\\d+%/')).toBeVisible()
  })

  test('Edit photo routes correctly', async ({ page }) => {
    await page.locator('button[aria-label="Quick create"]').click()
    
    await page.locator('textarea').fill('edit this photo to remove background')
    
    await page.locator('button:has-text("Analyze")').click()
    
    // Should detect remove_background intent
    await expect(page.locator('text=remove background')).toBeVisible()
  })

  test('Upscale routes to cloud', async ({ page }) => {
    await page.locator('button[aria-label="Quick create"]').click()
    
    await page.locator('textarea').fill('upscale this image to 4k')
    
    await page.locator('button:has-text("Analyze")').click()
    
    // Should route to cloud for best quality
    await expect(page.locator('text=Cloud GPU')).toBeVisible()
    await expect(page.locator('text=upscale')).toBeVisible()
  })

  test('Bottom sheet closes on backdrop click', async ({ page }) => {
    await page.locator('button[aria-label="Quick create"]').click()
    
    // Verify sheet is open
    await expect(page.locator('text=Quick Create')).toBeVisible()
    
    // Click backdrop
    await page.locator('.bg-black\\/65').click()
    
    // Sheet should close
    await expect(page.locator('text=Quick Create')).not.toBeVisible()
  })

  test('Bottom sheet closes on Escape key', async ({ page }) => {
    await page.locator('button[aria-label="Quick create"]').click()
    
    await expect(page.locator('text=Quick Create')).toBeVisible()
    
    // Press Escape
    await page.keyboard.press('Escape')
    
    await expect(page.locator('text=Quick Create')).not.toBeVisible()
  })

  test('Job status shows completion', async ({ page }) => {
    await page.locator('button[aria-label="Quick create"]').click()
    await page.locator('textarea').fill('create a portrait')
    await page.locator('button:has-text("Analyze")').click()
    await page.locator('button:has-text("Create")').click()
    
    // Wait for completion (mock completes in ~3 seconds)
    await expect(page.locator('text=Complete')).toBeVisible({ timeout: 10000 })
    
    // Success icon should appear
    const successIcon = page.locator('svg').filter({ has: page.locator('polyline') })
    await expect(successIcon).toBeVisible()
  })

  test('Empty prompt disables Analyze button', async ({ page }) => {
    await page.locator('button[aria-label="Quick create"]').click()
    
    const analyzeButton = page.locator('button:has-text("Analyze")')
    
    // Should be disabled when empty
    await expect(analyzeButton).toBeDisabled()
    
    // Enter text
    await page.locator('textarea').fill('test')
    
    // Should be enabled
    await expect(analyzeButton).toBeEnabled()
  })
})
