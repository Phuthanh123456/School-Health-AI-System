import { expect, test, type Page } from '@playwright/test'

async function restoreAs(page: Page, role: 'admin' | 'nurse' | 'parent') {
  await page.addInitScript(() => sessionStorage.setItem('schoolhealth.auth-session', JSON.stringify({
    accessToken: 'synthetic-shell-token',
    expiresAt: Date.now() + 60 * 60 * 1000,
  })))
  await page.route('**/auth/me', route => route.fulfill({ status: 200, json: { id: `demo-${role}`, email: `${role}@example.test`, role } }))
}

test('restores an Admin session on a deep link and shows shared role navigation', async ({ page }) => {
  await restoreAs(page, 'admin')
  await page.route('**/api/admin/dashboard', route => route.fulfill({ status: 200, json: {
    total_students: 0, completed_checkups: 0, status_counts: { normal: 0, needs_follow_up: 0 },
  } }))

  await page.goto('/admin/insights')

  await expect(page).toHaveURL(/\/admin\/insights$/)
  await expect(page.getByRole('heading', { name: 'School overview' })).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'admin navigation' }).getByRole('link', { name: /School overview/ })).toHaveAttribute('aria-current', 'page')
  await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible()
})

test('keeps Admin management reachable from the shared sidebar', async ({ page }) => {
  await restoreAs(page, 'admin')
  await page.route('**/api/admin/health-records/options', route => route.fulfill({ status: 200, json: { classes: [], parents: [], nurses: [] } }))
  await page.route('**/api/admin/health-records?**', route => route.fulfill({ status: 200, json: { items: [], total: 0, page: 1, page_size: 10 } }))

  await page.goto('/admin')

  await expect(page.getByRole('heading', { name: 'Health management' })).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'admin navigation' }).getByRole('link', { name: /Health management/ })).toHaveAttribute('aria-current', 'page')
})

test('preserves Nurse profile and checkup navigation without changing the route', async ({ page }) => {
  await restoreAs(page, 'nurse')
  await page.route('**/students', route => route.fulfill({ status: 200, json: [] }))
  await page.route('**/checkups/sessions', route => route.fulfill({ status: 200, json: [] }))

  await page.goto('/nurse')
  await expect(page.getByRole('heading', { name: 'Student health profiles' })).toBeVisible()
  await page.getByRole('button', { name: /Checkup sessions/ }).click()

  await expect(page).toHaveURL(/\/nurse$/)
  await expect(page.getByRole('combobox')).toBeVisible()
  await page.getByRole('button', { name: /Student profiles/ }).click()
  await expect(page.getByRole('heading', { name: 'Student health profiles' })).toBeVisible()
})

test('keeps Parent deep links and blocks another role from Admin', async ({ page }) => {
  await restoreAs(page, 'parent')
  await page.route('**/api/parent/dashboard', route => route.fulfill({ status: 200, json: {
    parent: { id: 'PARENT-DEMO', email: 'parent@example.test', full_name: 'Demo Guardian', phone: null, relationship: 'Guardian' },
    children: [],
  } }))

  await page.goto('/admin/overview')

  await expect(page).toHaveURL(/\/parent$/)
  await expect(page.getByRole('heading', { name: "Your family's health" })).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'parent navigation' }).getByRole('link', { name: /Family health/ })).toHaveAttribute('aria-current', 'page')
  await expect(page.getByRole('navigation', { name: 'parent navigation' }).getByRole('link', { name: /School overview/ })).toHaveCount(0)
})

test('mobile navigation closes on Escape and returns focus to the menu trigger', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await restoreAs(page, 'parent')
  await page.route('**/api/parent/dashboard', route => route.fulfill({ status: 200, json: {
    parent: { id: 'PARENT-DEMO', email: 'parent@example.test', full_name: 'Demo Guardian', phone: null, relationship: null },
    children: [],
  } }))

  await page.goto('/parent')
  const trigger = page.getByRole('button', { name: 'Open navigation' })
  await trigger.click()
  await expect(page.getByRole('dialog', { name: 'Mobile navigation' })).toBeVisible()
  await expect(page.getByRole('dialog').getByRole('link', { name: /Family health/ })).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog', { name: 'Mobile navigation' })).toHaveCount(0)
  await expect(trigger).toBeFocused()
})
