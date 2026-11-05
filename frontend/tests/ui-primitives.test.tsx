// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  Badge,
  Button,
  Card,
  Dialog,
  EmptyState,
  Input,
  PageHeader,
  Select,
  Skeleton,
} from '../src/components/ui'

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
  vi.restoreAllMocks()
})

describe('Hybrid Healthcare UI primitives', () => {
  it('keeps buttons native and locks them with an announced loading state', () => {
    render(<Button loading loadingLabel="Saving record">Save</Button>)

    const button = screen.getByRole('button', { name: 'Saving record' })
    expect((button as HTMLButtonElement).disabled).toBe(true)
    expect(button.getAttribute('type')).toBe('button')
    expect(button.getAttribute('aria-busy')).toBe('true')
  })

  it('supports semantic card elements and status badge variants', () => {
    render(<Card as="article" aria-label="Summary"><Badge variant="success">Ready</Badge></Card>)

    expect(screen.getByRole('article', { name: 'Summary' }).tagName).toBe('ARTICLE')
    expect(screen.getByText('Ready').classList.contains('bg-success-soft')).toBe(true)
  })

  it('connects input and select validation messages to native fields', () => {
    render(
      <>
        <label htmlFor="email">Email</label>
        <Input id="email" aria-describedby="external-help" error="Enter a valid email." />
        <label htmlFor="role">Role</label>
        <Select id="role" helperText="Choose an assigned role." error="A role is required.">
          <option value="">Choose a role</option>
        </Select>
      </>,
    )

    const input = screen.getByLabelText('Email')
    expect(input.getAttribute('aria-invalid')).toBe('true')
    expect(input.getAttribute('aria-describedby')).toContain('external-help')
    expect(input.getAttribute('aria-describedby')).toContain('-error')
    expect(screen.getByLabelText('Role').getAttribute('aria-invalid')).toBe('true')
    expect(screen.getByText('Choose an assigned role.').textContent).toBe('Choose an assigned role.')
  })

  it('opens a native modal dialog and returns Escape cancellation to its owner', () => {
    const onClose = vi.fn()
    render(<Dialog open onClose={onClose} title="Confirm assignment" description="Review the selected account.">Dialog content</Dialog>)

    const dialog = screen.getByRole('dialog', { name: 'Confirm assignment' })
    expect(dialog.hasAttribute('open')).toBe(true)
    expect(dialog.hasAttribute('aria-describedby')).toBe(true)
    fireEvent(dialog, new Event('cancel', { bubbles: true, cancelable: true }))
    expect(onClose).toHaveBeenCalledOnce()
    fireEvent.click(screen.getByRole('button', { name: 'Close dialog' }))
    expect(onClose).toHaveBeenCalledTimes(2)
  })

  it('keeps skeletons decorative while rendering an actionable empty state', () => {
    const { container } = render(
      <>
        <Skeleton shape="text" data-testid="loading-placeholder" />
        <EmptyState title="No records" description="Nothing is available yet." action={<Button>Refresh</Button>} />
      </>,
    )

    expect(screen.getByTestId('loading-placeholder').getAttribute('aria-hidden')).toBe('true')
    expect(screen.getByRole('region', { name: 'No records' }).tagName).toBe('SECTION')
    expect(screen.getByRole('button', { name: 'Refresh' }).textContent).toBe('Refresh')
    expect(Boolean(container.querySelector('.animate-pulse'))).toBe(true)
  })

  it('provides a page-level heading, description, and action slot', () => {
    render(<PageHeader eyebrow="School health" title="Overview" description="Current summary." actions={<Button>Refresh</Button>} />)

    expect(screen.getByRole('heading', { level: 1, name: 'Overview' }).tagName).toBe('H1')
    expect(screen.getByText('School health').textContent).toBe('School health')
    expect(screen.getByText('Current summary.').textContent).toBe('Current summary.')
    expect(screen.getByRole('button', { name: 'Refresh' }).textContent).toBe('Refresh')
  })
})
