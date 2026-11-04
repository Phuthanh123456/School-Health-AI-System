import { expect, test } from '@playwright/test'

test('protected Admin route still redirects guests to login', async ({ page }) => {
  await page.goto('/admin')
  await expect(page).toHaveURL(/\/login$/)
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible()
})

test('signed-in Admin workspace links to the existing AI demo', async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem('schoolhealth.auth-session', JSON.stringify({
    accessToken: 'synthetic-session', expiresAt: Date.now() + 60000,
  })))
  await page.route('**/auth/me', route => route.fulfill({ json: {
    id: 'synthetic-admin', email: 'admin@example.test', role: 'admin',
  } }))
  await page.goto('/admin')
  await expect(page.getByRole('heading', { name: 'Administrator workspace' })).toBeVisible()
  await page.getByRole('link', { name: 'AI Insights demo' }).click()
  await expect(page.getByRole('button', { name: 'Generate AI Insights' })).toBeVisible()
  await expect(page).toHaveURL(/\/#admin$/)
})
