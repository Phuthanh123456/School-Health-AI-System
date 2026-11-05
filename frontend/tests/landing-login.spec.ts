import { expect, test } from '@playwright/test'

test('public landing explains the product and offers working sign-in navigation', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByRole('heading', { name: /Every checkup/i })).toBeVisible()
  await expect(page.getByRole('link', { name: /Sign in/i }).first()).toHaveAttribute('href', '/login')
  await expect(page.getByRole('link', { name: /Explore the platform/i })).toHaveAttribute('href', '#features')
  await expect(page.getByRole('img', { name: 'Illustrative health trends chart' })).toBeVisible()
  await expect(page.getByText('Use synthetic data in demos.')).toBeVisible()
})

test('login validates required fields and email format accessibly', async ({ page }) => {
  await page.goto('/login')

  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByRole('alert')).toHaveText('Enter your email and password.')
  await expect(page.getByLabel('Email')).toHaveAttribute('aria-invalid', 'true')
  await expect(page.getByRole('textbox', { name: 'Password' })).toHaveAttribute('aria-invalid', 'true')

  await page.getByLabel('Email').fill('not-an-email')
  await page.getByRole('textbox', { name: 'Password' }).fill('synthetic-password')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByRole('alert')).toHaveText('Enter a valid email address.')
  await expect(page.getByLabel('Email')).toHaveAttribute('aria-invalid', 'true')
})

test('password visibility toggle preserves its pressed state and value', async ({ page }) => {
  await page.goto('/login')
  const password = page.getByRole('textbox', { name: 'Password' })
  await password.fill('synthetic-password')

  await page.getByRole('button', { name: 'Show password' }).click()
  await expect(password).toHaveAttribute('type', 'text')
  await expect(page.getByRole('button', { name: 'Hide password' })).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: 'Hide password' }).click()
  await expect(password).toHaveAttribute('type', 'password')
  await expect(password).toHaveValue('synthetic-password')
})

test('login failure is announced and the form can be retried', async ({ page }) => {
  let attempts = 0
  await page.route('**/auth/login', async route => {
    attempts += 1
    if (attempts === 1) {
      await route.fulfill({ status: 401, json: { detail: 'invalid credentials' } })
      return
    }
    await route.fulfill({ json: {
      access_token: 'synthetic-token',
      token_type: 'bearer',
      expires_in: 3600,
      user: { id: 'parent-1', email: 'parent@example.test', role: 'parent' },
    } })
  })
  await page.route('**/auth/me', route => route.fulfill({ json: { id: 'parent-1', email: 'parent@example.test', role: 'parent' } }))
  await page.route('**/api/parent/dashboard', route => route.fulfill({ json: { parent: { id: 'parent-1', name: 'Demo Parent' }, children: [] } }))
  await page.goto('/login')
  await page.getByLabel('Email').fill('parent@example.test')
  await page.getByRole('textbox', { name: 'Password' }).fill('synthetic-password')

  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByRole('alert')).toHaveText('Email or password is incorrect. Please try again.')
  await expect(page.getByRole('button', { name: 'Sign in' })).toBeEnabled()

  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page).toHaveURL(/\/parent$/)
  await expect(page.getByRole('button', { name: /Sign out/i })).toBeVisible()
  expect(attempts).toBe(2)
})

test('pending sign-in disables repeat submission and redirects by returned role', async ({ page }) => {
  let attempts = 0
  await page.route('**/auth/login', async route => {
    attempts += 1
    await new Promise(resolve => setTimeout(resolve, 150))
    await route.fulfill({ json: {
      access_token: 'synthetic-token',
      token_type: 'bearer',
      expires_in: 3600,
      user: { id: 'nurse-1', email: 'nurse@example.test', role: 'nurse' },
    } })
  })
  await page.route('**/auth/me', route => route.fulfill({ json: { id: 'nurse-1', email: 'nurse@example.test', role: 'nurse' } }))
  await page.route('**/students', route => route.fulfill({ json: [] }))
  await page.goto('/login')
  await page.getByLabel('Email').fill('nurse@example.test')
  await page.getByRole('textbox', { name: 'Password' }).fill('synthetic-password')

  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByRole('button', { name: 'Signing in…' })).toBeDisabled()
  await expect(page.locator('form')).toHaveAttribute('aria-busy', 'true')
  await expect(page).toHaveURL(/\/nurse$/)
  await expect(page.getByRole('navigation', { name: 'nurse navigation' })).toBeVisible()
  expect(attempts).toBe(1)
})

