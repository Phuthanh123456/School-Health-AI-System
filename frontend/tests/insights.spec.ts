import { expect, test } from '@playwright/test'

const stats = { total_students: 480, checkups_completed: 420, followups_pending: 36 }
const snapshot = { aggregates: stats, session_title: 'Synthetic school checkup', session_date: '2026-11-04' }
const result = { summary: '420/480 học sinh đã khám.', recommendations: ['Rà soát lịch khám toàn trường.'], disclaimer: 'Chỉ tham khảo, không phải chẩn đoán.', aggregates: stats }
const apiOrigin = 'http://127.0.0.1:18081'

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => { if (location.pathname === '/admin') sessionStorage.setItem('schoolhealth.auth-session', JSON.stringify({
    accessToken: 'synthetic-admin-session', expiresAt: Date.now() + 600000,
  })) })
  await page.route('**/auth/me', async route => {
    expect(new URL(route.request().url()).origin).toBe(apiOrigin)
    await route.fulfill({ json: { id: 'synthetic-admin', email: 'admin@example.test', role: 'admin' } })
  })
  await page.route('**/api/admin/dashboard-statistics', async route => {
    expect(new URL(route.request().url()).origin).toBe(apiOrigin)
    expect(route.request().headers().authorization).toBe('Bearer synthetic-admin-session')
    await route.fulfill({ json: snapshot })
  })
})

test('Admin dashboard uses authenticated API origin and aggregate-only payload', async ({ page }) => {
  let calls = 0
  await page.route('**/api/admin/ai-insights', async route => {
    calls++
    expect(route.request().url()).toBe(`${apiOrigin}/api/admin/ai-insights`)
    expect(route.request().headers().authorization).toBe('Bearer synthetic-admin-session')
    expect(route.request().postDataJSON()).toEqual(stats)
    await new Promise(resolve => setTimeout(resolve, 300))
    await route.fulfill({ json: result })
  })
  await page.goto('/admin')
  await expect(page.getByLabel('Tổng học sinh', { exact: true })).toHaveText('480')
  await expect(page.getByRole('spinbutton')).toHaveCount(0)
  await expect(page.getByRole('textbox')).toHaveCount(0)
  await page.getByRole('button', { name: 'Generate AI Insights' }).click()
  await expect(page.getByRole('button', { name: 'Đang tạo nhận xét…' })).toBeDisabled()
  await expect(page.getByText(result.summary)).toBeVisible()
  expect(calls).toBe(1)
})

for (const status of [403, 422, 502, 503, 504]) {
  test(`API ${status} preserves dashboard and supports retry`, async ({ page }) => {
    await page.route('**/api/admin/ai-insights', route => route.fulfill({ status, json: { detail: 'private provider details' } }))
    await page.goto('/admin')
    await page.getByRole('button', { name: 'Generate AI Insights' }).click()
    await expect(page.getByRole('alert')).toBeVisible()
    await expect(page.getByRole('alert')).not.toContainText('private provider')
    await expect(page.getByLabel('Tổng học sinh', { exact: true })).toHaveText('480')
    await expect(page.getByRole('button', { name: 'Generate AI Insights' })).toBeEnabled()
  })
}

test('stale database counts require refresh and clear prior result', async ({ page }) => {
  await page.route('**/api/admin/ai-insights', route => route.fulfill({ status: 409 }))
  await page.goto('/admin')
  await page.getByRole('button', { name: 'Generate AI Insights' }).click()
  await expect(page.getByRole('alert')).toContainText('Thống kê đã thay đổi')
  await expect(page.getByRole('button', { name: 'Generate AI Insights' })).toBeDisabled()
  await page.route('**/api/admin/dashboard-statistics', route => route.fulfill({ json: { ...snapshot, aggregates: { ...stats, total_students: 500 } } }))
  await page.getByRole('button', { name: 'Tải lại thống kê' }).click()
  await expect(page.getByLabel('Tổng học sinh', { exact: true })).toHaveText('500')
  await expect(page.getByRole('button', { name: 'Generate AI Insights' })).toBeEnabled()
  await expect(page.getByRole('alert')).toHaveCount(0)
})

