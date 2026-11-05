import { useEffect, useRef, useState, type FormEvent } from 'react'
import { calculateBmi, formatBmi } from './checkupMath.js'
import CheckupSessionsPage from './pages/CheckupSessionsPage'
import { getAccessToken, signOut } from './auth'
import { Button, Card, Input, Select } from './components/ui'

type Session = { id: string; title: string; checkup_date: string; class_name: string | null; participant_count: number }
type Student = { id: string; student_code: string; full_name: string; class_name: string }
type NurseRoute =
  | { kind: 'nurse-entry' }
  | { kind: 'checkup-sessions'; selectedSessionId: string | null }
  | { kind: 'result-entry'; sessionId: string | null }
type Status = 'Normal' | 'Needs Follow-up'
type ResultLoadState = 'idle' | 'loading' | 'ready' | 'error'
type Result = {
  session_id: string
  student_id: string
  height_cm: number
  weight_kg: number
  bmi: number
  vision: string | null
  notes: string | null
  status: Status
}

const API_BASE = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000').replace(/\/$/, '')

function isResult(value: unknown): value is Result {
  if (typeof value !== 'object' || value === null) return false
  const result = value as Partial<Result>
  return typeof result.session_id === 'string'
    && typeof result.student_id === 'string'
    && typeof result.height_cm === 'number' && Number.isFinite(result.height_cm) && result.height_cm > 0
    && typeof result.weight_kg === 'number' && Number.isFinite(result.weight_kg) && result.weight_kg > 0
    && typeof result.bmi === 'number' && Number.isFinite(result.bmi)
    && (result.vision === null || typeof result.vision === 'string')
    && (result.notes === null || typeof result.notes === 'string')
    && (result.status === 'Normal' || result.status === 'Needs Follow-up')
}

async function responseError(response: Response) {
  try {
    const body = await response.json() as { detail?: unknown }
    if (typeof body.detail === 'string') return body.detail
    if (Array.isArray(body.detail)) {
      return body.detail.map((entry) => {
        if (typeof entry !== 'object' || entry === null) return String(entry)
        const issue = entry as { loc?: unknown[]; msg?: string }
        const field = issue.loc?.filter((part) => part !== 'body').join('.')
        return field ? `${field}: ${issue.msg ?? 'Invalid value'}` : issue.msg ?? 'Invalid value'
      }).join('; ')
    }
    return `Request failed (${response.status})`
  } catch {
    return `Request failed (${response.status})`
  }
}

