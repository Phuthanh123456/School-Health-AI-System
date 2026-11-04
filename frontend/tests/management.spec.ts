import { expect, test, type Page } from '@playwright/test'
import type { AccountRef, HealthRecord, ManagementOptions, ParentOverview } from '../src/managementApi'

const parent1: AccountRef = { id: 'PARENT001', email: 'parent001@schoolhealth.example', full_name: null, phone: null }
const parent2: AccountRef = { ...parent1, id: 'PARENT002', email: 'parent002@schoolhealth.example' }
const nurse1: AccountRef = { ...parent1, id: 'NURSE001', email: 'nurse001@schoolhealth.example' }
const nurse2: AccountRef = { ...nurse1, id: 'NURSE002', email: 'nurse002@schoolhealth.example' }
const options: ManagementOptions = { classes: [{ id: '6A1', name: '6A1' }, { id: '6A2', name: '6A2' }], parents: [parent1, parent2], nurses: [nurse1, nurse2] }

function record(id = 'S1'): HealthRecord {
  return {
    id, full_name: `Synthetic ${id}`, class_name: id === 'S2' ? '6A2' : '6A1',
    date_of_birth: null, relationship: null, allergies: 'Synthetic allergy', medical_notes: 'Synthetic health note',
    parents: [parent1], nurse: nurse1, assignment_version: `version-${id}`,
    latest_checkup: { session_id: 'SESSION1', title: 'Term checkup', checkup_date: '2026-11-03', status: 'Normal', height_cm: 150, weight_kg: 45, bmi: 20, vision: null, notes: 'Synthetic checkup note', updated_at: '2026-11-03T09:00:00Z' },
  }
}

async function login(page: Page, role: 'parent' | 'admin' | 'nurse') {
  await page.addInitScript(() => sessionStorage.setItem('schoolhealth.auth-session', JSON.stringify({ accessToken: 'valid-test-session', expiresAt: Date.now() + 3600000 })))
  await page.route('**/auth/me', route => route.fulfill({
    status: route.request().method() === 'OPTIONS' ? 204 : 200,
    headers: { 'Access-Control-Allow-Origin': route.request().headers().origin || '*' , 'Access-Control-Allow-Headers': 'authorization,content-type', 'Access-Control-Allow-Methods': 'GET,OPTIONS' },
    ...(route.request().method() === 'OPTIONS' ? {} : { json: { id: role === 'parent' ? parent1.id : role, email: `${role}@schoolhealth.example`, role } }),
  }))
}

async function adminData(page: Page, state: HealthRecord[]) {
  await page.route('**/api/admin/health-records/options', route => route.fulfill({ json: options }))
  await page.route(/\/api\/admin\/health-records(?:\?.*)?$/, route => {
    const params = new URL(route.request().url()).searchParams
    const items = state.filter(row => (!params.get('classId') || row.class_name === params.get('classId'))
      && (!params.get('parentId') || row.parents.some(parent => parent.id === params.get('parentId')))
      && (!params.get('nurseId') || row.nurse?.id === params.get('nurseId')))
    const page = Number(params.get('page') || 1), pageSize = Number(params.get('pageSize') || 10)
    return route.fulfill({ json: { items: items.slice((page - 1) * pageSize, page * pageSize), total: items.length, page, page_size: pageSize } })
  })
}

test('Admin can navigate from management to overview and generate insights for record totals above student totals', async ({ page }) => {
  await login(page, 'admin')
  await adminData(page, [])
  await page.route('**/api/admin/dashboard', route => route.fulfill({ json: {
    total_students: 24, completed_checkups: 41, status_counts: { normal: 33, needs_follow_up: 8 },
  } }))
  await page.route('**/api/admin/ai-insights', route => {
    expect(route.request().postDataJSON()).toEqual({ total_students: 24, checkups_completed: 41, followups_pending: 8 })
    return route.fulfill({ json: {
      summary: '41 saved checkup records across sessions.', recommendations: ['Review school resources.'], disclaimer: 'Informational only.',
      aggregates: { total_students: 24, checkups_completed: 41, followups_pending: 8 },
    } })
  })
  await page.goto('/admin')
  await page.getByRole('link', { name: 'School overview & AI insights' }).click()
  await expect(page.getByLabel('41 completed checkups')).toBeVisible()
  await page.getByRole('button', { name: 'Generate AI Insights' }).click()
  await expect(page.getByText('41 saved checkup records across sessions.')).toBeVisible()
})

