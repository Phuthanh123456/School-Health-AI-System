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

test('Admin overview communicates zero results without hiding the exact zero counts', async ({ page }) => {
  await page.addInitScript(() => {
    sessionStorage.setItem('schoolhealth.auth-session', JSON.stringify({ accessToken: 'test-admin-token', expiresAt: Date.now() + 3600000 }))
  })
  await page.route('**/auth/me', route => route.fulfill({ status: 200, json: { id: 'admin', email: 'admin@schoolhealth.example', role: 'admin' } }))
  await page.route('**/api/admin/dashboard', route => route.fulfill({
    status: 200,
    json: { total_students: 0, completed_checkups: 0, status_counts: { normal: 0, needs_follow_up: 0 } },
  }))

  await page.goto('/admin/overview')

  await expect(page.getByLabel('0 students')).toBeVisible()
  await expect(page.getByLabel('0 completed checkups')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'No completed checkups yet' })).toBeVisible()
  await expect(page.getByRole('table', { name: 'Exact counts for the checkup status chart' })).toContainText('0')
})

test('Admin overview reserves space and announces the initial loading state', async ({ page }) => {
  await page.addInitScript(() => {
    sessionStorage.setItem('schoolhealth.auth-session', JSON.stringify({ accessToken: 'test-admin-token', expiresAt: Date.now() + 3600000 }))
  })
  await page.route('**/auth/me', route => route.fulfill({ status: 200, json: { id: 'admin', email: 'admin@schoolhealth.example', role: 'admin' } }))
  await page.route('**/api/admin/dashboard', async (route) => {
    await new Promise(resolve => setTimeout(resolve, 350))
    await route.fulfill({ status: 200, json: { total_students: 1, completed_checkups: 1, status_counts: { normal: 1, needs_follow_up: 0 } } })
  })

  await page.goto('/admin/overview')
  await expect(page.getByRole('region', { name: 'Loading school health statistics' })).toBeVisible()
  await expect(page.getByText('Loading school health statistics…')).toBeAttached()
  await expect(page.getByLabel('1 students')).toBeVisible()
})

test('Admin overview shows loading feedback and retries a failed aggregate request', async ({ page }) => {
  await page.addInitScript(() => {
    sessionStorage.setItem('schoolhealth.auth-session', JSON.stringify({ accessToken: 'test-admin-token', expiresAt: Date.now() + 3600000 }))
  })
  await page.route('**/auth/me', route => route.fulfill({ status: 200, json: { id: 'admin', email: 'admin@schoolhealth.example', role: 'admin' } }))
  let attempts = 0
  await page.route('**/api/admin/dashboard', async (route) => {
    attempts += 1
    // StrictMode intentionally mounts effects twice in development; fail both
    // initial calls so the visible retry action is tested deterministically.
    if (attempts <= 2) {
      await route.fulfill({ status: 503, json: { detail: 'temporarily unavailable' } })
      return
    }
    await route.fulfill({ status: 200, json: { total_students: 2, completed_checkups: 1, status_counts: { normal: 1, needs_follow_up: 0 } } })
  })

  await page.goto('/admin/overview')
  await expect(page.getByRole('alert')).toContainText('could not be loaded')
  await page.getByRole('button', { name: 'Try again' }).click()
  await expect(page.getByLabel('2 students')).toBeVisible()
  await expect(page.getByRole('alert')).toHaveCount(0)
  expect(attempts).toBeGreaterThanOrEqual(3)
})
