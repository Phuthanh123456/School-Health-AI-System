import { lazy, Suspense, useState } from 'react'
import type { Checkup, ParentOverview } from './managementApi'
import { dateText } from './managementApi'
import { useManagementResource } from './useManagementResource'
import { LoadError, RoleWorkspace, StatusBadge } from './RoleWorkspace'
import { Badge, Button, Card, EmptyState, Skeleton } from './components/ui'

const ParentHealthTrends = lazy(() => import('./ParentHealthTrends'))

function Measurements({ checkup }: { checkup: Checkup }) {
  const metrics = [
    { label: 'Height', value: checkup.height_cm === null ? 'Not recorded' : `${checkup.height_cm} cm` },
    { label: 'Weight', value: checkup.weight_kg === null ? 'Not recorded' : `${checkup.weight_kg} kg` },
    { label: 'BMI', value: checkup.bmi === null ? 'Not recorded' : checkup.bmi.toFixed(2) },
  ]

  return <dl className="mt-4 grid gap-3 sm:grid-cols-3" aria-label="Latest recorded measurements">
    {metrics.map(metric => <Card as="div" key={metric.label} className="p-4">
      <dt className="text-sm text-muted">{metric.label}</dt>
      <dd className="mt-2 font-display text-xl font-bold tabular-nums text-text">{metric.value}</dd>
    </Card>)}
  </dl>
}