test('Parent sees their profile and multiple linked children with history', async ({ page }) => {
  await login(page, 'parent')
  const children = [record(), record('S3')].map(row => ({ ...row, checkups: row.latest_checkup ? [row.latest_checkup] : [] }))
  await page.route('**/api/parent/dashboard', route => route.fulfill({ json: { parent: { ...parent1, relationship: null }, children } satisfies ParentOverview }))
  await page.goto('/parent')
  await expect(page.getByRole('heading', { name: "Your family's health" })).toBeVisible()
  await expect(page.getByText('Synthetic S1', { exact: true })).toBeVisible()
  await expect(page.getByText('Synthetic S3', { exact: true })).toBeVisible()
  await expect(page.getByText(parent1.email, { exact: true })).toBeVisible()
  await page.getByText('Checkup history (1)', { exact: true }).first().click()
  await expect(page.getByText('Synthetic checkup note').first()).toBeVisible()
  const stored = await page.evaluate(() => ({ local: { ...localStorage }, session: { ...sessionStorage } }))
  expect(JSON.stringify(stored)).not.toContain('Synthetic health note')
  expect(JSON.stringify(stored)).not.toContain('Synthetic allergy')
})

test('Parent without children retains their profile and clear empty state', async ({ page }) => {
  await login(page, 'parent')
  await page.route('**/api/parent/dashboard', route => route.fulfill({ json: { parent: { ...parent1, relationship: null }, children: [] } }))
  await page.goto('/parent')
  await expect(page.getByRole('heading', { name: 'No children linked yet' })).toBeVisible()
  await expect(page.getByText(parent1.id, { exact: true })).toBeVisible()
})

test('Parent error hides technical details and supports retry', async ({ page }) => {
  await login(page, 'parent')
  let fail = true
  await page.route('**/api/parent/dashboard', route => fail
    ? route.fulfill({ status: 503, json: { detail: 'PRIVATE DATABASE STACK' } })
    : route.fulfill({ json: { parent: { ...parent1, relationship: null }, children: [] } }))
  await page.goto('/parent')
  await expect(page.getByRole('alert')).toContainText('service is unavailable')
  await expect(page.getByRole('alert')).not.toContainText('PRIVATE')
  fail = false
  await page.getByRole('button', { name: 'Try again' }).click()
  await expect(page.getByRole('heading', { name: 'No children linked yet' })).toBeVisible()
})

test('Unauthenticated users go to login and Parent cannot open Admin UI', async ({ page }) => {
  await page.goto('/parent')
  await expect(page).toHaveURL(/\/login$/)
  await login(page, 'parent')
  let adminRequests = 0
  await page.route('**/api/admin/**', route => { adminRequests++; return route.fulfill({ status: 403 }) })
  await page.route('**/api/parent/dashboard', route => route.fulfill({ json: { parent: { ...parent1, relationship: null }, children: [] } }))
  await page.goto('/admin')
  await expect(page).toHaveURL(/\/parent$/)
  await expect(page.getByRole('heading', { name: "Your family's health" })).toBeVisible()
  expect(adminRequests).toBe(0)
})

test('Malformed successful Parent response shows a recoverable error', async ({ page }) => {
  await login(page, 'parent')
  await page.route('**/api/parent/dashboard', route => route.fulfill({ json: {} }))
  await page.goto('/parent')
  await expect(page.getByRole('alert')).toContainText('invalid response')
  await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible()
})

