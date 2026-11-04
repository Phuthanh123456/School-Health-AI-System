import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'

type Student = { id: string; full_name: string; class_name: string }
type Profile = Student & { allergies: string | null; medical_notes: string | null }

const api = (import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000').replace(/\/$/, '')
const inputStyle = 'mt-1 w-full rounded-lg border border-border bg-white px-3 py-2 focus-visible:outline-2 focus-visible:outline-primary'
const buttonStyle = 'rounded-lg bg-primary-strong px-4 py-2 text-sm font-semibold text-white disabled:opacity-50'

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${api}/students${path}`, options)
  if (response.status === 409) throw new Error('Mã học sinh đã tồn tại.')
  if (response.status === 422) throw new Error('Kiểm tra các trường bắt buộc và độ dài thông tin.')
  if (response.status === 404) throw new Error('Không tìm thấy hồ sơ học sinh.')
  if (!response.ok) throw new Error('Không thể hoàn tất yêu cầu. Vui lòng thử lại.')
  return response.json() as Promise<T>
}

function message(error: unknown) {
  if (error instanceof TypeError) return 'Không kết nối được với API SchoolHealth.'
  return error instanceof Error ? error.message : 'Đã xảy ra lỗi.'
}

function ProfileForm({ profile, onSaved, onSaving }: {
  profile: Profile | null
  onSaved: (saved: Profile) => void
  onSaving: (saving: boolean) => void
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
      <fieldset disabled={saving} className="grid gap-4">
        <label className="text-sm font-semibold">Mã học sinh
          <input className={inputStyle} name="id" defaultValue={profile?.id} readOnly={Boolean(profile)} required maxLength={50}
            pattern="[A-Za-z0-9_\-]+" title="Chỉ dùng chữ không dấu, số, dấu gạch ngang và gạch dưới." />
          {!profile && <span className="mt-1 block text-xs font-normal text-muted">Dùng chữ không dấu, số, dấu gạch ngang hoặc gạch dưới.</span>}
        </label>
        <label className="text-sm font-semibold">Họ tên
          <input className={inputStyle} name="full_name" defaultValue={profile?.full_name} required maxLength={200} />
        </label>
        <label className="text-sm font-semibold">Lớp
          <input className={inputStyle} name="class_name" defaultValue={profile?.class_name} required maxLength={50} />
        </label>
        <label className="text-sm font-semibold">Dị ứng
          <textarea className={inputStyle} name="allergies" defaultValue={profile?.allergies ?? ''} rows={2} maxLength={2000} />
        </label>
        <label className="text-sm font-semibold">Ghi chú y tế
          <textarea className={inputStyle} name="medical_notes" defaultValue={profile?.medical_notes ?? ''} rows={3} maxLength={2000} />
        </label>
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        <button className={`${buttonStyle} justify-self-start`} type="submit">
          {saving ? 'Đang lưu…' : 'Lưu hồ sơ'}
        </button>
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
    <main className="mx-auto min-h-screen max-w-6xl px-4 py-8 sm:px-8">
      <a href="/" className="text-sm font-semibold text-primary-strong underline">Trang chủ SchoolHealth</a>
      <header className="my-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-muted">Điều dưỡng · Dữ liệu demo</p>
          <h1 className="mt-1 font-display text-3xl font-bold">Hồ sơ sức khỏe học sinh</h1>
        </div>
        <button className={buttonStyle} type="button" disabled={saving || students === null} onClick={() => open(null)}>
          Thêm học sinh
        </button>
      </header>
      <div className="grid items-start gap-5 md:grid-cols-2">
        <section className="min-w-0 rounded-2xl border border-border bg-white p-4 sm:p-5">
          <h2 className="text-lg font-bold">Danh sách học sinh {students && `(${students.length})`}</h2>
          {listError && <p role="alert" className="mt-3 text-sm text-red-700">{listError}</p>}
          {!students && !listError && <p role="status" className="mt-3 text-sm text-muted">Đang tải danh sách…</p>}
          {students?.length === 0 && <p className="mt-3 text-sm text-muted">Chưa có học sinh.</p>}
          <ul className="mt-3 max-h-[32rem] divide-y divide-border overflow-auto">
            {students?.map((student) => (
              <li key={student.id}>
                <button type="button" disabled={saving} aria-pressed={selection === student.id} onClick={() => open(student.id)}
                  className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left hover:bg-background aria-pressed:bg-primary-soft">
                  <span className="min-w-0 break-words text-sm font-semibold">{student.full_name}<span className="block text-xs font-normal text-muted">{student.id}</span></span>
                  <span className="shrink-0 text-sm text-muted">{student.class_name}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
        <section className="rounded-2xl border border-border bg-white p-4 sm:p-5">
          <h2 className="text-lg font-bold">{adding ? 'Thêm học sinh mới' : 'Hồ sơ học sinh'}</h2>
          {notice && <p role="status" className="mt-3 text-sm font-semibold text-green-800">{notice}</p>}
          {detailError && <p role="alert" className="mt-3 text-sm text-red-700">{detailError}</p>}
          {adding || profile
            ? <ProfileForm key={adding ? 'new' : JSON.stringify(profile)} profile={profile} onSaved={saved} onSaving={setSaving} />
            : !detailError && <p className="mt-3 text-sm text-muted">{selection ? 'Đang tải hồ sơ…' : 'Chọn một học sinh để xem hồ sơ.'}</p>}
        </section>
      </div>
    </main>
  )
}
