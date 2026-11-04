import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { authenticatedFetch, signOut } from './auth'

type Student = { id: string; full_name: string; class_name: string; parentid?: string | null; nurseid?: string | null }
type Profile = Student & { allergies: string | null; medical_notes: string | null }
type Session = { id: string; title: string; checkup_date: string }
type Result = Profile & {
  status: 'completed' | 'follow_up' | 'pending' | 'absent'
  height_cm: number | null; weight_kg: number | null; bmi: number | null
  vision_left: string | null; vision_right: string | null; notes: string | null
}

const input = 'mt-1 w-full rounded-xl border border-border bg-white px-3.5 py-3 text-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10'
const button = 'inline-flex min-h-10 items-center justify-center rounded-xl bg-primary-strong px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-mid disabled:cursor-not-allowed disabled:opacity-50'
const secondary = 'inline-flex min-h-10 items-center justify-center rounded-xl border border-border bg-white px-4 py-2 text-sm font-semibold text-foreground transition hover:border-primary hover:text-primary-strong disabled:opacity-50'

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await authenticatedFetch(path, options)
  if (!response.ok) {
    let detail = ''
    try { detail = (await response.json()).detail ?? '' } catch { /* response may have no body */ }
    if (response.status === 403) throw new Error('This workspace is only available to Nurse accounts.')
    if (response.status === 409) throw new Error('That student ID already exists.')
    if (response.status === 422) throw new Error('Check the entered values and try again.')
    if (response.status === 404) throw new Error(detail || 'The requested record was not found.')
    throw new Error(detail || 'The request could not be completed. Please try again.')
  }
  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

function errorMessage(error: unknown) {
  if (error instanceof TypeError) return 'Could not connect to the SchoolHealth API.'
  return error instanceof Error ? error.message : 'Something went wrong.'
}

function statusLabel(status: Result['status']) {
  return ({ completed: 'Completed', follow_up: 'Follow-up', pending: 'Pending', absent: 'Absent' })[status]
}

