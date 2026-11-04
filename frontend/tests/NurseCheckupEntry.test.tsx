// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
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
  fireEvent.change(screen.getByLabelText('Tài khoản Nurse'), { target: { value: 'nurse' } })
  fireEvent.change(screen.getByLabelText('Mật khẩu'), { target: { value: 'password' } })
  fireEvent.click(screen.getByRole('button', { name: 'Kết nối' }))
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
    const heightInput = await screen.findByLabelText('Chiều cao (cm)') as HTMLInputElement
    await waitFor(() => expect(heightInput.value).toBe(''))

    lateAlex.resolve(jsonResponse(resultFor('STU-001', 155, 48.2)))
    await waitFor(() => expect(heightInput.value).toBe(''))

    expect(screen.getByRole('button', { name: /Blair Student/ }).getAttribute('aria-pressed')).toBe('true')
    expect((screen.getByLabelText('Cân nặng (kg)') as HTMLInputElement).value).toBe('')
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
    await waitFor(() => expect((screen.getByLabelText('Cân nặng (kg)') as HTMLInputElement).value).toBe('40.1'))
    fireEvent.submit(screen.getByRole('button', { name: 'Lưu / cập nhật kết quả' }).closest('form')!)
    await screen.findByRole('button', { name: 'Đang lưu…' })

    const blairButton = screen.getByRole('button', { name: /Blair Student/ }) as HTMLButtonElement
    expect(blairButton.disabled).toBe(true)
    fireEvent.click(blairButton)
    expect(screen.getByRole('button', { name: /Alex Student/ }).getAttribute('aria-pressed')).toBe('true')

    pendingSave.resolve(jsonResponse(resultFor('STU-001')))
    await screen.findByText(/Đã lưu kết quả\. BMI:/)
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
    const height = await screen.findByLabelText('Chiều cao (cm)')
    await waitFor(() => expect((screen.getByRole('button', { name: 'Lưu / cập nhật kết quả' }) as HTMLButtonElement).disabled).toBe(false))
    fireEvent.change(height, { target: { value: '150' } })
    fireEvent.change(screen.getByLabelText('Cân nặng (kg)'), { target: { value: '40.04' } })
    fireEvent.submit(screen.getByRole('button', { name: 'Lưu / cập nhật kết quả' }).closest('form')!)

    expect((await screen.findByRole('alert')).textContent).toContain('một chữ số thập phân')
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'PUT')).toBe(false)
  })
})
