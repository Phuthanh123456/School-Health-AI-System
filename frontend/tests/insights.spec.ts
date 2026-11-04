import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  const origin = 'http://127.0.0.1:5175'
  await page.addInitScript(() => {
    sessionStorage.setItem('schoolhealth.auth-session', JSON.stringify({
      accessToken: 'test-admin-token',
      expiresAt: Date.now() + 60 * 60 * 1000,
    }))
  })
  await page.route('**/auth/me', async route => {
    const headers = {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Headers': 'authorization,content-type',
      'Access-Control-Allow-Methods': 'GET,OPTIONS',
    }
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers })
      return
    }
    await route.fulfill({
      status: 200,
      headers,
      json: { id: 'admin', email: 'admin@schoolhealth.example', role: 'admin' },
    })
  })
  await page.goto('/admin')
  await page.getByLabel('Thông tin truy cập quản trị (môi trường phát triển)').fill('test-admin')
})

test('loading, duplicate prevention, exact aggregate payload and results', async ({ page }) => {
  let calls = 0
  await page.route('**/api/admin/ai-insights', async route => {
    calls++
    expect(route.request().postDataJSON()).toEqual({total_students:480, checkups_completed:420, followups_pending:36, vision_flags:84, dental_flags:63})
    await new Promise(resolve => setTimeout(resolve, 300))
    await route.fulfill({json:{summary:'420/480 học sinh đã khám.', recommendations:['Rà soát lịch khám toàn trường.'], disclaimer:'Chỉ tham khảo, không phải chẩn đoán.', aggregates:{}}})
  })
  await page.getByRole('button', { name:'Generate AI Insights' }).click()
  await expect(page.getByRole('button', { name:'Đang tạo nhận xét…' })).toBeDisabled()
  await expect(page.getByText('420/480 học sinh đã khám.')).toBeVisible()
  expect(calls).toBe(1)
  await page.getByLabel('Đã khám', {exact:true}).fill('400')
  await expect(page.getByText('420/480 học sinh đã khám.')).not.toBeVisible()
})

for (const status of [403,422,502,503,504]) {
  test(`API ${status} preserves dashboard and supports retry`, async ({ page }) => {
    await page.route('**/api/admin/ai-insights', route => route.fulfill({status,json:{detail:'private provider details must not be shown'}}))
    await page.getByRole('button', {name:'Generate AI Insights'}).click()
    await expect(page.getByRole('alert')).toBeVisible()
    await expect(page.getByRole('alert')).not.toContainText('private provider')
    await expect(page.getByLabel('Tổng học sinh', {exact:true})).toHaveValue('480')
    await expect(page.getByRole('button', {name:'Generate AI Insights'})).toBeEnabled()
  })
}

test('network failure and client timeout keep dashboard usable', async ({ page }) => {
  await page.route('**/api/admin/ai-insights', route => route.abort())
  await page.getByRole('button', {name:'Generate AI Insights'}).click()
  await expect(page.getByRole('alert')).toContainText('Không kết nối')
  await page.unrouteAll({behavior:'ignoreErrors'})
  await page.route('**/api/admin/ai-insights', async () => {})
  await page.clock.install()
  await page.getByRole('button', {name:'Generate AI Insights'}).click()
  await page.clock.fastForward(26000)
  await expect(page.getByRole('alert')).toContainText('hết thời gian')
  await expect(page.getByLabel('Đã khám', {exact:true})).toHaveValue('420')
})

test('late response cannot display stale counts and credentials are not persisted', async ({ page }) => {
  let release: () => void = () => {}
  const wait = new Promise<void>(resolve => { release = resolve })
  await page.route('**/api/admin/ai-insights', async route => {
    await wait
    await route.fulfill({json:{summary:'Old result',recommendations:[],disclaimer:'Info'}}).catch(()=>{})
  })
  await page.getByRole('button', {name:'Generate AI Insights'}).click()
  await page.getByLabel('Tổng học sinh', {exact:true}).fill('500')
  release()
  await expect(page.getByText('Old result')).not.toBeVisible()
  await page.reload()
  await expect(page.getByLabel('Thông tin truy cập quản trị (môi trường phát triển)')).toHaveValue('')
  await expect(page.getByRole('button', {name:'Generate AI Insights'})).toBeDisabled()
})