function StatusPill({ status }: { status: Result['status'] }) {
  const colors = {
    completed: 'bg-emerald-50 text-emerald-700', follow_up: 'bg-amber-50 text-amber-800',
    pending: 'bg-slate-100 text-slate-600', absent: 'bg-rose-50 text-rose-700',
  }
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${colors[status]}`}>{statusLabel(status)}</span>
}

function StudentForm({ profile, onSaved, onSaving }: {
  profile: Profile | null; onSaved: (profile: Profile) => void; onSaving: (value: boolean) => void
}) {
  const [error, setError] = useState('')
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const id = String(form.get('id')).trim()
    const values = {
      full_name: String(form.get('full_name')).trim(), class_name: String(form.get('class_name')).trim(),
      allergies: String(form.get('allergies')).trim() || null,
      medical_notes: String(form.get('medical_notes')).trim() || null,
      parentid: String(form.get('parentid')).trim(), nurseid: String(form.get('nurseid')).trim(),
    }
    setError(''); onSaving(true)
    try {
      const body = profile
        ? Object.fromEntries(Object.entries(values).filter(([key, value]) => value !== profile[key as keyof Profile]))
        : { id, ...values }
      const saved = await request<Profile>(profile ? `/students/${encodeURIComponent(profile.id)}` : '/students', {
        method: profile ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      })
      onSaved(saved)
    } catch (cause) { setError(errorMessage(cause)) } finally { onSaving(false) }
  }
  return <form onSubmit={save} className="mt-5 space-y-4">
    <label className="block text-sm font-semibold">Student ID<input className={input} name="id" defaultValue={profile?.id} required maxLength={50} readOnly={Boolean(profile)} pattern="[A-Za-z0-9]+" placeholder="e.g. STU001" /></label>
    <label className="block text-sm font-semibold">Full name<input className={input} name="full_name" defaultValue={profile?.full_name} required maxLength={200} /></label>
    <label className="block text-sm font-semibold">Class / grade<input className={input} name="class_name" defaultValue={profile?.class_name} required maxLength={50} placeholder="e.g. 6A1" /></label>
    <label className="block text-sm font-semibold">Parent account ID<input className={input} name="parentid" defaultValue={profile?.parentid ?? ''} required maxLength={50} placeholder="e.g. PARENT001" /></label>
    <label className="block text-sm font-semibold">Nurse account ID<input className={input} name="nurseid" defaultValue={profile?.nurseid ?? ''} required maxLength={50} placeholder="e.g. NURSE001" /></label>
    <label className="block text-sm font-semibold">Allergies<textarea className={input} name="allergies" defaultValue={profile?.allergies ?? ''} rows={2} maxLength={2000} placeholder="No known allergies or add details" /></label>
    <label className="block text-sm font-semibold">Relevant health notes<textarea className={input} name="medical_notes" defaultValue={profile?.medical_notes ?? ''} rows={3} maxLength={2000} /></label>
    {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
    <button className={button} type="submit">{profile ? 'Save student details' : 'Add student'}</button>
  </form>
}

export default function NurseStudents() {
  const [tab, setTab] = useState<'students' | 'checkups'>('students')
  const [query, setQuery] = useState('')
  const [search, setSearch] = useState('')
  const [students, setStudents] = useState<Student[]>([])
  const [profile, setProfile] = useState<Profile | null>(null)
  const [sessions, setSessions] = useState<Session[]>([])
  const [sessionId, setSessionId] = useState('')
  const [results, setResults] = useState<Result[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [selectedResult, setSelectedResult] = useState<Result | null>(null)
  const [addingStudent, setAddingStudent] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [draftBmi, setDraftBmi] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(query.trim()), 250)
    return () => window.clearTimeout(timer)
  }, [query])

  useEffect(() => {
    let cancelled = false
    setLoading(true); setError('')
    Promise.all([
      request<Student[]>(`/students?q=${encodeURIComponent(search)}`),
      request<Session[]>('/checkup-sessions'),
    ]).then(([studentRows, sessionRows]) => {
      if (cancelled) return
      setStudents(studentRows); setSessions(sessionRows)
      setSessionId((current) => current || sessionRows[0]?.id || '')
    }).catch((cause: unknown) => { if (!cancelled) setError(errorMessage(cause)) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [search])

  useEffect(() => {
    if (!sessionId) { setResults([]); return }
    let cancelled = false
    request<Result[]>(`/checkup-sessions/${encodeURIComponent(sessionId)}/results?q=${encodeURIComponent(search)}`)
      .then((rows) => { if (!cancelled) setResults(rows) })
      .catch((cause: unknown) => { if (!cancelled) setError(errorMessage(cause)) })
    return () => { cancelled = true }
  }, [sessionId, search])

  useEffect(() => {
    if (!selectedId) { setProfile(null); return }
    let cancelled = false
    request<Profile>(`/students/${encodeURIComponent(selectedId)}`)
      .then((item) => { if (!cancelled) setProfile(item) })
      .catch((cause: unknown) => { if (!cancelled) setError(errorMessage(cause)) })
    return () => { cancelled = true }
  }, [selectedId])

  const selectedSession = sessions.find((session) => session.id === sessionId)
  const completion = useMemo(() => ({
    done: results.filter((item) => item.status === 'completed' || item.status === 'follow_up').length,
    total: results.length,
  }), [results])

  function selectStudent(studentId: string) {
    setSelectedId(studentId); setSelectedResult(null); setAddingStudent(false); setNotice(''); setError('')
  }

  function studentSaved(saved: Profile) {
    setStudents((current) => [...current.filter((item) => item.id !== saved.id), saved].sort((a, b) => a.id.localeCompare(b.id)))
    setProfile(saved); setSelectedId(saved.id); setAddingStudent(false); setNotice('Student details saved.')
  }

  async function deleteStudent() {
    if (!profile || !window.confirm(`Permanently delete ${profile.full_name} (${profile.id}) and its related health/checkup records?`)) return
    setSaving(true); setError(''); setNotice('')
    try {
      await request<void>(`/students/${encodeURIComponent(profile.id)}`, { method: 'DELETE' })
      setStudents((current) => current.filter((item) => item.id !== profile.id))
      setResults((current) => current.filter((item) => item.id !== profile.id))
      setProfile(null); setSelectedId(''); setSelectedResult(null); setNotice('Student and related records deleted.')
    } catch (cause) { setError(errorMessage(cause)) } finally { setSaving(false) }
  }

  async function saveResult(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!sessionId || !selectedResult) return
    const fields = new FormData(event.currentTarget)
    const numberOrNull = (name: string) => String(fields.get(name)).trim() ? Number(fields.get(name)) : null
    const payload = {
      status: String(fields.get('status')),
      height_cm: numberOrNull('height_cm'), weight_kg: numberOrNull('weight_kg'),
      vision_left: String(fields.get('vision_left')).trim() || null,
      vision_right: String(fields.get('vision_right')).trim() || null,
      notes: String(fields.get('notes')).trim() || null,
    }
    setSaving(true); setError(''); setNotice('')
    try {
      const saved = await request<Result>(`/checkup-sessions/${encodeURIComponent(sessionId)}/results/${encodeURIComponent(selectedResult.id)}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      })
      setResults((current) => current.map((item) => item.id === saved.id ? saved : item))
      setSelectedResult(saved); setDraftBmi(saved.bmi); setNotice('Examination record saved.')
    } catch (cause) { setError(errorMessage(cause)) } finally { setSaving(false) }
  }

  async function deleteResult() {
    if (!selectedResult || !sessionId || !window.confirm(`Remove the examination record for ${selectedResult.full_name}?`)) return
    setSaving(true); setError(''); setNotice('')
    try {
      await request<void>(`/checkup-sessions/${encodeURIComponent(sessionId)}/results/${encodeURIComponent(selectedResult.id)}`, { method: 'DELETE' })
      const pending = { ...selectedResult, status: 'pending' as const, height_cm: null, weight_kg: null, bmi: null, vision_left: null, vision_right: null, notes: null }
      setResults((current) => current.map((item) => item.id === pending.id ? pending : item))
      setSelectedResult(null); setNotice('Examination record removed. The student remains in the session as pending.')
    } catch (cause) { setError(errorMessage(cause)) } finally { setSaving(false) }
  }

  function signOutNow() { signOut(); window.location.assign('/') }

  return <main className="min-h-screen bg-background text-foreground">
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-8 sm:py-9">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-6">
        <a href="/" className="flex items-center gap-3" aria-label="SchoolHealth home">
          <span className="grid size-10 place-items-center rounded-xl bg-primary text-xl text-white">+</span>
          <span className="font-display text-lg font-extrabold tracking-tight">school<span className="text-primary-strong">health</span></span>
        </a>
        <div className="flex items-center gap-3">
          <span className="rounded-full bg-primary-soft px-3 py-1.5 text-xs font-semibold text-primary-strong">Nurse workspace</span>
          <button className={secondary} onClick={signOutNow} type="button">Sign out</button>
        </div>
      </header>

      <section className="py-8 sm:py-10">
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div><p className="text-sm font-semibold text-primary-strong">School health services</p><h1 className="mt-1 font-display text-3xl font-bold tracking-tight sm:text-4xl">Nurse workspace</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-muted">Review student health profiles and record examination results for each checkup session.</p></div>
          {tab === 'checkups' && <div className="rounded-2xl border border-border bg-white px-4 py-3"><p className="text-xs font-medium text-muted">SESSION PROGRESS</p><p className="mt-1 font-semibold">{completion.done} of {completion.total} recorded</p></div>}
        </div>
      </section>

      <nav className="mb-5 flex gap-2 border-b border-border" aria-label="Nurse workspace sections">
        {(['students', 'checkups'] as const).map((item) => <button key={item} type="button" onClick={() => { setTab(item); setError(''); setNotice('') }} className={`border-b-2 px-4 py-3 text-sm font-semibold capitalize ${tab === item ? 'border-primary text-primary-strong' : 'border-transparent text-muted hover:text-foreground'}`}>{item === 'students' ? 'Students' : 'Checkups'}</button>)}
      </nav>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <label className="relative block w-full sm:max-w-md"><span className="sr-only">Search students</span><input className={`${input} !mt-0 pl-10`} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by name, student ID, or class" /><span aria-hidden="true" className="absolute left-3.5 top-3 text-muted">⌕</span></label>
        {tab === 'students' ? <button className={button} type="button" onClick={() => { setAddingStudent(true); setProfile(null); setSelectedId(''); setSelectedResult(null); setNotice(''); setError('') }}>+ Add student</button> : <label className="text-sm font-semibold">Checkup session<select className={`${input} !mt-0 sm:w-72`} value={sessionId} onChange={(event) => { setSessionId(event.target.value); setSelectedResult(null) }}>{sessions.map((session) => <option key={session.id} value={session.id}>{session.title} · {session.checkup_date}</option>)}</select></label>}
      </div>

      {error && <p role="alert" className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</p>}
      {notice && <p role="status" className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</p>}
      {loading ? <div className="rounded-2xl border border-border bg-white p-8 text-sm text-muted" role="status">Loading SchoolHealth records…</div> : <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.78fr)]">
        <section className="overflow-hidden rounded-2xl border border-border bg-white">
          <div className="flex items-center justify-between border-b border-border px-5 py-4"><div><h2 className="font-display text-lg font-bold">{tab === 'students' ? 'Student directory' : 'Session roster'}</h2><p className="mt-0.5 text-sm text-muted">{tab === 'students' ? `${students.length} students` : `${results.length} students · ${selectedSession?.title ?? 'No session selected'}`}</p></div></div>
        {tab === 'students' ? students.length === 0 ? <p className="p-6 text-sm text-muted">No students match this search.</p> : <div className="divide-y divide-border">{students.map((student) => <button key={student.id} type="button" onClick={() => selectStudent(student.id)} aria-pressed={selectedId === student.id} className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition hover:bg-background aria-pressed:bg-primary-soft"><span className="min-w-0"><span className="block truncate text-sm font-semibold">{student.full_name}</span><span className="mt-1 block text-xs text-muted">{student.id}</span></span><span className="shrink-0 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">{student.class_name}</span></button>)}</div> : results.length === 0 ? <p className="p-6 text-sm text-muted">No students match this search.</p> : <div className="divide-y divide-border">{results.map((item) => <button key={item.id} type="button" onClick={() => { setSelectedResult(item); setDraftBmi(item.bmi); setSelectedId(item.id); setAddingStudent(false); setNotice('') }} aria-pressed={selectedResult?.id === item.id} className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition hover:bg-background aria-pressed:bg-primary-soft"><span className="min-w-0"><span className="block truncate text-sm font-semibold">{item.full_name}</span><span className="mt-1 block text-xs text-muted">{item.id} · {item.class_name}</span></span><span className="flex shrink-0 flex-col items-end gap-1"><StatusPill status={item.status} />{item.bmi !== null && <span className="text-xs text-muted">BMI {item.bmi.toFixed(1)}</span>}</span></button>)}</div>}
        </section>

        <section className="rounded-2xl border border-border bg-white p-5 sm:p-6">
          {tab === 'students' ? <><p className="text-xs font-bold uppercase tracking-wider text-primary-strong">Student profile</p><h2 className="mt-1 font-display text-xl font-bold">{addingStudent ? 'Add a student' : profile?.full_name ?? 'Select a student'}</h2>{profile && !addingStudent && <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted"><span className="rounded-full bg-background px-3 py-1.5">{profile.id}</span><span className="rounded-full bg-background px-3 py-1.5">Class {profile.class_name}</span></div>}{addingStudent || profile ? <><StudentForm key={profile?.id ?? 'new'} profile={addingStudent ? null : profile} onSaved={studentSaved} onSaving={setSaving} /><div className="mt-4 border-t border-border pt-4">{profile && <button className="rounded-xl border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50" type="button" disabled={saving} onClick={deleteStudent}>Delete student</button>}</div></> : <p className="mt-3 text-sm leading-6 text-muted">Choose a student from the directory to review or update available health information. Age, gender, and guardian contact are not currently part of the shared student data model.</p>}</> : <>
            <p className="text-xs font-bold uppercase tracking-wider text-primary-strong">Examination record</p><h2 className="mt-1 font-display text-xl font-bold">{selectedResult?.full_name ?? 'Select a student'}</h2>
            {selectedResult ? <><p className="mt-1 text-sm text-muted">{selectedResult.id} · Class {selectedResult.class_name}</p>{(selectedResult.allergies || selectedResult.medical_notes) && <div className="mt-4 rounded-xl bg-amber-50 p-3 text-sm"><strong>Health information</strong>{selectedResult.allergies && <p className="mt-1">Allergies: {selectedResult.allergies}</p>}{selectedResult.medical_notes && <p className="mt-1">Notes: {selectedResult.medical_notes}</p>}</div>}
              <form key={`${sessionId}:${selectedResult.id}`} onSubmit={saveResult} className="mt-5 space-y-4">
                <label className="block text-sm font-semibold">Examination status<select className={input} name="status" defaultValue={selectedResult.status}><option value="pending">Pending</option><option value="completed">Completed</option><option value="follow_up">Follow-up</option><option value="absent">Absent</option></select></label>
                <div className="grid grid-cols-2 gap-3"><label className="block text-sm font-semibold">Height (cm)<input className={input} name="height_cm" type="number" min="0.1" max="300" step="0.1" defaultValue={selectedResult.height_cm ?? ''} onChange={(event) => { const form = event.currentTarget.form; const height = Number(event.currentTarget.value); const weight = Number(form ? new FormData(form).get('weight_kg') : 0); setDraftBmi(height > 0 && weight > 0 ? Math.round((weight / ((height / 100) ** 2)) * 10) / 10 : null) }} /></label><label className="block text-sm font-semibold">Weight (kg)<input className={input} name="weight_kg" type="number" min="0.1" max="500" step="0.1" defaultValue={selectedResult.weight_kg ?? ''} onChange={(event) => { const form = event.currentTarget.form; const weight = Number(event.currentTarget.value); const height = Number(form ? new FormData(form).get('height_cm') : 0); setDraftBmi(height > 0 && weight > 0 ? Math.round((weight / ((height / 100) ** 2)) * 10) / 10 : null) }} /></label></div>
                <div className="rounded-xl bg-primary-soft px-4 py-3 text-sm"><span className="font-semibold">BMI</span><span className="ml-2 text-primary-strong">{draftBmi === null ? 'Enter height and weight to calculate' : draftBmi.toFixed(1)}</span><p className="mt-1 text-xs text-muted">Calculated from metric measurements; this is a recorded value, not a diagnosis.</p></div>
                <div className="grid grid-cols-2 gap-3"><label className="block text-sm font-semibold">Vision · left<input className={input} name="vision_left" defaultValue={selectedResult.vision_left ?? ''} maxLength={100} placeholder="e.g. 20/20" /></label><label className="block text-sm font-semibold">Vision · right<input className={input} name="vision_right" defaultValue={selectedResult.vision_right ?? ''} maxLength={100} placeholder="e.g. 20/20" /></label></div>
                <label className="block text-sm font-semibold">Notes<textarea className={input} name="notes" defaultValue={selectedResult.notes ?? ''} maxLength={2000} rows={3} /></label>
                <div className="flex flex-wrap gap-2"><button className={button} type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save examination'}</button>{(selectedResult.status !== 'pending' || selectedResult.height_cm !== null || selectedResult.weight_kg !== null || selectedResult.notes || selectedResult.vision_left || selectedResult.vision_right) && <button className={secondary} type="button" disabled={saving} onClick={deleteResult}>Remove record</button>}</div>
              </form>
            </> : <p className="mt-3 text-sm leading-6 text-muted">Choose a student from this session roster to review health notes and enter or update height, weight, vision, and follow-up status.</p>}
          </>}
        </section>
      </div>}
      <footer className="mt-8 border-t border-border pt-4 text-xs text-muted">Student demographic fields shown here reflect the data currently available to the system.</footer>
    </div>
  </main>
}
