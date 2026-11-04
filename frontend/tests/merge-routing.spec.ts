import { expect, test } from '@playwright/test'

for (const path of ['/admin', '/#admin']) {
  test(`guests cannot access Admin at ${path}`, async ({ page }) => {
    await page.goto(path)
    await expect(page).toHaveURL(/\/login$/)
    await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible()
  })
}

test('parent cannot enter Admin via old preview bookmark', async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem('schoolhealth.auth-session', JSON.stringify({
    accessToken: 'synthetic-parent', expiresAt: Date.now() + 60000,
  })))
  await page.route('**/auth/me', route => route.fulfill({ json: { id: 'parent', email: 'parent@example.test', role: 'parent' } }))
  await page.goto('/#admin')
  await expect(page).toHaveURL(/\/parent$/)
  await expect(page.getByRole('button', { name: 'Generate AI Insights' })).toHaveCount(0)
})
