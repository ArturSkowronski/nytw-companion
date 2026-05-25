import { test, expect } from '@playwright/test'

test("filters drawer: toggle Editor's Picks → URL + chip + counter", async ({ page }) => {
  await page.goto('/events')

  await page.getByRole('button', { name: /filters/i }).click()

  // Drawer opens — SheetTitle reads "Filters"; Base UI Sheet renders as role=dialog.
  await expect(page.getByRole('dialog', { name: /filters/i })).toBeVisible()

  // Click the label to toggle the checkbox (more reliable than .check() across navigation).
  await page.getByText(/editor.s picks only/i).click()

  await expect(page).toHaveURL(/editorsPicks=1/)
  await expect(page.getByText(/showing \d+ of \d+ events/i)).toBeVisible()

  // Close drawer
  await page.keyboard.press('Escape')

  // Active-chip remove button — uses the aria-label from ActiveFiltersBar.
  await page.getByRole('button', { name: /remove editor.s picks filter/i }).click()
  await expect(page).not.toHaveURL(/editorsPicks/)
})
