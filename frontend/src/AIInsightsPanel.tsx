import { useEffect, useRef, useState } from 'react'
import { authenticatedFetch } from './auth'
import { Badge, Button, Card, EmptyState, Skeleton } from './components/ui'

export type AggregateStats = {
  total_students: number
  checkups_completed: number
  followups_pending: number
}

type Insights = {
  summary: string
  recommendations: string[]
  disclaimer: string
  aggregates: AggregateStats
}

const labels: Record<keyof AggregateStats, string> = {
  total_students: 'Students',
  checkups_completed: 'Saved checkup records',
  followups_pending: 'Needs follow-up records',
}

const disclaimer = 'AI-generated content is for general information only. It is not a diagnosis or treatment recommendation. A qualified health professional should review any follow-up decisions.'

function isAggregates(value: unknown): value is AggregateStats {
  if (!value || typeof value !== 'object') return false
  const stats = value as AggregateStats
  return Object.keys(labels).every(key => Number.isSafeInteger(stats[key as keyof AggregateStats]) && stats[key as keyof AggregateStats] >= 0)
    && stats.followups_pending <= stats.checkups_completed
}

function messageForStatus(status: number): string {
  const messages: Record<number, string> = {
    403: 'Administrator access is required to request AI insights.',
    409: 'The dashboard statistics changed. Refresh the overview before generating insights again.',
    422: 'The current aggregate data is invalid or does not meet the service requirements.',
    503: 'The AI service is unavailable right now. Please try again later.',
    504: 'The AI service took too long to respond. Please try again.',
  }
  return messages[status] || 'AI insights could not be generated. Please try again.'
}

function Metric({ label, value }: { label: string; value: number }) {
  return <Card as="div" className="p-4">
    <dt className="text-sm leading-5 text-muted">{label}</dt>
    <dd className="mt-2 font-display text-2xl font-bold tabular-nums text-text">{value.toLocaleString()}</dd>
  </Card>
}