test('network failure and timeout preserve counts', async ({ page }) => {
  await page.route('**/api/admin/ai-insights', route => route.abort())
  await page.goto('/admin')
  await page.getByRole('button', { name: 'Generate AI Insights' }).click()
  await expect(page.getByRole('alert')).toContainText('Không kết nối')
  await page.route('**/api/admin/ai-insights', async () => {})
  await page.clock.install()
  await page.getByRole('button', { name: 'Generate AI Insights' }).click()
  await page.clock.fastForward(26000)
  await expect(page.getByRole('alert')).toContainText('hết thời gian')
  await expect(page.getByLabel('Đã khám', { exact: true })).toHaveText('420')
})

test('expired session during generation redirects to login', async ({ page }) => {
  await page.route('**/api/admin/ai-insights', route => route.fulfill({ status: 401 }))
  await page.goto('/admin')
  await page.getByRole('button', { name: 'Generate AI Insights' }).click()
  await expect(page).toHaveURL(/\/login$/)
  expect(await page.evaluate(() => sessionStorage.getItem('schoolhealth.auth-session'))).toBeNull()
})

for (const data of [null, { ...result, aggregates: { ...stats, total_students: 1 } }]) {
  test(`invalid or mismatched AI result is hidden: ${JSON.stringify(data)}`, async ({ page }) => {
    await page.route('**/api/admin/ai-insights', route => route.fulfill({ body: JSON.stringify(data), contentType: 'application/json' }))
    await page.goto('/admin')
    await page.getByRole('button', { name: 'Generate AI Insights' }).click()
    await expect(page.getByRole('alert')).toContainText('chưa hợp lệ')
    await expect(page.getByRole('heading', { name: 'Tóm tắt do AI hỗ trợ' })).toHaveCount(0)
  })
}

test('statistics unavailable state retries without fabricated counts', async ({ page }) => {
  await page.route('**/api/admin/dashboard-statistics', route => route.fulfill({ status: 503 }))
  await page.goto('/admin')
  await expect(page.getByRole('alert')).toContainText('Chưa tải được thống kê')
  await expect(page.getByRole('button', { name: 'Generate AI Insights' })).toHaveCount(0)
  await page.route('**/api/admin/dashboard-statistics', route => route.fulfill({ json: snapshot }))
  await page.getByRole('button', { name: 'Tải lại thống kê' }).click()
  await expect(page.getByLabel('Tổng học sinh', { exact: true })).toHaveText('480')
})

test('empty school blocks generation and keeps disclaimer', async ({ page }) => {
  await page.route('**/api/admin/dashboard-statistics', route => route.fulfill({ json: { session_title: null, session_date: null, aggregates: { total_students: 0, checkups_completed: 0, followups_pending: 0 } } }))
  await page.goto('/admin')
  await expect(page.getByText('Chưa có học sinh trong hệ thống.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Generate AI Insights' })).toBeDisabled()
  await expect(page.getByText(/AI chỉ cung cấp thông tin tham khảo/)).toBeVisible()
})

test('refresh cancels an in-flight response so old results cannot reappear', async ({ page }) => {
  let release: () => void = () => {}
  const wait = new Promise<void>(resolve => { release = resolve })
  await page.route('**/api/admin/ai-insights', async route => {
    await wait
    await route.fulfill({ json: result }).catch(() => {})
  })
  await page.goto('/admin')
  await page.getByRole('button', { name: 'Generate AI Insights' }).click()
  await page.getByRole('button', { name: 'Tải lại thống kê' }).click()
  release()
  await expect(page.getByRole('button', { name: 'Generate AI Insights' })).toBeEnabled()
  await expect(page.getByText(result.summary)).toHaveCount(0)
})
