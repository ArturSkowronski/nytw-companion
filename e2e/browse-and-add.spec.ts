import { test, expect } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  // Start with an empty plan so the MyPlanWidget count assertion is stable.
  await page.addInitScript(() => {
    window.localStorage.clear()
  })
})

test('landing → browse → search → modal → add to plan', async ({ page }) => {
  await page.goto('/')

  // Click the primary Browse CTA on the landing hero.
  await page.getByRole('link', { name: /browse 87 events/i }).click()
  await expect(page).toHaveURL(/\/events/)

  // Narrow the list with a search term known to match seed events.
  await page.getByPlaceholder(/search/i).fill('AI')

  // Click the first visible event card.
  const firstCard = page.getByTestId('event-card').first()
  await expect(firstCard).toBeVisible({ timeout: 5000 })
  await firstCard.click()

  // EventDetailModal opens (Sheet renders as role=dialog).
  const modal = page.getByRole('dialog')
  await expect(modal).toBeVisible()

  // Save to plan from inside the modal.
  await modal.getByRole('button', { name: /save to plan/i }).click()

  // Toast confirms.
  await expect(page.getByText(/added to your plan/i).first()).toBeVisible({ timeout: 3000 })

  // Close the modal.
  await page.keyboard.press('Escape')
  await expect(modal).not.toBeVisible()

  // MyPlanWidget shows the count somewhere on the page.
  await expect(page.getByText(/my plan \(1\)/i).first()).toBeVisible({ timeout: 3000 })
})
