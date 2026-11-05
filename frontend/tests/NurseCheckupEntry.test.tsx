// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { NurseCheckupEntry } from '../src/NurseCheckupEntry'

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((complete) => { resolve = complete })
  return { promise, resolve }
}

const session = {
  id: 'SESSION-A',
  title: 'Annual checkup',
  checkup_date: '2026-11-03',
  class_name: '6A',
  participant_count: 2,
}
const secondSession = { ...session, id: 'SESSION-B', title: 'Follow-up checkup' }
const roster = [
  { id: 'STU-001', student_code: 'STU-001', full_name: 'Alex Student', class_name: '6A' },
  { id: 'STU-002', student_code: 'STU-002', full_name: 'Blair Student', class_name: '6A' },
]

async function login() {
  render(
    <NurseCheckupEntry
      route={{ kind: 'result-entry', sessionId: 'SESSION-A' }}
      onClose={() => undefined}
      onSelectSession={() => undefined}
      onContinueToResults={() => undefined}
    />,
  )
  await screen.findByRole('button', { name: /Alex Student/ })
  await screen.findByRole('button', { name: /Blair Student/ })
}

function resultFor(studentId: string, height = 150, weight = 40.1) {
  return {
    session_id: 'SESSION-A',
    student_id: studentId,
    height_cm: height,
    weight_kg: weight,
    bmi: weight / ((height / 100) ** 2),
    vision: null,
    notes: null,
    status: 'Normal',
  }
}

