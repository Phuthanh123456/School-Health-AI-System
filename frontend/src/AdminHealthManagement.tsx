import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { dateText, managementRequest, type HealthRecord, type ManagementOptions, type RecordPage } from './managementApi'
import { useManagementResource } from './useManagementResource'
import { button, LoadError, RoleWorkspace, secondaryButton, selectStyle, StatusBadge } from './RoleWorkspace'

type Filters = { classId: string; parentId: string; nurseId: string }
type DialogTarget = { record: HealthRecord; kind: 'parent' | 'nurse'; remove: boolean }
const emptyFilters: Filters = { classId: '', parentId: '', nurseId: '' }

function AssignmentDialog({ target, options, close, saved, reload }: {
  target: DialogTarget; options: ManagementOptions; close: () => void; saved: () => void; reload: () => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const pending = useRef(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [requiresReload, setRequiresReload] = useState(false)
  const { record, kind, remove } = target
  const currentIds = kind === 'parent' ? record.parents.map(parent => parent.id) : record.nurse ? [record.nurse.id] : []
  const [accountId, setAccountId] = useState(currentIds[0] || '')
  const accounts = kind === 'parent' ? options.parents : options.nurses
  useEffect(() => {
    const element = dialog.current
    element?.showModal()
    return () => { element?.close() }
  }, [])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending.current || requiresReload) return
    pending.current = true; setBusy(true); setError('')
    try {
      await managementRequest<HealthRecord>(`/api/admin/students/${encodeURIComponent(record.id)}/${kind}`, {
        method: remove ? 'DELETE' : 'PUT',
        headers: { 'Content-Type': 'application/json', 'If-Match': record.assignment_version },
        body: remove ? undefined : JSON.stringify({ account_id: accountId }),
      })
      saved()
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'The change could not be confirmed. Refresh the record.')
      setRequiresReload(true)
    } finally {
      pending.current = false; setBusy(false)
    }
  }

  return <dialog ref={dialog} aria-labelledby="assignment-title" aria-describedby="assignment-description" onCancel={event => { if (busy) event.preventDefault(); else close() }} className="m-auto max-h-[90dvh] w-[calc(100%_-_2rem)] max-w-lg overflow-y-auto rounded-2xl border border-border bg-white p-6 text-foreground shadow-xl backdrop:bg-slate-950/40">
    <form onSubmit={submit}>
      <h2 id="assignment-title" className="font-display text-2xl font-bold">{remove ? 'Remove' : 'Assign / change'} {kind === 'parent' ? 'Parent' : 'Nurse'}</h2>
      <p id="assignment-description" className="mt-3 text-sm leading-6 text-muted">{record.full_name} · {record.id}. {remove ? `Remove the current ${kind} link${currentIds.length > 1 ? 's' : ''}: ${currentIds.join(', ')}?` : kind === 'parent' ? 'This replaces the current Parent links with the selected existing Parent account.' : 'Choose the existing Nurse account responsible for this student.'}</p>
      <fieldset disabled={busy || requiresReload} className="mt-5">
        {!remove && <label className="text-sm font-semibold">{kind === 'parent' ? 'Parent' : 'Nurse'} account
          <select aria-label={`${kind === 'parent' ? 'Parent' : 'Nurse'} account`} autoFocus required value={accountId} onChange={event => setAccountId(event.target.value)} className={selectStyle}>
            <option value="">Choose an existing account</option>{accounts.map(account => <option key={account.id} value={account.id}>{account.id} · {account.email}</option>)}
          </select>
        </label>}
      </fieldset>
      {error && <p role="alert" className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">{error}</p>}
      <div className="mt-6 flex flex-wrap justify-end gap-3">
        <button type="button" disabled={busy} onClick={close} className={secondaryButton}>Cancel</button>
        {requiresReload ? <button type="button" onClick={reload} className={button}>Reload table</button> : <button type="submit" disabled={busy || (!remove && !accountId)} className={button}>{busy ? 'Saving…' : remove ? 'Confirm removal' : 'Save assignment'}</button>}
      </div>
    </form>
  </dialog>
}

