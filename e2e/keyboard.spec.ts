import { test, expect } from '@playwright/test'

test('? opens HelpModal; Esc closes; m toggles map on /events', async ({ page }) => {
  await page.goto('/events')

  // Wait for hydration so the keydown listeners are mounted.
  await page.waitForLoadState('networkidle')

  // Click body to ensure focus is on the document before firing keyboard events.
  await page.locator('body').click()

  await page.keyboard.press('?')
  await expect(page.getByText(/keyboard shortcuts/i)).toBeVisible({ timeout: 3000 })

  await page.keyboard.press('Escape')
  await expect(page.getByText(/keyboard shortcuts/i)).not.toBeVisible()

  await page.keyboard.press('m')
  await expect(page).toHaveURL(/view=map/)

  await page.keyboard.press('m')
  await expect(page).not.toHaveURL(/view=map/)
})
