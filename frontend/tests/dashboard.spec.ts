import { expect, test } from '@playwright/test'

test('Admin school overview renders database aggregates and the status chart', async ({ page }) => {
  await page.addInitScript(() => {
    sessionStorage.setItem('schoolhealth.auth-session', JSON.stringify({
      accessToken: 'test-admin-token',
      expiresAt: Date.now() + 60 * 60 * 1000,
    }))
  })
  await page.route('**/auth/me', async (route) => {
    await route.fulfill({
      status: 200,
      json: { id: 'admin', email: 'admin@schoolhealth.example', role: 'admin' },
    })
  })
  await page.route('**/api/admin/dashboard', async (route) => {
    await route.fulfill({
      status: 200,
      json: {
        total_students: 24,
        completed_checkups: 41,
        status_counts: { normal: 33, needs_follow_up: 8 },
      },
    })
  })

  await page.goto('/admin/overview')

  await expect(page.getByRole('heading', { name: 'School overview' })).toBeVisible()
  await expect(page.getByLabel('24 students')).toBeVisible()
  await expect(page.getByLabel('41 completed checkups')).toBeVisible()
  await expect(page.getByLabel('33 normal')).toBeVisible()
  await expect(page.getByLabel('8 needs follow-up')).toBeVisible()
  await expect(page.getByRole('img', {
    name: 'Checkup status distribution: 33 Normal records and 8 Needs follow-up records',
  })).toBeVisible()
})