describe('Nurse checkup result selection', () => {
  beforeEach(() => {
    sessionStorage.setItem('schoolhealth.auth-session', JSON.stringify({ accessToken: 'nurse-token', expiresAt: Date.now() + 60_000 }))
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.endsWith('/checkups/sessions')) return jsonResponse([session])
      if (url.endsWith('/checkups/sessions/SESSION-A/students')) return jsonResponse(roster)
      return jsonResponse({ detail: 'Unexpected request' }, 500)
    }))
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('ignores a late result response after the Nurse selects another student', async () => {
    const lateAlex = deferred<Response>()
    vi.mocked(fetch).mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.endsWith('/STU-001/result')) return lateAlex.promise
      if (url.endsWith('/STU-002/result')) return jsonResponse({ detail: 'No checkup result has been saved for this student.' }, 404)
      if (url.endsWith('/checkups/sessions')) return jsonResponse([session])
      if (url.endsWith('/checkups/sessions/SESSION-A/students')) return jsonResponse(roster)
      return jsonResponse({ detail: 'Unexpected request' }, 500)
    })

    await login()
    fireEvent.click(screen.getByRole('button', { name: /Alex Student/ }))
    fireEvent.click(screen.getByRole('button', { name: /Blair Student/ }))
    const heightInput = await screen.findByLabelText('Height (cm)') as HTMLInputElement
    await waitFor(() => expect(heightInput.value).toBe(''))

    await act(async () => { lateAlex.resolve(jsonResponse(resultFor('STU-001', 155, 48.2))) })
    await waitFor(() => expect(heightInput.value).toBe(''))

    expect(screen.getByRole('button', { name: /Blair Student/ }).getAttribute('aria-pressed')).toBe('true')
    expect((screen.getByLabelText('Weight (kg)') as HTMLInputElement).value).toBe('')
  })

  it('unlocks student search immediately when changing sessions during an in-flight search', async () => {
    const pendingSessionA = deferred<Response>()
    const fetchMock = vi.mocked(fetch)
    let sessionASignal: AbortSignal | undefined
    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.endsWith('/checkups/sessions')) return jsonResponse([session, secondSession])
      if (url.includes('/sessions/SESSION-A/students?')) {
        sessionASignal = init?.signal ?? undefined
        return pendingSessionA.promise
      }
      if (url.includes('/sessions/SESSION-B/students?')) return jsonResponse([roster[1]])
      return jsonResponse({ detail: 'Unexpected request' }, 500)
    })

    render(
      <NurseCheckupEntry
        route={{ kind: 'nurse-entry' }}
        onClose={() => undefined}
        onSelectSession={() => undefined}
        onContinueToResults={() => undefined}
      />,
    )
    expect(screen.getByRole('list', { name: 'Result entry steps' })).toBeTruthy()
    await screen.findByRole('combobox')
    const sessionSelect = document.querySelector('select')!
    fireEvent.change(sessionSelect, { target: { value: 'SESSION-A' } })
    const searchButton = screen.getAllByRole('button').find((button) => button.textContent?.includes('Find')) as HTMLButtonElement
    fireEvent.click(searchButton)
    await waitFor(() => expect(sessionASignal).toBeDefined())

    fireEvent.change(sessionSelect, { target: { value: 'SESSION-B' } })
    expect(sessionASignal?.aborted).toBe(true)
    expect(searchButton.disabled).toBe(false)

    fireEvent.click(searchButton)
    expect(await screen.findByRole('button', { name: /Blair Student/ })).toBeTruthy()

    // Simulate a fetch implementation that resolves despite being aborted.
    await act(async () => { pendingSessionA.resolve(jsonResponse([roster[0]])) })
    expect(screen.queryByRole('button', { name: /Alex Student/ })).toBeNull()
    expect(fetchMock.mock.calls.some(([input]) => String(input).includes('/sessions/SESSION-B/students?'))).toBe(true)
  })

  it('keeps the save target locked until the write finishes', async () => {
    const pendingSave = deferred<Response>()
    const fetchMock = vi.mocked(fetch)
    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (init?.method === 'PUT') return pendingSave.promise
      if (url.endsWith('/STU-001/result')) return jsonResponse(resultFor('STU-001'))
      if (url.endsWith('/checkups/sessions')) return jsonResponse([session])
      if (url.endsWith('/checkups/sessions/SESSION-A/students')) return jsonResponse(roster)
      return jsonResponse({ detail: 'No checkup result has been saved for this student.' }, 404)
    })

    await login()
    fireEvent.click(screen.getByRole('button', { name: /Alex Student/ }))
    await waitFor(() => expect((screen.getByLabelText('Weight (kg)') as HTMLInputElement).value).toBe('40.1'))
    fireEvent.submit(screen.getByRole('button', { name: 'Save / update result' }).closest('form')!)
    await screen.findByRole('button', { name: 'Saving…' })

    const blairButton = screen.getByRole('button', { name: /Blair Student/ }) as HTMLButtonElement
    expect(blairButton.disabled).toBe(true)
    fireEvent.click(blairButton)
    expect(screen.getByRole('button', { name: /Alex Student/ }).getAttribute('aria-pressed')).toBe('true')

    pendingSave.resolve(jsonResponse(resultFor('STU-001')))
    await screen.findByText(/Result saved\. BMI:/)
    expect(String(fetchMock.mock.calls.find(([, init]) => init?.method === 'PUT')?.[0])).toContain('/STU-001/result')
    expect(fetchMock.mock.calls.filter(([, init]) => init?.method === 'PUT')).toHaveLength(1)
  })

  it('rejects a value with more precision than the database stores', async () => {
    vi.mocked(fetch).mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.endsWith('/checkups/sessions')) return jsonResponse([session])
      if (url.endsWith('/checkups/sessions/SESSION-A/students')) return jsonResponse(roster)
      if (url.endsWith('/STU-001/result')) return jsonResponse({ detail: 'No checkup result has been saved for this student.' }, 404)
      return jsonResponse({ detail: 'Unexpected request' }, 500)
    })
    const fetchMock = vi.mocked(fetch)

    await login()
    fireEvent.click(screen.getByRole('button', { name: /Alex Student/ }))
    const height = await screen.findByLabelText('Height (cm)')
    await waitFor(() => expect((screen.getByRole('button', { name: 'Save / update result' }) as HTMLButtonElement).disabled).toBe(false))
    fireEvent.change(height, { target: { value: '150' } })
    fireEvent.change(screen.getByLabelText('Weight (kg)'), { target: { value: '40.04' } })
    fireEvent.submit(screen.getByRole('button', { name: 'Save / update result' }).closest('form')!)

    expect((await screen.findByRole('alert')).textContent).toContain('one decimal place')
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'PUT')).toBe(false)
  })

  it.each([
    ['HTTP 500', () => jsonResponse({ detail: 'Server error' }, 500)],
    ['HTTP 403', () => jsonResponse({ detail: 'Forbidden' }, 403)],
    ['HTTP 401', () => jsonResponse({ detail: 'Unauthorized' }, 401)],
    ['network failure', () => { throw new TypeError('Failed to fetch') }],
    ['unknown student 404', () => jsonResponse({ detail: 'Student not found.' }, 404)],
    ['invalid 404 payload', () => jsonResponse({ detail: ['No checkup result has been saved for this student.'] }, 404)],
    ['incomplete result', () => jsonResponse({ session_id: 'SESSION-A', student_id: 'STU-001' })],
    ['wrong student result', () => jsonResponse(resultFor('STU-002'))],
    ['invalid JSON', () => ({ ok: true, status: 200, json: async () => { throw new SyntaxError('Invalid JSON') } }) as Response],
  ])('locks the form after %s and preserves existing data after a successful retry', async (_label, failedResponse) => {
    const existing = { ...resultFor('STU-001'), notes: 'Keep this note', vision: '6/9', status: 'Needs Follow-up' }
    let loads = 0
    const fetchMock = vi.mocked(fetch)
    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (init?.method === 'PUT') return jsonResponse(existing)
      if (url.endsWith('/STU-001/result')) {
        loads += 1
        return loads === 1 ? failedResponse() : jsonResponse(existing)
      }
      if (url.endsWith('/checkups/sessions')) return jsonResponse([session])
      if (url.endsWith('/checkups/sessions/SESSION-A/students')) return jsonResponse(roster)
      throw new Error('Unexpected request')
    })

    await login()
    fireEvent.click(screen.getByRole('button', { name: /Alex Student/ }))
    const retry = await screen.findByRole('button', { name: 'Reload result' })
    const save = screen.getByRole('button', { name: 'Save / update result' }) as HTMLButtonElement
    expect(save.disabled).toBe(true)
    for (const label of ['Height (cm)', 'Weight (kg)', 'Vision (optional)', 'Notes (optional)', 'Follow-up status selected by Nurse']) {
      expect((screen.getByLabelText(label) as HTMLInputElement).disabled).toBe(true)
    }

    // A direct submit must also be refused; disabling the button alone is insufficient.
    fireEvent.change(screen.getByLabelText('Height (cm)'), { target: { value: '160' } })
    fireEvent.change(screen.getByLabelText('Weight (kg)'), { target: { value: '50' } })
    fireEvent.submit(save.closest('form')!)
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'PUT')).toBe(false)

    fireEvent.click(retry)
    await waitFor(() => expect((screen.getByLabelText('Notes (optional)') as HTMLTextAreaElement).value).toBe(existing.notes))
    expect((screen.getByLabelText('Vision (optional)') as HTMLInputElement).value).toBe(existing.vision)
    expect((screen.getByLabelText('Follow-up status selected by Nurse') as HTMLSelectElement).value).toBe(existing.status)
    expect(save.disabled).toBe(false)
    fireEvent.submit(save.closest('form')!)
    await screen.findByText(/Result saved\. BMI:/)

    const writes = fetchMock.mock.calls.filter(([, init]) => init?.method === 'PUT')
    expect(writes).toHaveLength(1)
    expect(JSON.parse(String(writes[0][1]?.body))).toEqual({
      height_cm: existing.height_cm,
      weight_kg: existing.weight_kg,
      vision: existing.vision,
      notes: existing.notes,
      status: existing.status,
    })
  })

  it('allows a new result only after the exact no-saved-result response', async () => {
    const fetchMock = vi.mocked(fetch)
    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (init?.method === 'PUT') return jsonResponse(resultFor('STU-001', 160, 50))
      if (url.endsWith('/STU-001/result')) return jsonResponse({ detail: 'No checkup result has been saved for this student.' }, 404)
      if (url.endsWith('/checkups/sessions')) return jsonResponse([session])
      if (url.endsWith('/checkups/sessions/SESSION-A/students')) return jsonResponse(roster)
      throw new Error('Unexpected request')
    })

    await login()
    fireEvent.click(screen.getByRole('button', { name: /Alex Student/ }))
    const save = await screen.findByRole('button', { name: 'Save / update result' }) as HTMLButtonElement
    await waitFor(() => expect(save.disabled).toBe(false))
    fireEvent.change(screen.getByLabelText('Height (cm)'), { target: { value: '160' } })
    fireEvent.change(screen.getByLabelText('Weight (kg)'), { target: { value: '50' } })
    fireEvent.submit(save.closest('form')!)
    await screen.findByText(/Result saved\. BMI:/)
    expect(fetchMock.mock.calls.filter(([, init]) => init?.method === 'PUT')).toHaveLength(1)
  })
})
