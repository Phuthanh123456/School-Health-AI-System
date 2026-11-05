import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { getAccessToken } from './auth'
import { Button, Card, EmptyState, Input, PageHeader, Skeleton } from './components/ui'

type Student = { id: string; full_name: string; class_name: string }
type Profile = Student & { allergies: string | null; medical_notes: string | null }

const api = (import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000').replace(/\/$/, '')
const inputStyle = 'mt-1'

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const headers = new Headers(options?.headers)
  const token = getAccessToken()
  if (token) headers.set('Authorization', `Bearer ${token}`)
  const response = await fetch(`${api}/students${path}`, { ...options, headers })
  if (response.status === 401 || response.status === 403) throw new Error('Sign in with a Nurse or Admin account to access student profiles.')
  if (response.status === 409) throw new Error('This student ID already exists.')
  if (response.status === 422) throw new Error('Check required fields and text lengths.')
  if (response.status === 404) throw new Error('Student profile not found.')
  if (!response.ok) throw new Error('Could not complete the request. Please try again.')
  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

function message(error: unknown) {
  if (error instanceof TypeError) return 'Could not connect to the SchoolHealth API.'
  return error instanceof Error ? error.message : 'Something went wrong.'
}

function ProfileForm({ profile, onSaved, onSaving, busy }: {
  profile: Profile | null
  onSaved: (saved: Profile) => void
  onSaving: (saving: boolean) => void
  busy: boolean
}) {
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const fields = new FormData(event.currentTarget)
    const id = String(fields.get('id')).trim()
    const values = {
      full_name: String(fields.get('full_name')).trim(),
      class_name: String(fields.get('class_name')).trim(),
      allergies: String(fields.get('allergies')).trim() || null,
      medical_notes: String(fields.get('medical_notes')).trim() || null,
    }
    if (!id || !values.full_name || !values.class_name) {
      setError('Enter the student ID, full name, and class.')
      return
    }
    setError('')
    setSaving(true)
    onSaving(true)
    try {
      const body = profile
        ? Object.fromEntries(Object.entries(values).filter(([field, value]) => value !== profile[field as keyof Profile]))
        : { id, ...values }
      const saved = await request<Profile>(profile ? `/${encodeURIComponent(profile.id)}` : '', {
        method: profile ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      onSaved(saved)
    } catch (error) {
      setError(message(error))
    } finally {
      setSaving(false)
      onSaving(false)
    }
  }

  return (
    <form onSubmit={save} className="student-profile-form mt-5">
      <fieldset disabled={saving || busy} className="grid gap-4">
        <label className="text-sm font-semibold">Student ID
          <Input className={inputStyle} name="id" defaultValue={profile?.id} readOnly={Boolean(profile)} required maxLength={50}
            pattern="[A-Za-z0-9]+" title="Use only ASCII letters and numbers, without spaces." />
          {!profile && <span className="mt-1 block text-xs font-normal text-muted">Use only ASCII letters and numbers, without spaces.</span>}
        </label>
        <label className="text-sm font-semibold">Full name
          <Input className={inputStyle} name="full_name" defaultValue={profile?.full_name} required maxLength={200} />
        </label>
        <label className="text-sm font-semibold">Class
          <Input className={inputStyle} name="class_name" defaultValue={profile?.class_name} required maxLength={50} />
        </label>
        <label className="text-sm font-semibold">Allergies
          <textarea className={inputStyle} name="allergies" defaultValue={profile?.allergies ?? ''} rows={2} maxLength={2000} />
        </label>
        <label className="text-sm font-semibold">Medical notes
          <textarea className={inputStyle} name="medical_notes" defaultValue={profile?.medical_notes ?? ''} rows={3} maxLength={2000} />
        </label>
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        <Button className="justify-self-start" type="submit" loading={saving} loadingLabel="Saving…">
          {saving ? 'Saving…' : 'Save profile'}
        </Button>
      </fieldset>
    </form>
  )
}

export default function NurseStudents() {
  const [students, setStudents] = useState<Student[] | null>(null)
  const [selection, setSelection] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [listError, setListError] = useState('')
  const [detailError, setDetailError] = useState('')
  const [notice, setNotice] = useState('')
  const [saving, setSaving] = useState(false)

  const [search, setSearch] = useState('')

  const visibleStudents = students?.filter((student) =>
    student.id.toLowerCase().includes(search.trim().toLowerCase()))

  async function removeStudent() {
    if (!profile || !window.confirm(`Delete student ${profile.id}? The health profile, parent links, and checkup results will also be deleted.`)) return
    setSaving(true)
    setDetailError('')
    try {
      await request<void>(`/${encodeURIComponent(profile.id)}`, { method: 'DELETE' })
      setStudents((current) => current?.filter((student) => student.id !== profile.id) ?? [])
      setProfile(null)
      setSelection(null)
      setAdding(false)
      setNotice('Student deleted.')
    } catch (error) {
      setDetailError(message(error))
    } finally {
      setSaving(false)
    }
  }

  useEffect(() => {
    const controller = new AbortController()
    request<Student[]>('', { signal: controller.signal })
      .then(setStudents)
      .catch((error: unknown) => { if (!controller.signal.aborted) setListError(message(error)) })
    return () => controller.abort()
  }, [])

  useEffect(() => {
    if (selection === null) return
    const controller = new AbortController()
    request<Profile>(`/${encodeURIComponent(selection)}`, { signal: controller.signal })
      .then(setProfile)
      .catch((error: unknown) => { if (!controller.signal.aborted) setDetailError(message(error)) })
    return () => controller.abort()
  }, [selection])

  function open(id: string | null) {
    if (id !== null && id === selection) return
    setProfile(null)
    setDetailError('')
    setNotice('')
    setSelection(id)
    setAdding(id === null)
  }

  function saved(result: Profile) {
    setStudents((current) => [...(current ?? []).filter((student) => student.id !== result.id), result]
      .sort((left, right) => left.id.localeCompare(right.id)))
    setProfile(result)
    setSelection(result.id)
    setAdding(false)
    setNotice(adding ? 'Student added.' : 'Profile saved.')
  }

  return (
    <div className="mx-auto max-w-6xl py-2">
      <PageHeader className="my-6" eyebrow="Nurse · Demo data" title="Student health profiles"
        actions={<Button disabled={saving || students === null} onClick={() => open(null)}>Add student</Button>} />
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(18rem,0.9fr)_minmax(0,1.1fr)]">
        <Card as="section" aria-labelledby="student-list-title" className="min-w-0 p-4 sm:p-5">
          <h2 id="student-list-title" className="text-lg font-bold">Student list {students && `(${students.length})`}</h2>
          <label className="mt-3 block text-sm font-semibold">Search by student ID
            <Input type="search" className={inputStyle} value={search} maxLength={50}
              onChange={(event) => setSearch(event.target.value)} placeholder="Enter a student ID" />
          </label>
          {listError && <p role="alert" className="mt-3 text-sm text-red-700">{listError}</p>}
          {!students && !listError && <div role="status" aria-label="Loading student list" className="mt-4 space-y-3">{[1, 2, 3].map(item => <Skeleton key={item} className="h-14" />)}</div>}
          {students?.length === 0 && <EmptyState className="mt-4" title="No students yet" description="Student profiles will appear here when records are added." />}
          <ul className="mt-3 max-h-[32rem] divide-y divide-border overflow-auto">
            {visibleStudents?.map((student) => (
              <li key={student.id}>
                <button type="button" disabled={saving} aria-pressed={selection === student.id} onClick={() => open(student.id)}
                  className="flex min-h-14 w-full items-center justify-between gap-3 rounded-control px-3 py-2 text-left hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary aria-pressed:bg-primary-soft">
                  <span className="min-w-0 break-words text-sm font-semibold">{student.full_name}<span className="block text-xs font-normal text-muted">{student.id}</span></span>
                  <span className="shrink-0 text-sm text-muted">{student.class_name}</span>
                </button>
              </li>
            ))}
          </ul>
          {students && students.length > 0 && visibleStudents?.length === 0 &&
            <EmptyState className="mt-4" title="No students found" description="Try searching with a different student ID." />}
        </Card>
        <Card as="section" aria-labelledby="student-profile-title" className="p-4 sm:p-5">
          <h2 id="student-profile-title" className="text-lg font-bold">{adding ? 'Add a student' : 'Student profile'}</h2>
          {notice && <p role="status" className="mt-3 text-sm font-semibold text-green-800">{notice}</p>}
          {detailError && <p role="alert" className="mt-3 text-sm text-red-700">{detailError}</p>}
          {adding || profile
            ? <ProfileForm key={adding ? 'new' : JSON.stringify(profile)} profile={profile} onSaved={saved} onSaving={setSaving} busy={saving} />
            : !detailError && (selection
              ? <div role="status" aria-label="Loading student profile" className="mt-4 space-y-3"><Skeleton shape="text" className="w-1/3" /><Skeleton className="h-24" /></div>
              : <EmptyState className="mt-4" title="Select a student profile" description="Select a student from the list to view their profile." />)}
          {profile && <Button type="button" variant="danger" disabled={saving} onClick={removeStudent} className="mt-4">Delete student</Button>}
        </Card>
      </div>
    </div>
  )
}
