import { useEffect, useRef, useState, type FormEvent } from 'react'
import { calculateBmi, formatBmi } from './checkupMath.js'
import CheckupSessionsPage from './pages/CheckupSessionsPage'
import { getAccessToken, signOut } from './auth'

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
          setError(reason instanceof Error ? reason.message : 'Không thể tải danh sách học sinh.')
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
    if (!sessionId) return setError('Vui lòng chọn phiên khám trước.')
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
        setError(reason instanceof Error ? reason.message : 'Không thể tìm học sinh.')
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
          throw new Error(typeof body?.detail === 'string' ? body.detail : 'Không xác nhận được trạng thái kết quả. Hãy tải lại.')
        }
        if (controller.signal.aborted || requestId !== resultRequestRef.current || selectedKeyRef.current !== requestKey) return
        editableResultKeyRef.current = requestKey
        setResultLoadState('ready')
        return
      }
      if (!response.ok) throw new Error(await responseError(response))
      const result: unknown = await response.json()
      if (controller.signal.aborted || requestId !== resultRequestRef.current || selectedKeyRef.current !== requestKey) return
      if (!isResult(result)) throw new Error('Dữ liệu kết quả không hợp lệ. Hãy tải lại trước khi chỉnh sửa.')
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
      setMessage('Đã mở kết quả đã lưu để chỉnh sửa.')
    } catch (reason) {
      if (!controller.signal.aborted && requestId === resultRequestRef.current && selectedKeyRef.current === requestKey) {
        editableResultKeyRef.current = ''
        setResultLoadState('error')
        setError(reason instanceof Error ? reason.message : 'Không thể tải kết quả.')
      }
    }
  }

  async function saveResult(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (savingRef.current) return
    if (!sessionId || !student) return setError('Vui lòng chọn phiên khám và học sinh tham gia.')
    if (selectedKeyRef.current !== `${sessionId}\u0000${student.id}`) return setError('Lựa chọn học sinh đã thay đổi. Hãy chọn lại học sinh trước khi lưu.')
    if (!resultEditable || editableResultKeyRef.current !== selectedKeyRef.current) {
      return setError('Chưa tải được kết quả học sinh. Hãy tải lại thành công trước khi lưu.')
    }
    const heightValue = Number(height)
    const weightValue = Number(weight)
    if (!height.trim() || !weight.trim() || !Number.isFinite(heightValue) || !Number.isFinite(weightValue) || heightValue <= 0 || weightValue <= 0) {
      return setError('Chiều cao và cân nặng phải lớn hơn 0.')
    }
    if (heightValue > 9999.9 || weightValue > 999.9 || Math.round(heightValue * 10) !== heightValue * 10 || Math.round(weightValue * 10) !== weightValue * 10) {
      return setError('Chiều cao tối đa 9999,9 cm và cân nặng tối đa 999,9 kg; mỗi số đo chỉ có một chữ số thập phân.')
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
      if (selectedKeyRef.current === saveTarget.key) setMessage(`Đã lưu kết quả. BMI: ${saved.bmi.toFixed(2)} · Trạng thái: ${saved.status}`)
    } catch (reason) {
      if (selectedKeyRef.current === saveTarget.key) setError(reason instanceof Error ? reason.message : 'Không thể lưu kết quả.')
    } finally {
      savingRef.current = false
      setSaving(false)
      setBusy(false)
    }
  }

  return (
    <main className="min-h-screen bg-background px-4 py-8 text-foreground sm:px-8">
      <div className="mx-auto max-w-4xl">
        {route.kind === 'result-entry' && route.sessionId ? (
          <button type="button" disabled={saving} onClick={() => onSelectSession(route.sessionId)} className="mb-6 text-sm font-semibold text-primary-strong hover:underline disabled:opacity-50">← Quay lại phiên khám</button>
        ) : (
          <button type="button" disabled={saving} onClick={onClose} className="mb-6 text-sm font-semibold text-primary-strong hover:underline disabled:opacity-50">← Trang chủ</button>
        )}
        <header className="mb-6 rounded-3xl border border-border bg-white p-6 sm:p-8">
          <p className="text-xs font-bold uppercase tracking-widest text-primary-strong">SchoolHealth · Nurse</p>
          <h1 className="mt-2 font-display text-3xl font-bold">Nhập kết quả khám sức khỏe</h1>
          <p className="mt-2 text-sm leading-6 text-muted">Kết quả và BMI hỗ trợ ghi nhận thông tin; quyết định theo dõi do nhân viên y tế lựa chọn.</p>
        </header>

        {!authorization ? (
          <p role="status" className="rounded-3xl border border-border bg-white p-6 text-sm text-muted">Loading your Nurse session…</p>
        ) : (
          <>
            <section className="mb-4 rounded-3xl border border-border bg-white p-6">
              <label className="grid gap-1 text-sm font-semibold">Phiên khám
                <select value={sessionId} disabled={saving || (route.kind === 'result-entry' && route.sessionId !== null)} onChange={(event) => {
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
                }} className="rounded-xl border border-border bg-white px-3 py-2.5 font-normal disabled:opacity-60">
                  <option value="">Chọn phiên khám</option>
                  {sessions.map((session) => <option key={session.id} value={session.id}>{session.title} · {session.checkup_date}</option>)}
                </select>
              </label>
              <form onSubmit={searchStudents} className="mt-4 flex flex-col gap-3 sm:flex-row">
                <label className="grid flex-1 gap-1 text-sm font-semibold">Tìm theo tên hoặc Mã học sinh
                  <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nhập tên hoặc mã" className="rounded-xl border border-border px-3 py-2.5 font-normal" />
                </label>
                <button disabled={busy || saving || !sessionId} className="self-end rounded-xl border border-primary px-5 py-2.5 font-semibold text-primary-strong disabled:opacity-50">Tìm học sinh</button>
              </form>
              {busy && route.kind === 'result-entry' && <p role="status" className="mt-3 text-sm text-muted">Đang tải học sinh trong phiên…</p>}
              {students.length > 0 && <div className="mt-3 grid gap-2 sm:grid-cols-2">{students.map((item) => (
                <button type="button" key={item.id} disabled={saving} aria-pressed={student?.id === item.id} onClick={() => void selectStudent(item)} className={`rounded-xl border p-3 text-left disabled:cursor-not-allowed disabled:opacity-60 ${student?.id === item.id ? 'border-primary bg-primary-soft' : 'border-border hover:bg-background'}`}>
                  <span className="block font-semibold">{item.full_name}</span><span className="text-sm text-muted">Mã: {item.student_code} · Lớp {item.class_name}</span>
                </button>
              ))}</div>}
              {students.length === 0 && sessionId && !busy && <p className="mt-3 text-sm text-muted">Tìm kiếm chỉ hiển thị học sinh tham gia phiên khám đã chọn.</p>}
            </section>

            {student && <form onSubmit={saveResult} className="grid gap-4 rounded-3xl border border-border bg-white p-6 sm:p-8">
              <div className="rounded-2xl bg-background p-4"><p className="text-xs font-semibold uppercase tracking-wider text-muted">Học sinh được chọn</p><p className="mt-1 font-display text-xl font-bold">{student.full_name}</p><p className="text-sm text-muted">Mã {student.student_code} · Lớp {student.class_name}</p></div>
              {resultLoading && <p role="status" className="text-sm text-muted">Đang tải kết quả đã lưu…</p>}
              {resultLoadState === 'error' && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-4">
                  <p className="text-sm text-red-800">Chưa tải được kết quả. Form được khóa để bảo vệ dữ liệu đã lưu.</p>
                  <button type="button" disabled={saving} onClick={() => void selectStudent(student)} className="mt-3 min-h-11 rounded-xl border border-primary px-4 font-semibold text-primary-strong disabled:opacity-50">
                    Tải lại kết quả
                  </button>
                </div>
              )}
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-1 text-sm font-semibold">Chiều cao (cm)
                  <input required disabled={!resultEditable || saving} type="number" min="0.1" max="9999.9" step="0.1" value={height} onChange={(event) => setHeight(event.target.value)} className="rounded-xl border border-border px-3 py-2.5 font-normal disabled:opacity-60" />
                </label>
                <label className="grid gap-1 text-sm font-semibold">Cân nặng (kg)
                  <input required disabled={!resultEditable || saving} type="number" min="0.1" max="999.9" step="0.1" value={weight} onChange={(event) => setWeight(event.target.value)} className="rounded-xl border border-border px-3 py-2.5 font-normal disabled:opacity-60" />
                </label>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-1 text-sm font-semibold">Thị lực (tùy chọn)
                  <input disabled={!resultEditable || saving} value={vision} onChange={(event) => setVision(event.target.value)} maxLength={2000} className="rounded-xl border border-border px-3 py-2.5 font-normal disabled:opacity-60" />
                </label>
                <label className="grid gap-1 text-sm font-semibold">Trạng thái theo dõi do Nurse chọn
                  <select disabled={!resultEditable || saving} value={status} onChange={(event) => setStatus(event.target.value as Status)} className="rounded-xl border border-border bg-white px-3 py-2.5 font-normal disabled:opacity-60"><option>Normal</option><option>Needs Follow-up</option></select>
                </label>
              </div>
              <label className="grid gap-1 text-sm font-semibold">Ghi chú (tùy chọn)
                <textarea disabled={!resultEditable || saving} value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={5000} rows={3} className="rounded-xl border border-border px-3 py-2.5 font-normal disabled:opacity-60" />
              </label>
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-primary-soft p-4"><span className="font-semibold">BMI tính toán</span><output aria-live="polite" className="font-display text-2xl font-bold">{formatBmi(bmi)}</output></div>
              <button disabled={busy || saving || !resultEditable} className="min-h-12 rounded-xl bg-primary px-6 font-semibold text-white disabled:opacity-60">{saving ? 'Đang lưu…' : 'Lưu / cập nhật kết quả'}</button>
            </form>}
          </>
        )}
        {error && <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
        {message && <p role="status" className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{message}</p>}
      </div>
    </main>
  )
}
