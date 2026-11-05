import { expect, test } from '@playwright/test'

test('public page fits six viewport widths, loads local photos and keeps valid anchor targets', async ({ page }) => {
  const apiCalls: string[] = []
  page.on('request', request => {
    const path = new URL(request.url()).pathname
    if (['fetch', 'xhr'].includes(request.resourceType()) && /^\/(api|auth)\//.test(path)) apiCalls.push(request.url())
  })

  for (const width of [320, 375, 768, 1024, 1440, 1920]) {
    await page.setViewportSize({ width, height: 1000 })
    await page.goto(width === 320 ? '/home' : '/')
    await expect(page).toHaveTitle('SchoolHealth | Connected School Health Management')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Better Student Care.Smarter School Health Management.')
    const invalidTargets = await page.locator('.schoolhealth-landing a[href^="#"]').evaluateAll(links => links
      .map(link => link.getAttribute('href') ?? '')
      .filter(href => !document.getElementById(href.slice(1))))
    expect(invalidTargets).toEqual([])
    const dimensions = await page.evaluate(() => ({
      viewport: innerWidth, document: document.documentElement.scrollWidth, body: document.body.scrollWidth,
    }))
    expect(dimensions.document, `document at ${width}px`).toBeLessThanOrEqual(dimensions.viewport)
    expect(dimensions.body, `body at ${width}px`).toBeLessThanOrEqual(dimensions.viewport)
    if (width < 1100) await expect(page.getByRole('button', { name: 'Open public navigation' })).toBeVisible()
    else {
      await expect(page.getByRole('navigation', { name: 'Public navigation' })).toBeVisible()
      await expect(page.locator('.landing-menu-trigger')).toBeHidden()
    }
    await expect(page.locator('.landing-hero-photo img')).toHaveJSProperty('complete', true)
    expect(await page.locator('.landing-hero-photo img').evaluate(image => image instanceof HTMLImageElement && image.naturalWidth > 0)).toBe(true)
    await page.screenshot({ path: `../docs/landing-frontline/viewport-${width}.png` })
  }
  expect(apiCalls).toEqual([])
  expect(await page.locator('.schoolhealth-landing img').evaluateAll(images => images.every(image =>
    image.getAttribute('src')?.startsWith('/images/landing/')))).toBe(true)
})

test('mobile menu uses a native modal, supports keyboard navigation and restores focus', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto('/')
  const trigger = page.getByRole('button', { name: 'Open public navigation' })
  await trigger.click()
  const menu = page.getByRole('dialog', { name: 'SchoolHealth navigation' })
  await expect(menu).toBeVisible()
  expect(await menu.evaluate(element => element.matches(':modal'))).toBe(true)
  await expect(trigger).toHaveAttribute('aria-expanded', 'true')
  await expect(page.getByRole('button', { name: 'Close public navigation' })).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(menu.getByRole('link', { name: 'Home', exact: true })).toBeFocused()
  await page.keyboard.press('Shift+Tab')
  await expect(page.getByRole('button', { name: 'Close public navigation' })).toBeFocused()
  await page.screenshot({ path: '../docs/landing-frontline/mobile-menu.png' })
  await page.keyboard.press('Escape')
  await expect(menu).toHaveCount(0)
  await expect(trigger).toBeFocused()

  await trigger.click()
  await menu.getByRole('link', { name: 'Features', exact: true }).click()
  await expect(page).toHaveURL(/#features$/)
  await expect(menu).toHaveCount(0)
  await expect(page.locator('#features')).toBeFocused()
  await expect(trigger).toHaveAttribute('aria-expanded', 'false')
})

test('desktop section links scroll correctly and login CTA uses the existing auth page', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto('/')
  const nav = page.getByRole('navigation', { name: 'Public navigation' })
  await nav.getByRole('link', { name: 'How It Works' }).click()
  await expect(page).toHaveURL(/#how-it-works$/)
  await expect(page.getByRole('heading', { name: /A connected workflow/ })).toBeInViewport()
  await page.getByRole('link', { name: 'Get Started with SchoolHealth' }).click()
  await expect(page).toHaveURL(/\/login$/)
  await expect(page.getByRole('heading', { name: 'Sign in to SchoolHealth' })).toBeVisible()
})

test('mobile menu closes when crossing into desktop layout', async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 1000 })
  await page.goto('/')
  await page.getByRole('button', { name: 'Open public navigation' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.setViewportSize({ width: 1440, height: 1000 })
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByRole('navigation', { name: 'Public navigation' })).toBeVisible()
})

test('final full-page review captures loaded photography with reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  for (const [width, height, name] of [[1440, 1000, 'desktop'], [375, 812, 'mobile']] as const) {
    await page.setViewportSize({ width, height })
    await page.goto('/')
    await page.evaluate(async () => {
      // Force native lazy images to load for the full-page review artifact.
      document.querySelectorAll('img').forEach(image => { image.loading = 'eager' })
      await Promise.all([...document.images].map(image => image.decode()))
    })
    await page.screenshot({ path: `../docs/landing-frontline/schoolhealth-${name}.png`, fullPage: true })
  }
})
