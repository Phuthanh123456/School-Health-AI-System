import { lazy, Suspense, useEffect, useState } from 'react'
import { authenticatedFetch, getAccessToken } from './auth'
import AIInsightsPanel from './AIInsightsPanel'
import { Button, Card, EmptyState, PageHeader, Skeleton } from './components/ui'

const StatusDistributionChart = lazy(() => import('./StatusDistributionChart'))

type SchoolHealthOverview = {
  total_students: number
  completed_checkups: number
  status_counts: {
    normal: number
    needs_follow_up: number
  }
}

function isCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
}

function isOverview(value: unknown): value is SchoolHealthOverview {
  if (!value || typeof value !== 'object') return false
  const overview = value as Partial<SchoolHealthOverview>
  const statusCounts = overview.status_counts
  return isCount(overview.total_students)
    && isCount(overview.completed_checkups)
    && !!statusCounts
    && isCount(statusCounts.normal)
    && isCount(statusCounts.needs_follow_up)
    && overview.completed_checkups === statusCounts.normal + statusCounts.needs_follow_up
}

function errorForStatus(status: number): string {
  if (status === 401) return 'Your sign-in session has expired. Sign in again to view the school overview.'
  if (status === 403) return 'This overview is available to Admin accounts only.'
  return 'The school overview could not be loaded. Check the API connection and try again.'
}

function MetricCard({ label, value, detail, accent }: {
  label: string
  value: number
  detail: string
  accent: string
}) {
  return (
    <Card as="article" className="relative overflow-hidden p-5 sm:p-6">
      <span aria-hidden="true" className={`absolute inset-y-0 left-0 w-1 ${accent}`} />
      <h2 className="text-sm font-semibold text-muted">{label}</h2>
      <p className="mt-3 font-display text-4xl font-bold tracking-tight text-foreground" aria-label={`${value} ${label.toLowerCase()}`}>
        {value.toLocaleString()}
      </p>
      <p className="mt-2 text-xs leading-5 text-subtle">{detail}</p>
    </Card>
  )
}

