import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { dateText, managementRequest, type HealthRecord, type ManagementOptions, type RecordPage } from './managementApi'
import { useManagementResource } from './useManagementResource'
import { LoadError, RoleWorkspace, StatusBadge } from './RoleWorkspace'
import { Button, Card, Dialog, EmptyState, Select, Skeleton } from './components/ui'

type Filters = { classId: string; parentId: string; nurseId: string }
type DialogTarget = { record: HealthRecord; kind: 'parent' | 'nurse'; remove: boolean }
const emptyFilters: Filters = { classId: '', parentId: '', nurseId: '' }

function AssignmentDialog({ target, options, close, saved, reload }: {
  target: DialogTarget; options: ManagementOptions; close: () => void; saved: () => void; reload: () => void
}) {
  const pending = useRef(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [requiresReload, setRequiresReload] = useState(false)
  const { record, kind, remove } = target
  const currentIds = kind === 'parent' ? record.parents.map(parent => parent.id) : record.nurse ? [record.nurse.id] : []
  const [accountId, setAccountId] = useState(currentIds[0] || '')
  const accounts = kind === 'parent' ? options.parents : options.nurses
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

  const title = `${remove ? 'Remove' : 'Assign / change'} ${kind === 'parent' ? 'Parent' : 'Nurse'}`
  const description = `${record.full_name} · ${record.id}. ${remove ? `Remove the current ${kind} link${currentIds.length > 1 ? 's' : ''}: ${currentIds.join(', ')}?` : kind === 'parent' ? 'This replaces the current Parent links with the selected existing Parent account.' : 'Choose the existing Nurse account responsible for this student.'}`

  return <Dialog open onClose={() => { if (!busy) close() }} title={title} description={description} closeLabel="Close assignment dialog" className="max-w-xl">
    <form onSubmit={submit} aria-busy={busy}>
      <fieldset disabled={busy || requiresReload} className="space-y-4">
        {!remove && <label className="block text-sm font-semibold">{kind === 'parent' ? 'Parent' : 'Nurse'} account
          <Select aria-label={`${kind === 'parent' ? 'Parent' : 'Nurse'} account`} autoFocus required value={accountId} onChange={event => setAccountId(event.target.value)} className="mt-2">
            <option value="">Choose an existing account</option>{accounts.map(account => <option key={account.id} value={account.id}>{account.id} · {account.email}</option>)}
          </Select>
        </label>}
        {remove && <p className="rounded-control bg-warning-soft p-4 text-sm leading-6 text-warning">This will unlink the current account from this student. The health record itself will remain.</p>}
      </fieldset>
      {error && <p role="alert" className="mt-4 rounded-control border border-warning bg-warning-soft p-3 text-sm text-warning">{error}</p>}
      <div className="mt-6 flex flex-wrap justify-end gap-3">
        <Button type="button" variant="outline" disabled={busy} onClick={close}>Cancel</Button>
        {requiresReload ? <Button type="button" onClick={reload}>Reload table</Button> : <Button type="submit" variant={remove ? 'danger' : 'primary'} loading={busy} loadingLabel="Saving assignment…" disabled={!remove && !accountId}>{remove ? 'Confirm removal' : 'Save assignment'}</Button>}
      </div>
    </form>
  </Dialog>
}

function AssignmentActions({ record, disabled, onSelect }: {
  record: HealthRecord
  disabled: boolean
  onSelect: (target: DialogTarget) => void
}) {
  return <div className="flex flex-wrap gap-2">
    <Button variant="outline" size="sm" disabled={disabled} aria-label={`Assign Parent for ${record.id}`} onClick={() => onSelect({ record, kind: 'parent', remove: false })}>Assign Parent</Button>
    <Button variant="outline" size="sm" disabled={disabled || !record.parents.length} aria-label={`Remove Parent from ${record.id}`} onClick={() => onSelect({ record, kind: 'parent', remove: true })}>Remove Parent</Button>
    <Button variant="outline" size="sm" disabled={disabled} aria-label={`Assign Nurse for ${record.id}`} onClick={() => onSelect({ record, kind: 'nurse', remove: false })}>Assign Nurse</Button>
    <Button variant="outline" size="sm" disabled={disabled || !record.nurse} aria-label={`Remove Nurse from ${record.id}`} onClick={() => onSelect({ record, kind: 'nurse', remove: true })}>Remove Nurse</Button>
  </div>
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

  return <RoleWorkspace role="Admin" title="Health management" description="Review student health records and manage their existing Parent and Nurse links.">
    {options.error && <LoadError message={options.error} retry={options.reload} />}
    <Card as="form" onSubmit={apply} className="space-y-5 p-5 sm:p-6">
      <div><p className="text-xs font-bold uppercase tracking-[0.14em] text-primary-strong">Record search</p><h2 className="mt-1 font-display text-xl font-bold">Filter health records</h2><p className="mt-1 text-sm text-muted">Choose one or more existing filters. Search applies every selected filter together.</p></div>
      <fieldset disabled={options.loading || !options.data || records.loading} className="grid items-end gap-4 sm:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_auto]">
        <label className="text-sm font-semibold">Class<Select aria-label="Class" value={draft.classId} onChange={event => setDraft({ ...draft, classId: event.target.value })} className="mt-2"><option value="">All classes</option>{options.data?.classes.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</Select></label>
        <label className="text-sm font-semibold">Parent<Select aria-label="Parent" value={draft.parentId} onChange={event => setDraft({ ...draft, parentId: event.target.value })} className="mt-2"><option value="">All Parents</option>{options.data?.parents.map(item => <option key={item.id} value={item.id}>{item.id} · {item.email}</option>)}</Select></label>
        <label className="text-sm font-semibold">Nurse<Select aria-label="Nurse" value={draft.nurseId} onChange={event => setDraft({ ...draft, nurseId: event.target.value })} className="mt-2"><option value="">All Nurses</option>{options.data?.nurses.map(item => <option key={item.id} value={item.id}>{item.id} · {item.email}</option>)}</Select></label>
        <div className="flex flex-wrap gap-2"><Button type="submit" loading={records.loading}>Search / Apply</Button><Button type="button" variant="outline" disabled={records.loading} onClick={reset}>Reset filters</Button></div>
      </fieldset>
      {options.loading && <p role="status" className="text-sm text-muted">Loading available filters…</p>}
    </Card>

    {success && <p role="status" className="my-4 rounded-control border border-success bg-success-soft p-4 text-sm font-semibold text-success">{success}</p>}
    {records.error && <LoadError message={records.error} retry={records.reload} />}
    <Card as="section" aria-labelledby="records-title" aria-busy={records.loading} className="mt-6 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-5 sm:p-6">
        <div><h2 id="records-title" className="font-display text-xl font-bold">Student health records</h2></div>
        <Button variant="outline" disabled={records.loading} onClick={records.reload}>Refresh</Button>
      </div>
      {records.loading ? <div role="status" aria-label="Loading health records" className="grid gap-4 p-5 sm:grid-cols-2 xl:grid-cols-3">{[1, 2, 3, 4, 5, 6].map(item => <Card key={item} aria-hidden="true" className="space-y-3 p-4"><Skeleton shape="text" className="w-2/5" /><Skeleton className="h-16" /><Skeleton shape="text" /></Card>)}</div> : records.data && <>
        {records.data.items.length === 0 ? <EmptyState className="m-5" title="No matching records" description="Try a different combination of class, Parent, or Nurse filters, or reset the filters to see all records." /> : <>
          <ul className="grid gap-4 p-4 sm:grid-cols-2 xl:hidden" aria-label="Student health records">
            {records.data.items.map(record => <li key={record.id}>
              <Card as="article" className="h-full p-4">
                <div className="flex items-start justify-between gap-3"><div className="min-w-0"><h3 className="break-words font-bold">{record.full_name}</h3><p className="mt-1 break-words text-sm text-muted">{record.id} · {record.class_name}</p></div>{record.latest_checkup && <StatusBadge status={record.latest_checkup.status} />}</div>
                <div className="mt-4 grid gap-3 border-t border-border pt-4 text-sm">
                  <div><p className="font-semibold">Latest saved checkup</p>{record.latest_checkup ? <p className="mt-1 text-muted">{record.latest_checkup.height_cm ?? 'Not recorded'} cm · {record.latest_checkup.weight_kg ?? 'Not recorded'} kg · BMI {record.latest_checkup.bmi?.toFixed(2) ?? 'Not recorded'}<br />{dateText(record.latest_checkup.checkup_date)}</p> : <p className="mt-1 text-muted">No saved result</p>}</div>
                  <div><p className="font-semibold">Parent links</p>{record.parents.length ? record.parents.map(parent => <p key={parent.id} className="mt-1 break-words text-muted">{parent.id} · {parent.email}</p>) : <p className="mt-1 text-muted">No Parent linked</p>}</div>
                  <div><p className="font-semibold">Assigned Nurse</p>{record.nurse ? <p className="mt-1 break-words text-muted">{record.nurse.id} · {record.nurse.full_name || record.nurse.email}</p> : <p className="mt-1 text-muted">No Nurse assigned</p>}</div>
                </div>
                <details className="mt-4 border-t border-border pt-3"><summary className="min-h-11 cursor-pointer py-2 font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">Health profile</summary><dl className="space-y-2 text-sm leading-6"><div><dt className="font-semibold">Allergies</dt><dd className="whitespace-pre-wrap break-words text-muted">{record.allergies || 'Not recorded'}</dd></div><div><dt className="font-semibold">Medical notes</dt><dd className="whitespace-pre-wrap break-words text-muted">{record.medical_notes || 'Not recorded'}</dd></div></dl></details>
                <div className="mt-4 border-t border-border pt-4"><p className="mb-3 text-sm font-semibold">Assignments</p><AssignmentActions record={record} disabled={!options.data} onSelect={next => { setSuccess(''); setTarget(next) }} /></div>
              </Card>
            </li>)}
          </ul>

          <div className="hidden overflow-x-auto xl:block" tabIndex={0} role="region" aria-label="Scrollable student health records table">
            <table className="w-full min-w-[1060px] text-left text-sm"><caption className="sr-only">Student health records with linked Parent and Nurse accounts</caption><thead className="bg-background"><tr>{['Student', 'Latest saved checkup', 'Parent links', 'Assigned Nurse', 'Actions'].map(label => <th key={label} scope="col" className="px-5 py-4 font-semibold">{label}</th>)}</tr></thead>
              <tbody>{records.data.items.map(record => <tr key={record.id} className="border-t border-border align-top hover:bg-background/60">
                <th scope="row" className="px-5 py-5 font-normal"><p className="font-bold">{record.full_name}</p><p className="mt-1 text-muted">{record.id} · {record.class_name}</p><details className="mt-3 max-w-xs"><summary className="min-h-11 cursor-pointer py-2 font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">Health profile</summary><dl className="space-y-2 text-xs leading-5"><div><dt className="font-bold">Allergies</dt><dd className="whitespace-pre-wrap break-words">{record.allergies || 'Not recorded'}</dd></div><div><dt className="font-bold">Medical notes</dt><dd className="whitespace-pre-wrap break-words">{record.medical_notes || 'Not recorded'}</dd></div></dl></details></th>
                <td className="px-5 py-5">{record.latest_checkup ? <><StatusBadge status={record.latest_checkup.status} /><p className="mt-3">{record.latest_checkup.height_cm ?? 'Not recorded'} cm · {record.latest_checkup.weight_kg ?? 'Not recorded'} kg</p><p className="mt-1">BMI {record.latest_checkup.bmi?.toFixed(2) ?? 'Not recorded'}</p><p className="mt-2 text-xs text-muted">{dateText(record.latest_checkup.checkup_date)}</p></> : <span className="text-muted">No saved result</span>}</td>
                <td className="max-w-xs px-5 py-5">{record.parents.length ? record.parents.map(parent => <div key={parent.id} className="mb-3"><p className="font-semibold">{parent.id}</p><p className="mt-1 break-all text-xs text-muted">{parent.email}</p></div>) : <span className="text-muted">No Parent linked</span>}</td>
                <td className="px-5 py-5">{record.nurse ? <><p className="font-semibold">{record.nurse.id}</p><p className="mt-1 text-xs text-muted">{record.nurse.full_name || 'Name not recorded'}</p><p className="mt-1 break-all text-xs text-muted">{record.nurse.email}</p></> : <span className="text-muted">No Nurse assigned</span>}</td>
                <td className="px-5 py-5"><AssignmentActions record={record} disabled={!options.data} onSelect={next => { setSuccess(''); setTarget(next) }} /></td>
              </tr>)}</tbody>
            </table>
          </div>
        </>}
        <div className="flex flex-col gap-4 border-t border-border p-4 text-sm sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <p aria-live="polite">{records.data.total} records · Page {page} of {pageCount}</p>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2">Rows per page<Select aria-label="Rows per page" value={pageSize} onChange={event => { setPageSize(Number(event.target.value)); setPage(1) }} className="min-w-20"><option value={10}>10</option><option value={20}>20</option><option value={50}>50</option></Select></label>
            <Button type="button" variant="outline" disabled={page <= 1} onClick={() => setPage(value => value - 1)}>Previous</Button>
            <Button type="button" variant="outline" disabled={page >= pageCount} onClick={() => setPage(value => value + 1)}>Next</Button>
          </div>
        </div>
      </>}
    </Card>
    {target && options.data && <AssignmentDialog target={target} options={options.data} close={() => setTarget(null)} reload={refresh} saved={() => { setSuccess(`${target.kind === 'parent' ? 'Parent' : 'Nurse'} ${target.remove ? 'link removed' : 'assignment saved'} for ${target.record.id}.`); setTarget(null); setPage(1); records.reload() }} />}
  </RoleWorkspace>
}
