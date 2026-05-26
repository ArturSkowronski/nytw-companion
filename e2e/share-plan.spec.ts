import { test, expect } from '@playwright/test'

test.beforeEach(async ({ context }) => {
  await context.addInitScript(() => {
    window.localStorage.clear()
  })
})

test('share my plan → recipient adds an event to their plan', async ({ browser }) => {
  // ─── Sender flow ────────────────────────────────────────────────────────
  // newContext() already provides isolated, empty storage — no need to clear.
  const sender = await browser.newContext()
  const senderPage = await sender.newPage()

  await senderPage.goto('/events')
  await senderPage.getByPlaceholder(/search/i).fill('AI')

  const firstCard = senderPage.getByTestId('event-card').first()
  await expect(firstCard).toBeVisible({ timeout: 5000 })
  await firstCard.click()
  const modal = senderPage.getByRole('dialog')
  await expect(modal).toBeVisible()
  await modal.getByRole('button', { name: /save to plan/i }).click()
  await senderPage.keyboard.press('Escape')

  await senderPage.goto('/my-plan')
  await senderPage.getByRole('button', { name: /share my plan/i }).click()
  const urlInput = senderPage.getByRole('textbox', { name: /share link/i })
  await expect(urlInput).toBeVisible()
  const shareUrl = await urlInput.inputValue()
  expect(shareUrl).toMatch(/\/plan\/share#.+/)
  await sender.close()

  // ─── Recipient flow (fresh context = empty localStorage) ────────────────
  // newContext() already provides isolated, empty storage — no need to clear.
  const recipient = await browser.newContext()
  const recipientPage = await recipient.newPage()

  await recipientPage.goto(shareUrl)
  await expect(recipientPage.getByText(/shared nytw plan/i)).toBeVisible({ timeout: 5000 })

  const addBtn = recipientPage.getByRole('button', { name: /add to my plan/i }).first()
  await expect(addBtn).toBeVisible()
  await addBtn.click()
  await expect(recipientPage.getByText(/in your plan/i).first()).toBeVisible({ timeout: 3000 })

  // The recipient's own /my-plan should now have exactly one event.
  await recipientPage.goto('/my-plan')
  await expect(recipientPage.getByText(/your plan/i)).toBeVisible()
  await expect(recipientPage.getByText(/1 events/i)).toBeVisible()
  await recipient.close()
})