test('Admin combines filters, resets and paginates', async ({ page }) => {
  await login(page, 'admin')
  const state = Array.from({ length: 21 }, (_, index) => record(`S${index + 1}`))
  state[0].nurse = nurse2
  await adminData(page, state)
  await page.goto('/admin')
  await expect(page.getByRole('heading', { name: 'Health management' })).toBeVisible()
  await expect(page.getByText('21 records · Page 1 of 3')).toBeVisible()
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await expect(page.getByText('21 records · Page 2 of 3')).toBeVisible()
  await page.getByLabel('Class', { exact: true }).selectOption('6A1')
  await page.getByLabel('Parent', { exact: true }).selectOption(parent1.id)
  await page.getByLabel('Nurse', { exact: true }).selectOption(nurse2.id)
  await page.getByRole('button', { name: 'Search / Apply' }).click()
  await expect(page.getByText('1 records · Page 1 of 1')).toBeVisible()
  await expect(page.getByText('Synthetic S1', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Reset', exact: true }).click()
  await expect(page.getByText('21 records · Page 1 of 3')).toBeVisible()
  await expect(page.getByLabel('Class', { exact: true })).toHaveValue('')
})

test('Admin parent/nurse updates refresh the row and removals require confirmation', async ({ page }) => {
  await login(page, 'admin')
  const state = [record()]
  await adminData(page, state)
  let mutations = 0
  await page.route('**/api/admin/students/S1/*', async route => {
    mutations++
    expect(route.request().headers()['authorization']).toBe('Bearer valid-test-session')
    expect(route.request().headers()['if-match']).toBe(state[0].assignment_version)
    const remove = route.request().method() === 'DELETE'
    if (route.request().url().endsWith('/parent')) state[0].parents = remove ? [] : [parent2]
    else state[0].nurse = remove ? null : nurse2
    state[0].assignment_version = `changed-${mutations}`
    await route.fulfill({ json: state[0] })
  })
  await page.goto('/admin')
  await page.getByRole('button', { name: 'Assign Parent for S1', exact: true }).click()
  await page.getByRole('dialog').getByLabel('Parent account').selectOption(parent2.id)
  await page.getByRole('button', { name: 'Save assignment', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Parent assignment saved' })).toContainText('Parent assignment saved')
  await expect(page.getByText(parent2.email, { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Remove Parent from S1', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Cancel' }).click()
  expect(mutations).toBe(1)
  await page.getByRole('button', { name: 'Remove Parent from S1', exact: true }).click()
  await page.getByRole('button', { name: 'Confirm removal', exact: true }).click()
  await expect(page.getByText('No Parent linked')).toBeVisible()
  await page.getByRole('button', { name: 'Assign Nurse for S1', exact: true }).click()
  await page.getByRole('dialog').getByLabel('Nurse account').selectOption(nurse2.id)
  await page.getByRole('button', { name: 'Save assignment', exact: true }).click()
  await expect(page.getByText(nurse2.email, { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Remove Nurse from S1', exact: true }).click()
  await page.getByRole('button', { name: 'Confirm removal', exact: true }).click()
  await expect(page.getByText('No Nurse assigned')).toBeVisible()
  expect(mutations).toBe(4)
})

test('Admin sees a stale assignment error and must reload before retry', async ({ page }) => {
  await login(page, 'admin')
  await adminData(page, [record()])
  await page.route('**/api/admin/students/S1/parent', route => route.fulfill({ status: 409, json: { detail: 'PRIVATE SQL' } }))
  await page.goto('/admin')
  await page.getByRole('button', { name: 'Assign Parent for S1', exact: true }).click()
  await page.getByRole('button', { name: 'Save assignment' }).click()
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('Someone changed this assignment')
  await expect(page.getByRole('dialog').getByRole('alert')).not.toContainText('PRIVATE')
  await expect(page.getByRole('button', { name: 'Save assignment' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Reload table', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByText('Synthetic S1', { exact: true })).toBeVisible()
})