export default function ParentDashboard() {
  const resource = useManagementResource<ParentOverview>('/api/parent/dashboard')
  const { data, loading, error, reload } = resource
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null)
  const selectedChild = data?.children.find(child => child.id === selectedChildId) ?? data?.children[0]

  return <RoleWorkspace role="Parent" title="Your family's health" description="View your parent profile and the latest recorded health information for each linked child.">
    {error && <LoadError message={error} retry={reload} />}
    {loading && <section aria-label="Loading family health information" aria-busy="true" className="grid gap-4 sm:grid-cols-2">
      {[1, 2].map(item => <Card key={item} aria-hidden="true" className="space-y-4 p-6"><Skeleton shape="text" className="w-1/3" /><Skeleton className="h-24" /></Card>)}
      <p role="status" className="sr-only">Loading your family's health information…</p>
    </section>}
    {data && <>
      <Card as="section" aria-labelledby="parent-profile" className="p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div><p className="text-xs font-bold uppercase tracking-[0.14em] text-primary-strong">Family account</p><h2 id="parent-profile" className="mt-1 font-display text-xl font-bold">Parent profile</h2></div>
          <Button variant="outline" onClick={reload}>Refresh</Button>
        </div>
        <dl className="mt-5 grid gap-x-5 gap-y-4 text-sm sm:grid-cols-2 xl:grid-cols-4">
          <div><dt className="text-muted">Parent ID</dt><dd className="mt-1 break-words font-semibold">{data.parent.id}</dd></div>
          <div><dt className="text-muted">Name</dt><dd className="mt-1">{data.parent.full_name || 'Not recorded'}</dd></div>
          <div><dt className="text-muted">Contact</dt><dd className="mt-1 break-words">{data.parent.email}{data.parent.phone && <p>{data.parent.phone}</p>}</dd></div>
          <div><dt className="text-muted">Relationship / guardian status</dt><dd className="mt-1">{data.parent.relationship || 'Not recorded'}</dd></div>
        </dl>
      </Card>

      <section aria-labelledby="children-heading" className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div><p className="text-xs font-bold uppercase tracking-[0.14em] text-primary-strong">Family overview</p><h2 id="children-heading" className="mt-1 font-display text-2xl font-bold">Linked children</h2></div>
          <Badge variant="info" className="px-3 py-2">{data.children.length} {data.children.length === 1 ? 'child' : 'children'}</Badge>
        </div>
        {data.children.length === 0 ? <EmptyState title="No children linked yet" description="Your parent profile is available. Contact the school administrator to check your child links." /> : <>
          {data.children.length > 1 && <nav aria-label="Select a child" className="flex flex-wrap gap-2">
            {data.children.map(child => <Button key={child.id} variant={selectedChild?.id === child.id ? 'primary' : 'outline'} aria-pressed={selectedChild?.id === child.id} onClick={() => setSelectedChildId(child.id)}>
              {child.full_name}
            </Button>)}
          </nav>}
          {selectedChild && <Card as="article" key={selectedChild.id} className="p-5 sm:p-7">
            <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-5">
              <div className="min-w-0"><p className="text-xs font-bold uppercase tracking-[0.14em] text-primary-strong">Child health record</p><h3 className="mt-1 break-words font-display text-2xl font-bold">{selectedChild.full_name}</h3>
                <p className="mt-1 break-words text-sm text-muted">{selectedChild.id} · Class {selectedChild.class_name}</p>
                {selectedChild.date_of_birth && <p className="mt-1 text-sm text-muted">Born {dateText(selectedChild.date_of_birth)}</p>}
                {selectedChild.relationship && <p className="mt-1 text-sm text-muted">{selectedChild.relationship}</p>}
              </div>
              <StatusBadge status={selectedChild.latest_checkup?.status || 'No saved result'} />
            </header>

            <div className="grid gap-5 py-5 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
              <section aria-label={`Student profile for ${selectedChild.full_name}`}>
                <h4 className="font-bold">Profile information</h4>
                <dl className="mt-3 grid gap-4 text-sm leading-6 sm:grid-cols-2 lg:grid-cols-1">
                  <div><dt className="font-semibold">Allergies</dt><dd className="mt-1 whitespace-pre-wrap break-words text-muted">{selectedChild.allergies || 'Not recorded'}</dd></div>
                  <div><dt className="font-semibold">Medical notes</dt><dd className="mt-1 whitespace-pre-wrap break-words text-muted">{selectedChild.medical_notes || 'Not recorded'}</dd></div>
                </dl>
              </section>

              <section aria-label={`Latest checkup for ${selectedChild.full_name}`} className="min-w-0">
                <h4 className="font-bold">Latest saved checkup</h4>
                {selectedChild.latest_checkup ? <>
                  <p className="mt-2 text-sm text-muted">{selectedChild.latest_checkup.title} · {dateText(selectedChild.latest_checkup.checkup_date)}</p>
                  <Measurements checkup={selectedChild.latest_checkup} />
                  <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                    <div><dt className="font-semibold">Vision</dt><dd className="mt-1 text-muted">{selectedChild.latest_checkup.vision || 'Not recorded'}</dd></div>
                    <div><dt className="font-semibold">Checkup notes</dt><dd className="mt-1 whitespace-pre-wrap break-words text-muted">{selectedChild.latest_checkup.notes || 'Not recorded'}</dd></div>
                  </dl>
                </> : <EmptyState className="mt-3" title="No saved checkup result" description="There is no completed checkup result available for this child yet." />}
              </section>
            </div>

            {selectedChild.checkups.length > 1 && <section aria-labelledby="health-trends-title" className="border-t border-border py-5">
              <h4 id="health-trends-title" className="font-bold">Recorded measurement history</h4>
              <p className="mt-1 text-sm text-muted">Measurements are shown as recorded over time. These charts do not assess or diagnose health.</p>
              <Suspense fallback={<div role="status" aria-label="Loading measurement charts" className="mt-4 grid gap-4 sm:grid-cols-2"><Skeleton className="h-64" /><Skeleton className="h-64" /></div>}>
                <ParentHealthTrends checkups={selectedChild.checkups} />
              </Suspense>
            </section>}

            <details className="border-t border-border pt-4">
              <summary className="min-h-11 cursor-pointer py-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">Checkup history ({selectedChild.checkups.length})</summary>
              {selectedChild.checkups.length === 0 ? <p className="py-3 text-sm text-muted">No checkup participation recorded.</p> : <ol className="mt-3 space-y-3">
                {selectedChild.checkups.map(checkup => <li key={checkup.session_id} className="rounded-card border border-border bg-background p-4">
                  <div className="flex flex-wrap justify-between gap-2"><p className="text-sm font-semibold">{checkup.title}</p><StatusBadge status={checkup.status} /></div>
                  <p className="mt-2 text-xs text-muted">{dateText(checkup.checkup_date)} · {checkup.session_id}</p>
                  <Measurements checkup={checkup} />
                  {checkup.vision && <p className="mt-3 text-sm">Vision: {checkup.vision}</p>}
                  {checkup.notes && <p className="mt-2 whitespace-pre-wrap break-words text-sm">{checkup.notes}</p>}
                </li>)}
              </ol>}
            </details>
          </Card>}
        </>}
      </section>
    </>}
  </RoleWorkspace>
}