export default function AdminHealthManagement() {
  const [draft, setDraft] = useState<Filters>(emptyFilters)
  const [filters, setFilters] = useState<Filters>(emptyFilters)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [success, setSuccess] = useState('')
  const [target, setTarget] = useState<DialogTarget | null>(null)
  const options = useManagementResource<ManagementOptions>('/api/admin/health-records/options')
  const query = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
  for (const [key, value] of Object.entries(filters)) if (value) query.set(key, value)
  const records = useManagementResource<RecordPage>(`/api/admin/health-records?${query.toString()}`)
  const pageCount = Math.max(1, Math.ceil((records.data?.total ?? 0) / pageSize))
  useEffect(() => {
    if (records.data && page > pageCount) setPage(pageCount)
  }, [records.data, page, pageCount])

  function apply(event: FormEvent) {
    event.preventDefault(); setPage(1); setFilters({ ...draft }); setSuccess(''); records.reload()
  }
  function reset() {
    setDraft(emptyFilters); setFilters(emptyFilters); setPage(1); setSuccess(''); records.reload()
  }
  function refresh() {
    setTarget(null); records.reload()
  }

  return <RoleWorkspace role="Admin" title="Health management" description="Find student health records and manage the Parent and Nurse accounts linked to each student.">
    {options.error && <LoadError message={options.error} retry={options.reload} />}
    <form onSubmit={apply} className="mb-6 rounded-2xl border border-border bg-white p-5 shadow-sm">
      <h2 className="font-display text-xl font-bold">Find health records</h2>
      <fieldset disabled={options.loading || !options.data || records.loading} className="mt-4 grid items-end gap-4 md:grid-cols-3 xl:grid-cols-[1fr_1fr_1fr_auto]">
        <label className="text-sm font-semibold">Class<select aria-label="Class" value={draft.classId} onChange={event => setDraft({ ...draft, classId: event.target.value })} className={selectStyle}><option value="">All classes</option>{options.data?.classes.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <label className="text-sm font-semibold">Parent<select aria-label="Parent" value={draft.parentId} onChange={event => setDraft({ ...draft, parentId: event.target.value })} className={selectStyle}><option value="">All Parents</option>{options.data?.parents.map(item => <option key={item.id} value={item.id}>{item.id} · {item.email}</option>)}</select></label>
        <label className="text-sm font-semibold">Nurse<select aria-label="Nurse" value={draft.nurseId} onChange={event => setDraft({ ...draft, nurseId: event.target.value })} className={selectStyle}><option value="">All Nurses</option>{options.data?.nurses.map(item => <option key={item.id} value={item.id}>{item.id} · {item.email}</option>)}</select></label>
        <div className="flex gap-2"><button type="submit" className={button}>Search / Apply</button><button type="button" onClick={reset} className={secondaryButton}>Reset</button></div>
      </fieldset>
      {options.loading && <p role="status" className="mt-3 text-sm text-muted">Loading available filters…</p>}
    </form>
    {success && <p role="status" className="mb-4 rounded-xl border border-sky-200 bg-white p-4 text-sm font-semibold">{success}</p>}
    {records.error && <LoadError message={records.error} retry={records.reload} />}
    <section aria-labelledby="records-title" className="overflow-hidden rounded-2xl border border-border bg-white shadow-sm" aria-busy={records.loading}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-5"><h2 id="records-title" className="font-display text-xl font-bold">Student health records</h2><button type="button" disabled={records.loading} onClick={records.reload} className={secondaryButton}>Refresh</button></div>
      {records.loading ? <p role="status" className="p-8 text-muted">Loading health records…</p> : records.data && <>
        {records.data.items.length === 0 ? <div className="p-10 text-center"><h3 className="font-bold">No matching records</h3><p className="mt-2 text-sm text-muted">Try different filters or reset to show all students.</p></div> : <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Scrollable student health records table">
          <table className="w-full min-w-[960px] text-left text-sm"><caption className="sr-only">Student health records with linked Parent and Nurse accounts</caption><thead className="bg-background"><tr>{['Student', 'Latest saved checkup', 'Parent links', 'Assigned Nurse', 'Actions'].map(label => <th key={label} scope="col" className="px-5 py-4 font-semibold">{label}</th>)}</tr></thead>
            <tbody>{records.data.items.map(record => <tr key={record.id} className="border-t border-border align-top">
              <th scope="row" className="px-5 py-5 font-normal"><p className="font-bold">{record.full_name}</p><p className="mt-1 text-muted">{record.id} · {record.class_name}</p><details className="mt-3 max-w-xs"><summary className="cursor-pointer py-2 font-semibold">Health profile</summary><dl className="space-y-2 text-xs leading-5"><div><dt className="font-bold">Allergies</dt><dd className="whitespace-pre-wrap break-words">{record.allergies || 'Not recorded'}</dd></div><div><dt className="font-bold">Medical notes</dt><dd className="whitespace-pre-wrap break-words">{record.medical_notes || 'Not recorded'}</dd></div></dl></details></th>
              <td className="px-5 py-5">{record.latest_checkup ? <><StatusBadge status={record.latest_checkup.status} /><p className="mt-3">{record.latest_checkup.height_cm} cm · {record.latest_checkup.weight_kg} kg</p><p className="mt-1">BMI {record.latest_checkup.bmi?.toFixed(2) ?? 'Not recorded'}</p><p className="mt-2 text-xs text-muted">{dateText(record.latest_checkup.checkup_date)}</p><p className="mt-1 text-xs text-muted">Updated {dateText(record.latest_checkup.updated_at)}</p></> : <span className="text-muted">No saved result</span>}</td>
              <td className="max-w-xs px-5 py-5">{record.parents.length ? record.parents.map(parent => <div key={parent.id} className="mb-3"><p className="font-semibold">{parent.id}</p><p className="mt-1 break-all text-xs text-muted">{parent.email}</p></div>) : <span className="text-muted">No Parent linked</span>}</td>
              <td className="px-5 py-5">{record.nurse ? <><p className="font-semibold">{record.nurse.id}</p><p className="mt-1 text-xs text-muted">{record.nurse.full_name || 'Name not recorded'}</p><p className="mt-1 break-all text-xs text-muted">{record.nurse.email}</p></> : <span className="text-muted">No Nurse assigned</span>}</td>
              <td className="px-5 py-5"><div className="flex max-w-xs flex-wrap gap-2">
                <button type="button" disabled={!options.data} className={secondaryButton} aria-label={`Assign Parent for ${record.id}`} onClick={() => { setSuccess(''); setTarget({ record, kind: 'parent', remove: false }) }}>Add / Edit Parent</button>
                <button type="button" disabled={!options.data || !record.parents.length} className={secondaryButton} aria-label={`Remove Parent from ${record.id}`} onClick={() => { setSuccess(''); setTarget({ record, kind: 'parent', remove: true }) }}>Remove Parent</button>
                <button type="button" disabled={!options.data} className={secondaryButton} aria-label={`Assign Nurse for ${record.id}`} onClick={() => { setSuccess(''); setTarget({ record, kind: 'nurse', remove: false }) }}>Add / Edit Nurse</button>
                <button type="button" disabled={!options.data || !record.nurse} className={secondaryButton} aria-label={`Remove Nurse from ${record.id}`} onClick={() => { setSuccess(''); setTarget({ record, kind: 'nurse', remove: true }) }}>Remove Nurse</button>
              </div></td>
            </tr>)}</tbody>
          </table>
        </div>}
        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border p-5 text-sm"><p>{records.data.total} records · Page {page} of {pageCount}</p><div className="flex flex-wrap items-center gap-3"><label>Rows per page<select aria-label="Rows per page" value={pageSize} onChange={event => { setPageSize(Number(event.target.value)); setPage(1) }} className="ml-2 min-h-11 rounded-lg border border-border px-2">{[10, 20, 50].map(size => <option key={size} value={size}>{size}</option>)}</select></label><button type="button" className={secondaryButton} disabled={page <= 1} onClick={() => setPage(value => value - 1)}>Previous</button><button type="button" className={secondaryButton} disabled={page >= pageCount} onClick={() => setPage(value => value + 1)}>Next</button></div></div>
      </>}
    </section>
    {target && options.data && <AssignmentDialog target={target} options={options.data} close={() => setTarget(null)} reload={refresh} saved={() => { setSuccess(`${target.kind === 'parent' ? 'Parent' : 'Nurse'} ${target.remove ? 'link removed' : 'assignment saved'} for ${target.record.id}.`); setTarget(null); setPage(1); records.reload() }} />}
  </RoleWorkspace>
}
