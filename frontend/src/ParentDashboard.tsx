import type { Checkup, ParentOverview } from './managementApi'
import { dateText } from './managementApi'
import { useManagementResource } from './useManagementResource'
import { button, LoadError, RoleWorkspace, StatusBadge } from './RoleWorkspace'

function Measurements({ checkup }: { checkup: Checkup }) {
  return <dl className="mt-4 grid grid-cols-3 gap-3 rounded-xl bg-background p-4 text-sm">
    <div><dt className="text-muted">Height</dt><dd className="mt-1 font-bold">{checkup.height_cm === null ? 'Not recorded' : `${checkup.height_cm} cm`}</dd></div>
    <div><dt className="text-muted">Weight</dt><dd className="mt-1 font-bold">{checkup.weight_kg === null ? 'Not recorded' : `${checkup.weight_kg} kg`}</dd></div>
    <div><dt className="text-muted">BMI</dt><dd className="mt-1 font-bold">{checkup.bmi === null ? 'Not recorded' : checkup.bmi.toFixed(2)}</dd></div>
  </dl>
}

export default function ParentDashboard() {
  const resource = useManagementResource<ParentOverview>('/api/parent/dashboard')
  const { data, loading, error, reload } = resource
  return <RoleWorkspace role="Parent" title="Your family's health" description="View your parent profile and the latest recorded health information for each linked child.">
    {error && <LoadError message={error} retry={reload} />}
    {loading && <p role="status" className="rounded-2xl border border-border bg-white p-8">Loading your family's health information…</p>}
    {data && <>
      <section aria-labelledby="parent-profile" className="rounded-2xl border border-border bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4"><h2 id="parent-profile" className="font-display text-xl font-bold">Parent profile</h2><button type="button" onClick={reload} className={button}>Refresh</button></div>
        <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div><dt className="text-muted">Parent ID</dt><dd className="mt-1 font-bold">{data.parent.id}</dd></div>
          <div><dt className="text-muted">Name</dt><dd className="mt-1">{data.parent.full_name || 'Not recorded'}</dd></div>
          <div><dt className="text-muted">Contact</dt><dd className="mt-1 break-all">{data.parent.email}{data.parent.phone && <p>{data.parent.phone}</p>}</dd></div>
          <div><dt className="text-muted">Relationship / guardian status</dt><dd className="mt-1">{data.parent.relationship || 'Not recorded'}</dd></div>
        </dl>
      </section>
      <div className="my-6 flex items-center justify-between"><h2 className="font-display text-2xl font-bold">Linked children</h2><span className="rounded-full bg-primary-soft px-3 py-2 text-sm font-semibold">{data.children.length} {data.children.length === 1 ? 'child' : 'children'}</span></div>
      {data.children.length === 0 ? <section className="rounded-2xl border border-dashed border-border bg-white p-8 text-center"><h3 className="font-bold">No children linked yet</h3><p className="mt-2 text-sm text-muted">Your parent profile is available. Contact the school administrator to check your child links.</p></section> : <section aria-label="Children's health information" className="grid items-start gap-6 lg:grid-cols-2">
        {data.children.map(child => <article key={child.id} className="rounded-2xl border border-border bg-white p-6 shadow-sm">
          <header className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-display text-2xl font-bold">{child.full_name}</h3><p className="mt-1 text-sm text-muted">{child.id} · Class {child.class_name}</p>{child.date_of_birth && <p className="mt-1 text-sm text-muted">Born {dateText(child.date_of_birth)}</p>}{child.relationship && <p className="text-sm text-muted">{child.relationship}</p>}</div><StatusBadge status={child.latest_checkup?.status || 'No saved result'} /></header>
          <dl className="mt-5 space-y-4 text-sm leading-6"><div><dt className="font-bold">Allergies</dt><dd className="whitespace-pre-wrap break-words text-muted">{child.allergies || 'Not recorded'}</dd></div><div><dt className="font-bold">Medical notes</dt><dd className="whitespace-pre-wrap break-words text-muted">{child.medical_notes || 'Not recorded'}</dd></div></dl>
          <section className="mt-5 border-t border-border pt-5" aria-label={`Latest checkup for ${child.full_name}`}><h4 className="font-bold">Latest saved checkup</h4>
            {child.latest_checkup ? <><p className="mt-2 text-sm text-muted">{child.latest_checkup.title} · {dateText(child.latest_checkup.checkup_date)}</p><Measurements checkup={child.latest_checkup} /><p className="mt-3 text-sm"><strong>Vision: </strong>{child.latest_checkup.vision || 'Not recorded'}</p><p className="mt-2 whitespace-pre-wrap break-words text-sm"><strong>Checkup notes: </strong>{child.latest_checkup.notes || 'Not recorded'}</p></> : <p className="mt-2 text-sm text-muted">No completed checkup result has been saved.</p>}
          </section>
          <details className="mt-5 border-t border-border pt-4"><summary className="min-h-11 cursor-pointer py-2 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-primary">Checkup history ({child.checkups.length})</summary>
            {child.checkups.length === 0 ? <p className="py-3 text-sm text-muted">No checkup participation recorded.</p> : <ol className="mt-3 space-y-4">{child.checkups.map(checkup => <li key={checkup.session_id} className="rounded-xl border border-border p-4"><div className="flex flex-wrap justify-between gap-2"><p className="text-sm font-semibold">{checkup.title}</p><StatusBadge status={checkup.status} /></div><p className="mt-2 text-xs text-muted">{dateText(checkup.checkup_date)} · {checkup.session_id}</p><Measurements checkup={checkup} />{checkup.vision && <p className="mt-3 text-sm">Vision: {checkup.vision}</p>}{checkup.notes && <p className="mt-2 whitespace-pre-wrap break-words text-sm">{checkup.notes}</p>}</li>)}</ol>}
          </details>
        </article>)}
      </section>}
    </>}
  </RoleWorkspace>
}
