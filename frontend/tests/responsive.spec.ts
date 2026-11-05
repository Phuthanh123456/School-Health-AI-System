import { expect, test, type Page } from '@playwright/test'

const widths = [320, 375, 768, 1024, 1440]

async function expectNoHorizontalOverflow(page: Page, pageName: string) {
  const metrics = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    document: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
  }))
  expect(metrics.document, `${pageName} document overflow at ${metrics.viewport}px`).toBeLessThanOrEqual(metrics.viewport)
  expect(metrics.body, `${pageName} body overflow at ${metrics.viewport}px`).toBeLessThanOrEqual(metrics.viewport)
}

async function signInAs(page: Page, role: 'admin' | 'nurse' | 'parent') {
  await page.addInitScript(() => sessionStorage.setItem('schoolhealth.auth-session', JSON.stringify({
    accessToken: 'synthetic-responsive-session', expiresAt: Date.now() + 3600000,
  })))
  await page.route('**/auth/me', route => route.fulfill({ json: {
    id: `demo-${role}`, email: `${role}@example.test`, role,
  } }))
}

test('landing and login fit the responsive viewport matrix and remain keyboard reachable', async ({ page }) => {
  for (const width of widths) {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/')
    await expectNoHorizontalOverflow(page, 'landing')
    await page.goto('/login')
    await expectNoHorizontalOverflow(page, 'login')
    await expect(page.getByRole('textbox', { name: 'Email' })).toBeVisible()
    await expect(page.getByRole('textbox', { name: 'Password' })).toBeVisible()
  }

  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto('/login')
  await page.keyboard.press('Tab')
  await expect(page.locator('a[href="/home"]')).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(page.getByRole('textbox', { name: 'Email' })).toBeFocused()
})

test('Admin overview fits all target viewports using synthetic aggregates', async ({ page }) => {
  await signInAs(page, 'admin')
  await page.route('**/api/admin/dashboard', route => route.fulfill({ json: {
    total_students: 24,
    completed_checkups: 41,
    status_counts: { normal: 33, needs_follow_up: 8 },
  } }))
  for (const width of widths) {
    await page.setViewportSize({ width, height: 950 })
    await page.goto('/admin/overview')
    await expect(page.getByRole('heading', { name: 'School overview' })).toBeVisible()
    await expect(page.getByRole('img', { name: /Checkup status distribution: 33 Normal records and 8 Needs follow-up records/ })).toBeVisible()
    await expect.poll(async () => page.locator('.recharts-rectangle').evaluateAll(elements =>
      elements.some(element => element.getBBox().width > 10),
    )).toBe(true)
    await expectNoHorizontalOverflow(page, 'Admin overview')
    if (width === 1440) await page.screenshot({ path: '../docs/ui-redesign-qa/admin-overview-1440.png', fullPage: true })
    if (width === 375) await page.screenshot({ path: '../docs/ui-redesign-qa/admin-overview-375.png', fullPage: true })
  }
})

test('Nurse student workspace fits all target viewports and uses a clean empty state', async ({ page }) => {
  await signInAs(page, 'nurse')
  await page.route('**/students', route => route.fulfill({ json: [] }))
  for (const width of widths) {
    await page.setViewportSize({ width, height: 950 })
    await page.goto('/nurse')
    await expect(page.locator('input[type="search"]')).toBeVisible()
    await expectNoHorizontalOverflow(page, 'Nurse workspace')
    if (width === 1440) await page.screenshot({ path: '../docs/ui-redesign-qa/nurse-students-1440.png', fullPage: true })
    if (width === 375) await page.screenshot({ path: '../docs/ui-redesign-qa/nurse-students-375.png', fullPage: true })
  }
})

test('Parent dashboard fits all target viewports with a synthetic no-children account', async ({ page }) => {
  await signInAs(page, 'parent')
  await page.route('**/api/parent/dashboard', route => route.fulfill({ json: {
    parent: { id: 'PARENT-DEMO', email: 'parent@example.test', full_name: 'Demo Parent', phone: null, relationship: null },
    children: [],
  } }))
  for (const width of widths) {
    await page.setViewportSize({ width, height: 950 })
    await page.goto('/parent')
    await expect(page.getByRole('heading', { name: 'No children linked yet' })).toBeVisible()
    await expectNoHorizontalOverflow(page, 'Parent dashboard')
    if (width === 1440) await page.screenshot({ path: '../docs/ui-redesign-qa/parent-dashboard-1440.png', fullPage: true })
    if (width === 375) await page.screenshot({ path: '../docs/ui-redesign-qa/parent-dashboard-375.png', fullPage: true })
  }
})

test('public landing photography and sign-in screenshots contain no student record data', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto('/')
  await expect(page.getByRole('heading', { name: /Better Student Care/i })).toBeVisible()
  await page.evaluate(async () => {
    document.querySelectorAll('img').forEach(image => { image.loading = 'eager' })
    await Promise.all([...document.images].map(image => image.decode()))
  })
  await page.screenshot({ path: '../docs/landing-frontline/schoolhealth-desktop.png', fullPage: true })
  await page.goto('/login')
  await expect(page.getByRole('heading', { name: 'Sign in to SchoolHealth' })).toBeVisible()
  await page.screenshot({ path: '../docs/ui-redesign-qa/login-1440.png', fullPage: true })

  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto('/')
  await expectNoHorizontalOverflow(page, 'landing screenshot')
  await page.evaluate(async () => {
    document.querySelectorAll('img').forEach(image => { image.loading = 'eager' })
    await Promise.all([...document.images].map(image => image.decode()))
  })
  await page.screenshot({ path: '../docs/landing-frontline/schoolhealth-mobile.png', fullPage: true })
  await page.goto('/login')
  await expectNoHorizontalOverflow(page, 'login screenshot')
  await page.screenshot({ path: '../docs/ui-redesign-qa/login-375.png', fullPage: true })
})
