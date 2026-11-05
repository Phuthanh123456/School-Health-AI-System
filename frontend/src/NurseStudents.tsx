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
  if (response.status === 409) throw new Error('Mã học sinh đã tồn tại.')
  if (response.status === 422) throw new Error('Kiểm tra các trường bắt buộc và độ dài thông tin.')
  if (response.status === 404) throw new Error('Không tìm thấy hồ sơ học sinh.')
  if (!response.ok) throw new Error('Không thể hoàn tất yêu cầu. Vui lòng thử lại.')
  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

function message(error: unknown) {
  if (error instanceof TypeError) return 'Không kết nối được với API SchoolHealth.'
  return error instanceof Error ? error.message : 'Đã xảy ra lỗi.'
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
      setError('Nhập mã học sinh, họ tên và lớp.')
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
    <form onSubmit={save} className="mt-5">
      <fieldset disabled={saving || busy} className="grid gap-4">
        <label className="text-sm font-semibold">Mã học sinh
          <Input className={inputStyle} name="id" defaultValue={profile?.id} readOnly={Boolean(profile)} required maxLength={50}
            pattern="[A-Za-z0-9]+" title="Viết liền, chỉ dùng chữ không dấu và số." />
          {!profile && <span className="mt-1 block text-xs font-normal text-muted">Viết liền, chỉ dùng chữ không dấu và số.</span>}
        </label>
        <label className="text-sm font-semibold">Họ tên
          <Input className={inputStyle} name="full_name" defaultValue={profile?.full_name} required maxLength={200} />
        </label>
        <label className="text-sm font-semibold">Lớp
          <Input className={inputStyle} name="class_name" defaultValue={profile?.class_name} required maxLength={50} />
        </label>
        <label className="text-sm font-semibold">Dị ứng
          <textarea className={inputStyle} name="allergies" defaultValue={profile?.allergies ?? ''} rows={2} maxLength={2000} />
        </label>
        <label className="text-sm font-semibold">Ghi chú y tế
          <textarea className={inputStyle} name="medical_notes" defaultValue={profile?.medical_notes ?? ''} rows={3} maxLength={2000} />
        </label>
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        <Button className="justify-self-start" type="submit" loading={saving} loadingLabel="Đang lưu…">
          {saving ? 'Đang lưu…' : 'Lưu hồ sơ'}
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
    if (!profile || !window.confirm(`Xóa học sinh ${profile.id}? Hồ sơ sức khỏe, liên kết phụ huynh và kết quả khám của học sinh cũng sẽ bị xóa.`)) return
    setSaving(true)
    setDetailError('')
    try {
      await request<void>(`/${encodeURIComponent(profile.id)}`, { method: 'DELETE' })
      setStudents((current) => current?.filter((student) => student.id !== profile.id) ?? [])
      setProfile(null)
      setSelection(null)
      setAdding(false)
      setNotice('Đã xóa học sinh.')
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
    setNotice(adding ? 'Đã thêm học sinh.' : 'Đã lưu hồ sơ.')
  }

  return (
    <div className="mx-auto max-w-6xl py-2">
      <PageHeader className="my-6" eyebrow="Điều dưỡng · Dữ liệu demo" title="Hồ sơ sức khỏe học sinh"
        actions={<Button disabled={saving || students === null} onClick={() => open(null)}>Thêm học sinh</Button>} />
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(18rem,0.9fr)_minmax(0,1.1fr)]">
        <Card as="section" aria-labelledby="student-list-title" className="min-w-0 p-4 sm:p-5">
          <h2 id="student-list-title" className="text-lg font-bold">Danh sách học sinh {students && `(${students.length})`}</h2>
          <label className="mt-3 block text-sm font-semibold">Tìm theo mã học sinh
            <Input type="search" className={inputStyle} value={search} maxLength={50}
              onChange={(event) => setSearch(event.target.value)} placeholder="Nhập mã học sinh" />
          </label>
          {listError && <p role="alert" className="mt-3 text-sm text-red-700">{listError}</p>}
          {!students && !listError && <div role="status" aria-label="Đang tải danh sách học sinh" className="mt-4 space-y-3">{[1, 2, 3].map(item => <Skeleton key={item} className="h-14" />)}</div>}
          {students?.length === 0 && <EmptyState className="mt-4" title="Chưa có học sinh" description="Hồ sơ học sinh sẽ xuất hiện tại đây khi dữ liệu được thêm." />}
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
            <EmptyState className="mt-4" title="Không tìm thấy học sinh" description="Thử tìm bằng mã học sinh khác." />}
        </Card>
        <Card as="section" aria-labelledby="student-profile-title" className="p-4 sm:p-5">
          <h2 id="student-profile-title" className="text-lg font-bold">{adding ? 'Thêm học sinh mới' : 'Hồ sơ học sinh'}</h2>
          {notice && <p role="status" className="mt-3 text-sm font-semibold text-green-800">{notice}</p>}
          {detailError && <p role="alert" className="mt-3 text-sm text-red-700">{detailError}</p>}
          {adding || profile
            ? <ProfileForm key={adding ? 'new' : JSON.stringify(profile)} profile={profile} onSaved={saved} onSaving={setSaving} busy={saving} />
            : !detailError && (selection
              ? <div role="status" aria-label="Đang tải hồ sơ học sinh" className="mt-4 space-y-3"><Skeleton shape="text" className="w-1/3" /><Skeleton className="h-24" /></div>
              : <EmptyState className="mt-4" title="Chọn hồ sơ học sinh" description="Chọn một học sinh trong danh sách để xem thông tin và kết quả hồ sơ." />)}
          {profile && <Button type="button" variant="danger" disabled={saving} onClick={removeStudent} className="mt-4">Xóa học sinh</Button>}
        </Card>
      </div>
    </div>
  )
}