export function NurseCheckupEntry({
  onClose,
  route,
  onSelectSession,
  onContinueToResults,
}: {
  onClose: () => void
  route: NurseRoute
  onSelectSession: (sessionId: string | null) => void
  onContinueToResults: (sessionId: string) => void
}) {
  const [authorization, setAuthorization] = useState('')
  const [sessions, setSessions] = useState<Session[]>([])
  const [sessionId, setSessionId] = useState('')
  const [search, setSearch] = useState('')
  const [students, setStudents] = useState<Student[]>([])
  const [student, setStudent] = useState<Student | null>(null)
  const [height, setHeight] = useState('')
  const [weight, setWeight] = useState('')
  const [vision, setVision] = useState('')
  const [notes, setNotes] = useState('')
  const [status, setStatus] = useState<Status>('Normal')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [resultLoadState, setResultLoadState] = useState<ResultLoadState>('idle')
  const [saving, setSaving] = useState(false)
  const savingRef = useRef(false)
  const resultRequestRef = useRef(0)
  const rosterRequestRef = useRef(0)
  const resultAbortRef = useRef<AbortController | null>(null)
  const rosterAbortRef = useRef<AbortController | null>(null)
  const selectedKeyRef = useRef('')
  const editableResultKeyRef = useRef('')

  const bmi = calculateBmi(height, weight)
  const resultLoading = resultLoadState === 'loading'
  const resultEditable = resultLoadState === 'ready'
  const routeSessionId = route.kind === 'result-entry' ? route.sessionId : null

  useEffect(() => () => {
    editableResultKeyRef.current = ''
    resultAbortRef.current?.abort()
    rosterAbortRef.current?.abort()
  }, [])

  useEffect(() => {
    const accessToken = getAccessToken()
    if (!accessToken) {
      setError('Your Nurse session has expired. Sign in again to continue.')
      signOut()
      window.location.assign('/login')
      return
    }

    const controller = new AbortController()
    const bearer = `Bearer ${accessToken}`
    setAuthorization(bearer)
    setBusy(true)
    setError('')
    fetch(`${API_BASE}/checkups/sessions`, { headers: { Authorization: bearer }, signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(await responseError(response))
        const nextSessions = await response.json() as Session[]
        if (!controller.signal.aborted) {
          setSessions(nextSessions)
          setMessage('Checkup sessions are ready.')
        }
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) {
          setError(reason instanceof Error ? reason.message : 'Could not load checkup sessions.')
        }
      })
      .finally(() => { if (!controller.signal.aborted) setBusy(false) })
    return () => controller.abort()
  }, [])

  useEffect(() => {
    if (routeSessionId) setSessionId(routeSessionId)
    rosterAbortRef.current?.abort()
    rosterRequestRef.current += 1
    resultAbortRef.current?.abort()
    selectedKeyRef.current = ''
    editableResultKeyRef.current = ''
    resultRequestRef.current += 1
    setStudent(null)
    setHeight('')
    setWeight('')
    setVision('')
    setNotes('')
    setBusy(false)
    setResultLoadState('idle')
    setStudents([])
    if (!authorization || !routeSessionId) return

    const rosterRequestId = ++rosterRequestRef.current
    setSearch('')
    setError('')
    setMessage('')
    const controller = new AbortController()
    rosterAbortRef.current = controller
    setBusy(true)
    fetch(`${API_BASE}/checkups/sessions/${encodeURIComponent(routeSessionId)}/students`, {
      headers: { Authorization: authorization },
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error(await responseError(response))
        const nextStudents = await response.json() as Student[]
        if (!controller.signal.aborted && rosterRequestId === rosterRequestRef.current) setStudents(nextStudents)
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted && rosterRequestId === rosterRequestRef.current) {
          setError(reason instanceof Error ? reason.message : 'Could not load the student list.')
        }
      })
      .finally(() => {
        if (!controller.signal.aborted && rosterRequestId === rosterRequestRef.current) setBusy(false)
      })

    return () => controller.abort()
  }, [authorization, routeSessionId])

  function authHeaders() {
    return { Authorization: authorization }
  }

  function clearStudentSelection() {
    resultAbortRef.current?.abort()
    selectedKeyRef.current = ''
    editableResultKeyRef.current = ''
    resultRequestRef.current += 1
    setStudent(null)
    setHeight('')
    setWeight('')
    setVision('')
    setNotes('')
    setStatus('Normal')
    setResultLoadState('idle')
    setError('')
    setMessage('')
  }

  if (authorization && route.kind === 'checkup-sessions') {
    return (
      <CheckupSessionsPage
        authorization={authorization}
        selectedSessionId={route.selectedSessionId}
        onBackHome={onClose}
        onSelectSession={onSelectSession}
        onContinueToResults={onContinueToResults}
      />
    )
  }

  async function searchStudents(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!sessionId) return setError('Please select a checkup session first.')
    if (savingRef.current) return
    const requestedSessionId = sessionId
    const requestId = ++rosterRequestRef.current
    rosterAbortRef.current?.abort()
    const controller = new AbortController()
    rosterAbortRef.current = controller
    setBusy(true)
    setError('')
    setMessage('')
    clearStudentSelection()
    try {
      const params = new URLSearchParams({ q: search })
      const response = await fetch(`${API_BASE}/checkups/sessions/${encodeURIComponent(requestedSessionId)}/students?${params}`, { headers: authHeaders(), signal: controller.signal })
      if (!response.ok) throw new Error(await responseError(response))
      const nextStudents = await response.json() as Student[]
      if (requestId === rosterRequestRef.current && requestedSessionId === sessionId) setStudents(nextStudents)
    } catch (reason) {
      if (!controller.signal.aborted && requestId === rosterRequestRef.current) {
        setError(reason instanceof Error ? reason.message : 'Could not search for students.')
      }
    } finally {
      if (requestId === rosterRequestRef.current) setBusy(false)
    }
  }

  async function selectStudent(nextStudent: Student) {
    if (savingRef.current || !sessionId) return
    const requestedSessionId = sessionId
    const requestId = ++resultRequestRef.current
    const requestKey = `${requestedSessionId}\u0000${nextStudent.id}`
    resultAbortRef.current?.abort()
    const controller = new AbortController()
    resultAbortRef.current = controller
    selectedKeyRef.current = requestKey
    editableResultKeyRef.current = ''
    setStudent(nextStudent)
    setError('')
    setMessage('')
    setHeight('')
    setWeight('')
    setVision('')
    setNotes('')
    setStatus('Normal')
    setResultLoadState('loading')
    const url = `${API_BASE}/checkups/sessions/${encodeURIComponent(requestedSessionId)}/students/${encodeURIComponent(nextStudent.id)}/result`
    try {
      const response = await fetch(url, { headers: authHeaders(), signal: controller.signal })
      if (response.status === 404) {
        const body = await response.json() as { detail?: unknown } | null
        if (body?.detail !== 'No checkup result has been saved for this student.') {
          throw new Error(typeof body?.detail === 'string' ? body.detail : 'Could not verify the result status. Please reload.')
        }
        if (controller.signal.aborted || requestId !== resultRequestRef.current || selectedKeyRef.current !== requestKey) return
        editableResultKeyRef.current = requestKey
        setResultLoadState('ready')
        return
      }
      if (!response.ok) throw new Error(await responseError(response))
      const result: unknown = await response.json()
      if (controller.signal.aborted || requestId !== resultRequestRef.current || selectedKeyRef.current !== requestKey) return
      if (!isResult(result)) throw new Error('The result data is invalid. Please reload before editing.')
      if (result.session_id !== requestedSessionId || result.student_id !== nextStudent.id) {
        throw new Error('The server returned a result for a different student or session.')
      }
      setHeight(String(result.height_cm))
      setWeight(String(result.weight_kg))
      setVision(result.vision || '')
      setNotes(result.notes || '')
      setStatus(result.status)
      editableResultKeyRef.current = requestKey
      setResultLoadState('ready')
      setMessage('The saved result is ready to edit.')
    } catch (reason) {
      if (!controller.signal.aborted && requestId === resultRequestRef.current && selectedKeyRef.current === requestKey) {
        editableResultKeyRef.current = ''
        setResultLoadState('error')
        setError(reason instanceof Error ? reason.message : 'Could not load the result.')
      }
    }
  }

  async function saveResult(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (savingRef.current) return
    if (!sessionId || !student) return setError('Please select a checkup session and a participating student.')
    if (selectedKeyRef.current !== `${sessionId}\u0000${student.id}`) return setError('The selected student has changed. Please select the student again before saving.')
    if (!resultEditable || editableResultKeyRef.current !== selectedKeyRef.current) {
      return setError('The student result has not loaded. Please reload it before saving.')
    }
    const heightValue = Number(height)
    const weightValue = Number(weight)
    if (!height.trim() || !weight.trim() || !Number.isFinite(heightValue) || !Number.isFinite(weightValue) || heightValue <= 0 || weightValue <= 0) {
      return setError('Height and weight must be greater than 0.')
    }
    if (heightValue > 9999.9 || weightValue > 999.9 || Math.round(heightValue * 10) !== heightValue * 10 || Math.round(weightValue * 10) !== weightValue * 10) {
      return setError('Height must not exceed 9999.9 cm and weight must not exceed 999.9 kg; use at most one decimal place.')
    }
    const saveTarget = { sessionId, studentId: student.id, key: selectedKeyRef.current }
    const savePayload = { height_cm: heightValue, weight_kg: weightValue, vision: vision || null, notes: notes || null, status }
    savingRef.current = true
    setSaving(true)
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const url = `${API_BASE}/checkups/sessions/${encodeURIComponent(saveTarget.sessionId)}/students/${encodeURIComponent(saveTarget.studentId)}/result`
      const response = await fetch(url, {
        method: 'PUT',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(savePayload),
      })
      if (!response.ok) throw new Error(await responseError(response))
      const saved = await response.json() as Result
      if (saved.session_id !== saveTarget.sessionId || saved.student_id !== saveTarget.studentId) {
        throw new Error('The server returned a result for a different student or session.')
      }
      if (selectedKeyRef.current === saveTarget.key) setMessage(`Result saved. BMI: ${saved.bmi.toFixed(2)} · Status: ${saved.status}`)
    } catch (reason) {
      if (selectedKeyRef.current === saveTarget.key) setError(reason instanceof Error ? reason.message : 'Could not save the result.')
    } finally {
      savingRef.current = false
      setSaving(false)
      setBusy(false)
    }
  }

  const activeStep = student ? 2 : sessionId ? 1 : 0

  return (
    <div className="text-foreground">
      <div className="mx-auto max-w-4xl py-2">
        {route.kind === 'result-entry' && route.sessionId ? (
          <button type="button" disabled={saving} onClick={() => onSelectSession(route.sessionId)} className="mb-6 text-sm font-semibold text-primary-strong hover:underline disabled:opacity-50">← Back to checkup session</button>
        ) : (
          <button type="button" disabled={saving} onClick={onClose} className="mb-6 text-sm font-semibold text-primary-strong hover:underline disabled:opacity-50">← Home</button>
        )}
        <Card as="header" className="mb-6 p-6 sm:p-8">
          <p className="text-xs font-bold uppercase tracking-widest text-primary-strong">SchoolHealth · Nurse</p>
          <h1 className="mt-2 font-display text-3xl font-bold">Record checkup results</h1>
          <p className="mt-2 text-sm leading-6 text-muted">Results and BMI support record keeping; health staff select the follow-up status.</p>
          <Button variant="outline" disabled={saving} onClick={() => onSelectSession(null)} className="mt-4">Browse checkup sessions</Button>
        </Card>

        {!authorization ? (
          <p role="status" className="rounded-3xl border border-border bg-white p-6 text-sm text-muted">Loading your Nurse session…</p>
        ) : (
          <>
            <Card as="section" aria-label="Select a checkup session and student" className="mb-4 p-5 sm:p-6">
              <ol aria-label="Result entry steps" className="mb-6 grid gap-2 sm:grid-cols-3">
                {[
                  { label: '1. Select a checkup session' },
                  { label: '2. Select a student' },
                  { label: '3. Enter results' },
                ].map((step, index) => (
                  <li key={step.label} aria-current={index === activeStep ? 'step' : undefined} className={`rounded-control border px-3 py-2 text-sm font-semibold ${index < activeStep ? 'border-primary bg-primary-soft text-primary-strong' : index === activeStep ? 'border-secondary bg-secondary-soft text-secondary-strong' : 'border-border bg-surface text-muted'}`}>
                    <span className="mr-2" aria-hidden="true">{index < activeStep ? '✓' : '○'}</span>{step.label}
                  </li>
                ))}
              </ol>
              <label className="grid gap-1 text-sm font-semibold">Checkup session
                <Select value={sessionId} disabled={saving || (route.kind === 'result-entry' && route.sessionId !== null)} onChange={(event) => {
                  if (savingRef.current) return
                  rosterAbortRef.current?.abort()
                  rosterRequestRef.current += 1
                  // The aborted request's finally block is intentionally guarded by
                  // its request id. Release its loading state here when its session
                  // is superseded, otherwise the search button stays disabled.
                  setBusy(false)
                  clearStudentSelection()
                  setSessionId(event.target.value)
                  setStudents([])
                }} className="font-normal">
                  <option value="">Select a checkup session</option>
                  {sessions.map((session) => <option key={session.id} value={session.id}>{session.title} · {session.checkup_date}</option>)}
                </Select>
              </label>
              <form onSubmit={searchStudents} className="mt-4 flex flex-col gap-3 sm:flex-row">
                <label className="grid flex-1 gap-1 text-sm font-semibold">Search by name or student ID
                  <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Enter a name or ID" className="font-normal" />
                </label>
                <Button type="submit" variant="outline" loading={busy && route.kind === 'result-entry'} disabled={saving || !sessionId} className="self-end">Find students</Button>
              </form>
              {busy && route.kind === 'result-entry' && <p role="status" className="mt-3 text-sm text-muted">Loading session participants…</p>}
              {students.length > 0 && <div className="mt-3 grid gap-2 sm:grid-cols-2">{students.map((item) => (
                <button type="button" key={item.id} disabled={saving} aria-pressed={student?.id === item.id} onClick={() => void selectStudent(item)} className={`rounded-xl border p-3 text-left disabled:cursor-not-allowed disabled:opacity-60 ${student?.id === item.id ? 'border-primary bg-primary-soft' : 'border-border hover:bg-background'}`}>
                  <span className="block font-semibold">{item.full_name}</span><span className="text-sm text-muted">ID: {item.student_code} · Class {item.class_name}</span>
                </button>
              ))}</div>}
              {students.length === 0 && sessionId && !busy && <p className="mt-3 text-sm text-muted">Search only shows students participating in the selected checkup session.</p>}
            </Card>

            {student && <Card as="form" onSubmit={saveResult} className="grid gap-4 p-5 sm:p-8">
              <div className="rounded-2xl bg-background p-4"><p className="text-xs font-semibold uppercase tracking-wider text-muted">Selected student</p><p className="mt-1 font-display text-xl font-bold">{student.full_name}</p><p className="text-sm text-muted">ID {student.student_code} · Class {student.class_name}</p></div>
              {resultLoading && <p role="status" className="text-sm text-muted">Loading saved result…</p>}
              {resultLoadState === 'error' && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-4">
                  <p className="text-sm text-red-800">The result could not be loaded. The form is locked to protect saved data.</p>
                  <Button type="button" variant="outline" disabled={saving} onClick={() => void selectStudent(student)} className="mt-3">
                    Reload result
                  </Button>
                </div>
              )}
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-1 text-sm font-semibold">Height (cm)
                  <Input required disabled={!resultEditable || saving} type="number" min="0.1" max="9999.9" step="0.1" value={height} onChange={(event) => setHeight(event.target.value)} className="font-normal" />
                </label>
                <label className="grid gap-1 text-sm font-semibold">Weight (kg)
                  <Input required disabled={!resultEditable || saving} type="number" min="0.1" max="999.9" step="0.1" value={weight} onChange={(event) => setWeight(event.target.value)} className="font-normal" />
                </label>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-1 text-sm font-semibold">Vision (optional)
                  <Input disabled={!resultEditable || saving} value={vision} onChange={(event) => setVision(event.target.value)} maxLength={2000} className="font-normal" />
                </label>
                <label className="grid gap-1 text-sm font-semibold">Follow-up status selected by Nurse
                  <Select disabled={!resultEditable || saving} value={status} onChange={(event) => setStatus(event.target.value as Status)} className="font-normal"><option>Normal</option><option>Needs Follow-up</option></Select>
                </label>
              </div>
              <label className="grid gap-1 text-sm font-semibold">Notes (optional)
                <textarea disabled={!resultEditable || saving} value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={5000} rows={3} className="rounded-xl border border-border px-3 py-2.5 font-normal disabled:opacity-60" />
              </label>
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-primary-soft p-4"><span className="font-semibold">Calculated BMI</span><output aria-live="polite" className="font-display text-2xl font-bold">{formatBmi(bmi)}</output></div>
              <Button type="submit" loading={saving} loadingLabel="Saving…" disabled={busy || !resultEditable} className="w-full sm:w-fit">Save / update result</Button>
            </Card>}
          </>
        )}
        {error && <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
        {message && <p role="status" className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{message}</p>}
      </div>
    </div>
  )
}
