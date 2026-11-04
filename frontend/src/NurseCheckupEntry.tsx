import { useState, type FormEvent } from 'react'
import { calculateBmi, formatBmi } from './checkupMath.js'

type Session = { id: string; title: string; checkup_date: string }
type Student = { id: string; student_code: string; full_name: string; class_name: string }
type Status = 'Normal' | 'Needs Follow-up'
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

async function responseError(response: Response) {
  try {
    const body = await response.json() as { detail?: string }
    return body.detail || `Request failed (${response.status})`
  } catch {
    return `Request failed (${response.status})`
  }
}

export function NurseCheckupEntry({ onClose }: { onClose: () => void }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
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

  const bmi = calculateBmi(height, weight)

  function authHeaders() {
    return { Authorization: authorization }
  }

  async function connect(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError('')
    setMessage('')
    const credentialBytes = new TextEncoder().encode(`${username}:${password}`)
    const credentialBinary = Array.from(credentialBytes, (byte) => String.fromCharCode(byte)).join('')
    const token = `Basic ${btoa(credentialBinary)}`
    try {
      const response = await fetch(`${API_BASE}/checkups/sessions`, { headers: { Authorization: token } })
      if (!response.ok) throw new Error(await responseError(response))
      setSessions(await response.json() as Session[])
      setAuthorization(token)
      setPassword('')
      setMessage('Đã xác thực tài khoản Nurse.')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không thể kết nối API.')
    } finally {
      setBusy(false)
    }
  }

  async function searchStudents(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!sessionId) return setError('Vui lòng chọn phiên khám trước.')
    setBusy(true)
    setError('')
    setMessage('')
    setStudent(null)
    try {
      const params = new URLSearchParams({ q: search })
      const response = await fetch(`${API_BASE}/checkups/sessions/${encodeURIComponent(sessionId)}/students?${params}`, { headers: authHeaders() })
      if (!response.ok) throw new Error(await responseError(response))
      setStudents(await response.json() as Student[])
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không thể tìm học sinh.')
    } finally {
      setBusy(false)
    }
  }

  async function selectStudent(nextStudent: Student) {
    setStudent(nextStudent)
    setError('')
    setMessage('')
    setHeight('')
    setWeight('')
    setVision('')
    setNotes('')
    setStatus('Normal')
    const url = `${API_BASE}/checkups/sessions/${encodeURIComponent(sessionId)}/students/${encodeURIComponent(nextStudent.id)}/result`
    try {
      const response = await fetch(url, { headers: authHeaders() })
      if (response.status === 404) return
      if (!response.ok) throw new Error(await responseError(response))
      const result = await response.json() as Result
      setHeight(String(result.height_cm))
      setWeight(String(result.weight_kg))
      setVision(result.vision || '')
      setNotes(result.notes || '')
      setStatus(result.status)
      setMessage('Đã mở kết quả đã lưu để chỉnh sửa.')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không thể tải kết quả.')
    }
  }

  async function saveResult(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!sessionId || !student) return setError('Vui lòng chọn phiên khám và học sinh tham gia.')
    if (!height.trim() || !weight.trim() || Number(height) <= 0 || Number(weight) <= 0) return setError('Chiều cao và cân nặng phải lớn hơn 0.')
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const url = `${API_BASE}/checkups/sessions/${encodeURIComponent(sessionId)}/students/${encodeURIComponent(student.id)}/result`
      const response = await fetch(url, {
        method: 'PUT',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ height_cm: Number(height), weight_kg: Number(weight), vision: vision || null, notes: notes || null, status }),
      })
      if (!response.ok) throw new Error(await responseError(response))
      const saved = await response.json() as Result
      setMessage(`Đã lưu kết quả. BMI: ${saved.bmi.toFixed(2)} · Trạng thái: ${saved.status}`)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không thể lưu kết quả.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="min-h-screen bg-background px-4 py-8 text-foreground sm:px-8">
      <div className="mx-auto max-w-4xl">
        <button type="button" onClick={onClose} className="mb-6 text-sm font-semibold text-primary-strong hover:underline">← Trang chủ</button>
        <header className="mb-6 rounded-3xl border border-border bg-white p-6 sm:p-8">
          <p className="text-xs font-bold uppercase tracking-widest text-primary-strong">SchoolHealth · Nurse</p>
          <h1 className="mt-2 font-display text-3xl font-bold">Nhập kết quả khám sức khỏe</h1>
          <p className="mt-2 text-sm leading-6 text-muted">Kết quả và BMI hỗ trợ ghi nhận thông tin; quyết định theo dõi do nhân viên y tế lựa chọn.</p>
        </header>

        {!authorization ? (
          <form onSubmit={connect} className="grid gap-4 rounded-3xl border border-border bg-white p-6 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <label className="grid gap-1 text-sm font-semibold">Tài khoản Nurse
              <input required value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" className="rounded-xl border border-border px-3 py-2.5 font-normal" />
            </label>
            <label className="grid gap-1 text-sm font-semibold">Mật khẩu
              <input required type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" className="rounded-xl border border-border px-3 py-2.5 font-normal" />
            </label>
            <button disabled={busy} className="min-h-11 rounded-xl bg-primary px-5 font-semibold text-white disabled:opacity-60">{busy ? 'Đang xác thực…' : 'Kết nối'}</button>
          </form>
        ) : (
          <>
            <section className="mb-4 rounded-3xl border border-border bg-white p-6">
              <label className="grid gap-1 text-sm font-semibold">Phiên khám
                <select value={sessionId} onChange={(event) => { setSessionId(event.target.value); setStudents([]); setStudent(null); setMessage(''); setError('') }} className="rounded-xl border border-border bg-white px-3 py-2.5 font-normal">
                  <option value="">Chọn phiên khám</option>
                  {sessions.map((session) => <option key={session.id} value={session.id}>{session.title} · {session.checkup_date}</option>)}
                </select>
              </label>
              <form onSubmit={searchStudents} className="mt-4 flex flex-col gap-3 sm:flex-row">
                <label className="grid flex-1 gap-1 text-sm font-semibold">Tìm theo tên hoặc Mã học sinh
                  <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nhập tên hoặc mã" className="rounded-xl border border-border px-3 py-2.5 font-normal" />
                </label>
                <button disabled={busy || !sessionId} className="self-end rounded-xl border border-primary px-5 py-2.5 font-semibold text-primary-strong disabled:opacity-50">Tìm học sinh</button>
              </form>
              {students.length > 0 && <div className="mt-3 grid gap-2 sm:grid-cols-2">{students.map((item) => (
                <button type="button" key={item.id} onClick={() => void selectStudent(item)} className={`rounded-xl border p-3 text-left ${student?.id === item.id ? 'border-primary bg-primary-soft' : 'border-border hover:bg-background'}`}>
                  <span className="block font-semibold">{item.full_name}</span><span className="text-sm text-muted">Mã: {item.student_code} · Lớp {item.class_name}</span>
                </button>
              ))}</div>}
              {students.length === 0 && sessionId && <p className="mt-3 text-sm text-muted">Tìm kiếm chỉ hiển thị học sinh tham gia phiên khám đã chọn.</p>}
            </section>

            {student && <form onSubmit={saveResult} className="grid gap-4 rounded-3xl border border-border bg-white p-6 sm:p-8">
              <div className="rounded-2xl bg-background p-4"><p className="text-xs font-semibold uppercase tracking-wider text-muted">Học sinh được chọn</p><p className="mt-1 font-display text-xl font-bold">{student.full_name}</p><p className="text-sm text-muted">Mã {student.student_code} · Lớp {student.class_name}</p></div>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-1 text-sm font-semibold">Chiều cao (cm)
                  <input required type="number" min="0.1" step="0.1" value={height} onChange={(event) => setHeight(event.target.value)} className="rounded-xl border border-border px-3 py-2.5 font-normal" />
                </label>
                <label className="grid gap-1 text-sm font-semibold">Cân nặng (kg)
                  <input required type="number" min="0.1" step="0.1" value={weight} onChange={(event) => setWeight(event.target.value)} className="rounded-xl border border-border px-3 py-2.5 font-normal" />
                </label>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-1 text-sm font-semibold">Thị lực (tùy chọn)
                  <input value={vision} onChange={(event) => setVision(event.target.value)} maxLength={2000} className="rounded-xl border border-border px-3 py-2.5 font-normal" />
                </label>
                <label className="grid gap-1 text-sm font-semibold">Trạng thái theo dõi do Nurse chọn
                  <select value={status} onChange={(event) => setStatus(event.target.value as Status)} className="rounded-xl border border-border bg-white px-3 py-2.5 font-normal"><option>Normal</option><option>Needs Follow-up</option></select>
                </label>
              </div>
              <label className="grid gap-1 text-sm font-semibold">Ghi chú (tùy chọn)
                <textarea value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={5000} rows={3} className="rounded-xl border border-border px-3 py-2.5 font-normal" />
              </label>
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-primary-soft p-4"><span className="font-semibold">BMI tính toán</span><output aria-live="polite" className="font-display text-2xl font-bold">{formatBmi(bmi)}</output></div>
              <button disabled={busy} className="min-h-12 rounded-xl bg-primary px-6 font-semibold text-white disabled:opacity-60">{busy ? 'Đang lưu…' : 'Lưu / cập nhật kết quả'}</button>
            </form>}
          </>
        )}
        {error && <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
        {message && <p role="status" className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{message}</p>}
      </div>
    </main>
  )
}