export default function AdminDashboard() {
  const [overview, setOverview] = useState<SchoolHealthOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reload, setReload] = useState(0)
  const token = getAccessToken()

  useEffect(() => {
    const controller = new AbortController()
    let active = true
    setOverview(null)
    setLoading(true)
    setError('')

    if (!token) {
      setLoading(false)
      setError('Your sign-in session is unavailable. Sign in again to view the school overview.')
      return () => controller.abort()
    }

    let timedOut = false
    const timer = window.setTimeout(() => { timedOut = true; controller.abort() }, 15000)
    authenticatedFetch('/api/admin/dashboard', {
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error(errorForStatus(response.status))
        const data: unknown = await response.json()
        if (!isOverview(data)) throw new Error('The API returned an invalid school overview.')
        if (active) setOverview(data)
      })
      .catch((failure: unknown) => {
        if (!active || (controller.signal.aborted && !timedOut)) return
        setError(timedOut ? 'The school overview request timed out. Please try again.' : failure instanceof Error
          ? failure.message
          : 'The school overview could not be loaded. Try again.')
      })
      .finally(() => {
        window.clearTimeout(timer)
        if (active) setLoading(false)
      })

    return () => {
      active = false
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [reload, token])

  const hasResults = (overview?.completed_checkups ?? 0) > 0

  return (
    <div className="text-text">
      <div className="mx-auto max-w-7xl">
        <PageHeader
          className="py-8 sm:py-10"
          eyebrow="School health"
          title="School overview"
          description="A summary of students and saved checkup records across the school dataset."
          actions={<Button onClick={() => setReload((attempt) => attempt + 1)} loading={loading} loadingLabel="Loading data…">Refresh data</Button>}
        />

        {error && (
          <section role="alert" className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-card border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
            <p>{error}</p>
            <Button variant="outline" onClick={() => setReload((attempt) => attempt + 1)}>Try again</Button>
          </section>
        )}

        {loading && !overview ? (
          <section aria-label="Loading school health statistics" aria-busy="true" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[1, 2, 3, 4].map((item) => (
              <Card key={item} aria-hidden="true" className="space-y-4 p-5 sm:p-6">
                <Skeleton shape="text" className="w-2/5" />
                <Skeleton shape="text" className="h-10 w-1/3" />
                <Skeleton shape="text" className="w-4/5" />
              </Card>
            ))}
            <p role="status" className="sr-only">Loading school health statistics…</p>
          </section>
        ) : overview && (
          <>
            <section aria-label="School health summary metrics" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard label="Students" value={overview.total_students} detail="Distinct students in the dataset" accent="bg-primary" />
              <MetricCard label="Completed checkups" value={overview.completed_checkups} detail="Saved student and session records" accent="bg-secondary" />
              <MetricCard label="Normal" value={overview.status_counts.normal} detail="Records with a Nurse-selected Normal status" accent="bg-primary" />
              <MetricCard label="Needs follow-up" value={overview.status_counts.needs_follow_up} detail="Records with a Nurse-selected follow-up status" accent="bg-amber-500" />
            </section>

            <div className="mt-6"><AIInsightsPanel key={reload} stats={{
              total_students: overview.total_students,
              checkups_completed: overview.completed_checkups,
              followups_pending: overview.status_counts.needs_follow_up,
            }} /></div>
            <section className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(18rem,0.8fr)]">
              <Card as="article" className="p-5 sm:p-6">
                <div>
                  <h2 className="font-display text-xl font-bold">Checkup status distribution</h2>
                  <p className="mt-1 text-sm leading-6 text-muted">Saved records grouped by the status selected by the Nurse.</p>
                </div>
                {hasResults ? (
                  <Suspense fallback={<div role="status" className="mt-5 grid h-64 place-items-center rounded-xl bg-background px-5 text-sm text-muted">Loading status chart…</div>}>
                    <StatusDistributionChart
                      normal={overview.status_counts.normal}
                      needsFollowUp={overview.status_counts.needs_follow_up}
                    />
                  </Suspense>
                ) : (
                  <EmptyState className="mt-5" title="No completed checkups yet" description="Status counts will appear here after results are saved." />
                )}
                <table className="mt-3 w-full border-t border-border text-left text-sm">
                  <caption className="sr-only">Exact counts for the checkup status chart</caption>
                  <thead><tr className="text-muted"><th scope="col" className="py-3 font-semibold">Status</th><th scope="col" className="py-3 text-right font-semibold">Records</th></tr></thead>
                  <tbody>
                    <tr className="border-t border-border"><th scope="row" className="py-3 font-medium">Normal</th><td className="py-3 text-right tabular-nums">{overview.status_counts.normal.toLocaleString()}</td></tr>
                    <tr className="border-t border-border"><th scope="row" className="py-3 font-medium">Needs follow-up</th><td className="py-3 text-right tabular-nums">{overview.status_counts.needs_follow_up.toLocaleString()}</td></tr>
                  </tbody>
                </table>
              </Card>

              <Card as="aside" className="p-5 sm:p-6">
                <h2 className="font-display text-xl font-bold">How to read these totals</h2>
                <ul className="mt-4 space-y-4 text-sm leading-6 text-muted">
                  <li><strong className="text-foreground">Students</strong> counts each student once across the dataset.</li>
                  <li><strong className="text-foreground">Completed checkups</strong> counts saved records per student and session. A student checked in multiple sessions contributes one record per session.</li>
                  <li>The status chart includes only the structured <strong className="text-foreground">Normal</strong> and <strong className="text-foreground">Needs follow-up</strong> values selected by the Nurse.</li>
                </ul>
                <p className="mt-5 rounded-xl bg-background p-4 text-xs leading-5 text-muted">
                  Free-text medical notes are not classified into issue categories. The current dataset has no structured vision or dental issue fields.
                </p>
              </Card>
            </section>
          </>
        )}

        <footer className="mt-8 border-t border-border py-5 text-xs leading-5 text-subtle">
          School-wide aggregate data is visible to authorized Admin users only.
        </footer>
      </div>
    </div>
  )
}
