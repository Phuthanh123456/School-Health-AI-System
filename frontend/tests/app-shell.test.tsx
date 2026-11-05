// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AppShell } from '../src/AppShell'

beforeEach(() => {
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
    configurable: true,
    value() { this.setAttribute('open', '') },
  })
  Object.defineProperty(HTMLDialogElement.prototype, 'close', {
    configurable: true,
    value() { this.removeAttribute('open') },
  })
})

afterEach(() => {
  cleanup()
  window.history.replaceState({}, '', '/')
  vi.restoreAllMocks()
})

describe('role-aware application shell', () => {
  it('shows only Admin destinations and marks the current deep link', () => {
    window.history.replaceState({}, '', '/admin/insights')
    render(<AppShell role="admin" onSignOut={() => undefined}>Admin content</AppShell>)

    const overview = screen.getByRole('link', { name: /School overview/ })
    expect(overview.getAttribute('href')).toBe('/admin/overview')
    expect(overview.getAttribute('aria-current')).toBe('page')
    expect(screen.getByRole('link', { name: /Health management/ })).toBeTruthy()
    expect(screen.queryByRole('link', { name: /Family health/ })).toBeNull()
  })

  it('exposes Nurse workflow sections as stateful navigation actions', () => {
    const onNurseSectionChange = vi.fn()
    render(<AppShell role="nurse" nurseSection="profiles" onNurseSectionChange={onNurseSectionChange} onSignOut={() => undefined}>Nurse content</AppShell>)

    fireEvent.click(screen.getByRole('button', { name: /Checkup sessions/ }))
    expect(onNurseSectionChange).toHaveBeenCalledWith('checkups')
    expect(screen.getByRole('button', { name: /Student profiles/ }).getAttribute('aria-pressed')).toBe('true')
  })

  it('opens a mobile modal drawer, closes on Escape, and returns focus to its trigger', async () => {
    window.history.replaceState({}, '', '/parent')
    render(<AppShell role="parent" onSignOut={() => undefined}>Parent content</AppShell>)
    const trigger = screen.getByRole('button', { name: 'Open navigation' })

    fireEvent.click(trigger)
    const dialog = screen.getByRole('dialog', { name: 'Mobile navigation' })
    expect(dialog.hasAttribute('open')).toBe(true)
    expect(document.activeElement).toBe(screen.getAllByRole('link', { name: /Family health/ })[1])

    fireEvent(dialog, new Event('cancel', { bubbles: true, cancelable: true }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Mobile navigation' })).toBeNull())
    await waitFor(() => expect(document.activeElement).toBe(trigger))
  })

  it('keeps sign-out available from the shared topbar', () => {
    const onSignOut = vi.fn()
    render(<AppShell role="parent" onSignOut={onSignOut}>Parent content</AppShell>)

    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }))
    expect(onSignOut).toHaveBeenCalledOnce()
  })
})