export default function AIInsightsPanel({ stats }: { stats: AggregateStats }) {
  const [result, setResult] = useState<Insights | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [stale, setStale] = useState(false)
  const active = useRef<AbortController | null>(null)
  const snapshot = JSON.stringify(stats)

  useEffect(() => () => { active.current?.abort() }, [])

  // A changed dashboard snapshot invalidates any in-flight response and old insight.
  useEffect(() => {
    active.current?.abort()
    active.current = null
    setResult(null)
    setError('')
    setStale(false)
    setLoading(false)
  }, [snapshot])

  async function generate() {
    if (active.current) return
    const controller = new AbortController()
    active.current = controller
    setLoading(true)
    setResult(null)
    setError('')
    const timeout = window.setTimeout(() => controller.abort(), 25000)
    // Keep the backend payload limited to the existing three aggregate fields.
    const payload: AggregateStats = {
      total_students: stats.total_students,
      checkups_completed: stats.checkups_completed,
      followups_pending: stats.followups_pending,
    }

    try {
      const response = await authenticatedFetch('/api/admin/ai-insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      })
      if (!response.ok) throw new Error(messageForStatus(response.status))
      const data: unknown = await response.json()
      if (!data || typeof data !== 'object') throw new Error('The AI response was invalid. Please try again.')
      const insights = data as Partial<Insights>
      if (typeof insights.summary !== 'string' || !Array.isArray(insights.recommendations)
        || !insights.recommendations.every(item => typeof item === 'string')
        || typeof insights.disclaimer !== 'string' || !isAggregates(insights.aggregates)
        || !(Object.keys(labels) as (keyof AggregateStats)[]).every(key => insights.aggregates![key] === payload[key])) {
        throw new Error('The AI response was invalid or did not match the current dashboard statistics.')
      }
      if (active.current === controller) setResult(insights as Insights)
    } catch (failure) {
      if (active.current === controller) {
        if (failure instanceof Error && failure.message.includes('statistics changed')) setStale(true)
        setError(controller.signal.aborted
          ? 'The request timed out. Please try again.'
          : failure instanceof TypeError
            ? 'Could not connect to the AI service. Check the connection and try again.'
            : failure instanceof Error ? failure.message : 'AI insights could not be generated. Please try again.')
      }
    } finally {
      window.clearTimeout(timeout)
      if (active.current === controller) {
        active.current = null
        setLoading(false)
      }
    }
  }

  const enoughData = stats.total_students >= 20 && stats.checkups_completed >= 20
  const normalRecords = stats.checkups_completed - stats.followups_pending
  const summaryMetrics = [
    { key: 'total_students' as const, value: stats.total_students },
    { key: 'checkups_completed' as const, value: stats.checkups_completed },
    { key: 'followups_pending' as const, value: stats.followups_pending },
  ]

  return <section aria-labelledby="ai-title" aria-busy={loading} className="space-y-5">
    <Card as="div" className="overflow-hidden">
      <div className="border-b border-border bg-gradient-to-r from-primary-soft via-surface to-secondary-soft px-5 py-5 sm:px-7 sm:py-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl">
            <Badge variant="info">Admin · School-level aggregates</Badge>
            <h2 id="ai-title" className="mt-3 font-display text-2xl font-bold text-text sm:text-3xl">AI health insights</h2>
            <p className="mt-2 text-sm leading-6 text-muted">A concise overview based on the current School Overview totals. No student names, IDs, individual records, or medical notes are sent.</p>
          </div>
          <Button onClick={generate} loading={loading} loadingLabel="Generating insights…" disabled={stale || !enoughData} className="shrink-0">
            Generate AI Insights
          </Button>
        </div>
        {!enoughData && <p className="mt-4 rounded-control border border-info-soft bg-surface/80 p-3 text-sm leading-6 text-muted">
          At least 20 students and 20 saved checkup records are required before the AI request can be made.
        </p>}
      </div>

      <div className="grid gap-6 p-5 sm:p-7">
        <section aria-labelledby="aggregate-title">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div><h3 id="aggregate-title" className="font-display text-lg font-bold">Aggregate data summary</h3><p className="mt-1 text-sm text-muted">Current authorized dashboard snapshot</p></div>
            <span className="text-xs text-subtle">Counts are records unless labeled students</span>
          </div>
          <dl className="mt-4 grid gap-3 sm:grid-cols-3">
            {summaryMetrics.map(metric => <Metric key={metric.key} label={labels[metric.key]} value={metric.value} />)}
          </dl>
        </section>

        <section aria-labelledby="observations-title" className="border-t border-border pt-5">
          <div><h3 id="observations-title" className="font-display text-lg font-bold">Key observations</h3><p className="mt-1 text-sm text-muted">Calculated from stored, Nurse-selected status totals.</p></div>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            <li className="rounded-card border border-border bg-background p-4">
              <p className="text-sm font-semibold">Normal status</p><p className="mt-1 text-sm text-muted">{normalRecords.toLocaleString()} saved checkup {normalRecords === 1 ? 'record' : 'records'}</p>
            </li>
            <li className="rounded-card border border-border bg-background p-4">
              <p className="text-sm font-semibold">Needs follow-up</p><p className="mt-1 text-sm text-muted">{stats.followups_pending.toLocaleString()} saved checkup {stats.followups_pending === 1 ? 'record' : 'records'}</p>
            </li>
          </ul>
        </section>

        <section aria-labelledby="generated-insights-title" aria-live="polite" className="border-t border-border pt-5">
          <div><h3 id="generated-insights-title" className="font-display text-lg font-bold">AI-generated insights</h3><p className="mt-1 text-sm text-muted">Insights are generated on request and must be reviewed by school health staff.</p></div>
          {loading && <div role="status" className="mt-4 space-y-3 rounded-card border border-border bg-background p-4">
            <p className="text-sm font-semibold">Generating a summary from the current aggregate snapshot…</p><Skeleton shape="text" /><Skeleton shape="text" className="w-4/5" />
          </div>}
          {error && <div role="alert" className="mt-4 rounded-card border border-warning bg-warning-soft p-4 text-sm text-warning">
            <p>{error}</p>
            {!stale && enoughData && <Button variant="outline" size="sm" className="mt-3" onClick={generate}>Try again</Button>}
          </div>}
          {stale && <p className="mt-3 text-sm text-muted">Refresh School Overview to use the latest aggregate totals before generating another summary.</p>}
          {!result && !loading && !error && <EmptyState className="mt-4" title="No AI summary yet" description="Generate a new summary to review school-level patterns and recommendations." />}
          {result && <div className="mt-4 space-y-4">
            <Card as="article" aria-labelledby="ai-summary-title" className="border-primary/30 bg-primary-soft/40 p-5">
              <h4 id="ai-summary-title" className="font-bold">Summary</h4><p className="mt-2 whitespace-pre-wrap break-words text-sm leading-7 text-text">{result.summary}</p>
            </Card>
            <section aria-labelledby="recommendations-title">
              <h4 id="recommendations-title" className="font-bold">School-level recommendations</h4>
              {result.recommendations.length ? <ol className="mt-3 grid gap-3 md:grid-cols-2">
                {result.recommendations.map((item, index) => <li key={`${index}-${item}`} className="flex gap-3 rounded-card border border-border bg-surface p-4">
                  <span aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-full bg-secondary-soft text-sm font-bold text-secondary-strong">{index + 1}</span>
                  <p className="min-w-0 whitespace-pre-wrap break-words text-sm leading-6">{item}</p>
                </li>)}
              </ol> : <p className="mt-3 rounded-control bg-background p-4 text-sm text-muted">No recommendations were returned for this snapshot.</p>}
            </section>
          </div>}
        </section>

        <p className="border-t border-border pt-4 text-xs leading-6 text-muted">{result?.disclaimer || disclaimer}</p>
      </div>
    </Card>
  </section>
}
