import { useCallback, useEffect, useRef, useState } from 'react'
import { authenticatedFetch, signOut } from './auth'

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
  total_students: 'Tổng học sinh', checkups_completed: 'Đã khám',
  followups_pending: 'Chờ theo dõi',
}
const disclaimer = 'AI chỉ cung cấp thông tin tham khảo, không phải chẩn đoán hoặc chỉ định điều trị. Nhân viên y tế cần kiểm tra trước khi sử dụng.'

type DashboardSnapshot = { aggregates: AggregateStats; session_title: string | null; session_date: string | null }

function isAggregates(value: unknown): value is AggregateStats {
  if (!value || typeof value !== 'object') return false
  const stats = value as AggregateStats
  return Object.keys(labels).every(key => Number.isSafeInteger(stats[key as keyof AggregateStats]) && stats[key as keyof AggregateStats] >= 0)
    && stats.checkups_completed <= stats.total_students && stats.followups_pending <= stats.checkups_completed
}

export function AIInsightsPanel({ stats }: { stats: AggregateStats }) {
  const [result, setResult] = useState<Insights | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [stale, setStale] = useState(false)
  const active = useRef<AbortController | null>(null)
  const snapshot = JSON.stringify(stats)
  useEffect(() => () => { active.current?.abort() }, [])
  // If dashboard counts change, discard in-flight responses.
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
    // An explicit allowlist prevents unexpected fields being sent to the backend.
    const payload: AggregateStats = {
      total_students: stats.total_students, checkups_completed: stats.checkups_completed,
      followups_pending: stats.followups_pending,
    }
    try {
      const response = await authenticatedFetch('/api/admin/ai-insights', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload), signal: controller.signal,
      })
      if (!response.ok) {
        if (response.status === 409) setStale(true)
        const messages: Record<number, string> = {
          409: 'Thống kê đã thay đổi. Nhấn Tải lại thống kê trước khi tạo nhận xét.',
          403: 'Cần thông tin truy cập quản trị hợp lệ.',
          422: 'Số liệu chưa hợp lệ hoặc chưa đủ 20 học sinh và 20 lượt khám. Hãy kiểm tra lại.',
          503: 'Dịch vụ AI chưa sẵn sàng. Vui lòng liên hệ quản trị viên.',
          504: 'AI phản hồi quá lâu. Hãy thử lại.',
        }
        throw new Error(messages[response.status] || 'Chưa thể tạo nhận xét AI. Hãy thử lại sau.')
      }
      const data = await response.json() as Insights
      if (!data || typeof data.summary !== 'string' || !Array.isArray(data.recommendations) || !data.recommendations.every(x => typeof x === 'string') || typeof data.disclaimer !== 'string' || !isAggregates(data.aggregates) || !(Object.keys(labels) as (keyof AggregateStats)[]).every(key => data.aggregates[key] === payload[key])) {
        throw new Error('Kết quả AI chưa hợp lệ. Hãy thử lại.')
      }
      if (active.current === controller) setResult(data)
    } catch (failure) {
      if (active.current === controller) setError(controller.signal.aborted
        ? 'Yêu cầu đã hết thời gian chờ. Hãy thử lại.'
        : failure instanceof TypeError ? 'Không kết nối được dịch vụ AI. Hãy kiểm tra kết nối và thử lại.'
        : failure instanceof Error ? failure.message : 'Không thể tạo nhận xét. Hãy thử lại.')
    } finally {
      window.clearTimeout(timeout)
      if (active.current === controller) { active.current = null; setLoading(false) }
    }
  }
  const enoughData = stats.total_students >= 20 && stats.checkups_completed >= 20
  return <section aria-labelledby="ai-title" aria-busy={loading} className="rounded-3xl border border-border bg-white p-6 sm:p-8">
    <div className="flex flex-wrap items-center justify-between gap-5">
      <div><p className="text-xs font-bold tracking-widest text-primary">AI · TỔNG QUAN CẤP TRƯỜNG</p>
        <h2 id="ai-title" className="mt-2 font-display text-2xl font-bold">Nhận xét từ số liệu</h2></div>
      <button onClick={generate} disabled={loading || stale || !enoughData} className="min-h-12 rounded-full bg-primary px-6 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50 hover:bg-primary-strong focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary">
        {loading ? 'Đang tạo nhận xét…' : 'Generate AI Insights'}
      </button>
    </div>
    <p className="mt-4 text-sm leading-6 text-muted">Chỉ gửi số đếm tổng hợp toàn trường. Không gửi tên, mã học sinh, ghi chú hoặc hồ sơ cá nhân. Nhóm có 1–4 học sinh được ẩn khỏi yêu cầu AI.</p>
    {!enoughData && <p className="mt-4 text-sm">Cần ít nhất 20 học sinh và 20 lượt khám để bảo vệ các nhóm nhỏ.</p>}
    <div aria-live="polite" className="mt-5">
      {loading && <p role="status">Đang phân tích thống kê hiện tại. Bạn vẫn có thể xem các chỉ số bên trên.</p>}
      {error && <p role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-900">{error} Các chỉ số trên dashboard vẫn được giữ nguyên.</p>}
      {!result && !loading && !error && <p className="rounded-xl bg-background p-5 text-sm text-muted">Chưa có nhận xét. Nhấn Generate AI Insights để tạo bản tóm tắt mới.</p>}
      {result && <article className="rounded-2xl bg-background p-5">
        <h3 className="font-bold">Tóm tắt do AI hỗ trợ</h3><p className="mt-3 leading-7">{result.summary}</p>
        <h3 className="mt-5 font-bold">Gợi ý cấp trường</h3>
        <ul className="mt-2 list-disc space-y-2 pl-5 text-sm leading-6">{result.recommendations.map(item => <li key={item}>{item}</li>)}</ul>
      </article>}
    </div>
    <p className="mt-5 border-t border-border pt-4 text-xs leading-6 text-muted">{result?.disclaimer || disclaimer}</p>
  </section>
}

export default function AdminDashboard() {
  const [snapshot, setSnapshot] = useState<DashboardSnapshot | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const active = useRef<AbortController | null>(null)
  const reload = useCallback(async () => {
    active.current?.abort()
    const controller = new AbortController()
    active.current = controller
    setLoading(true)
    setError('')
    setSnapshot(null)
    const timer = window.setTimeout(() => controller.abort(), 15000)
    try {
      const response = await authenticatedFetch('/api/admin/dashboard-statistics', { signal: controller.signal })
      if (!response.ok) throw new Error(response.status === 403 ? 'Bạn không có quyền xem thống kê Admin.' : 'Chưa tải được thống kê nhà trường. Hãy thử lại.')
      const data = await response.json() as DashboardSnapshot
      if (!data || !isAggregates(data.aggregates) || !(data.session_title === null || typeof data.session_title === 'string') || !(data.session_date === null || typeof data.session_date === 'string')) throw new Error('Thống kê trả về không hợp lệ.')
      if (active.current === controller) setSnapshot(data)
    } catch (failure) {
      if (active.current === controller) setError(controller.signal.aborted ? 'Tải thống kê quá lâu. Hãy thử lại.' : failure instanceof Error ? failure.message : 'Không thể tải thống kê.')
    } finally {
      window.clearTimeout(timer)
      if (active.current === controller) { active.current = null; setLoading(false) }
    }
  }, [])
  useEffect(() => { void reload(); return () => { active.current?.abort(); active.current = null } }, [reload])

  return <main className="min-h-screen bg-background px-5 py-8 text-foreground sm:px-10">
    <div className="mx-auto max-w-6xl">
      <header className="flex items-center justify-between border-b border-border pb-6"><a href="/" className="text-lg font-bold">school<span className="text-primary">health</span></a><button className="min-h-11 rounded-full border border-border px-4 text-sm" onClick={() => { signOut(); window.location.assign('/login') }}>Đăng xuất</button></header>
      <div className="flex flex-wrap items-end justify-between gap-5 py-10"><div><p className="text-xs font-bold tracking-widest text-primary">ADMIN · SỨC KHỎE HỌC ĐƯỜNG</p><h1 className="mt-3 font-display text-4xl font-bold">Tổng quan nhà trường</h1><p className="mt-4 max-w-2xl leading-7 text-muted">Số đếm tổng hợp từ cơ sở dữ liệu, theo đợt khám mới nhất của nhà trường.</p></div><button onClick={() => void reload()} disabled={loading} className="min-h-11 rounded-full border border-border bg-white px-5 font-semibold disabled:opacity-50">Tải lại thống kê</button></div>
      {loading && <p role="status" className="mb-6 rounded-2xl bg-white p-5">Đang tải thống kê nhà trường…</p>}
      {error && <p role="alert" className="mb-6 rounded-2xl border border-amber-300 bg-amber-50 p-5 text-amber-950">{error}</p>}
      {snapshot && <>
        <aside className="mb-6 rounded-2xl border border-border bg-white p-4 text-sm leading-6">{snapshot.session_date ? <>Đợt khám: <strong>{snapshot.session_title}</strong> · {snapshot.session_date}</> : 'Chưa có đợt khám nào. Các số đếm đã khám và chờ theo dõi hiện bằng 0.'} Không có tên, mã hoặc hồ sơ cá nhân trong thống kê này.</aside>
        <section aria-label="Thống kê tổng hợp hiện tại" className="mb-6 grid gap-3 sm:grid-cols-3">{(Object.keys(labels) as (keyof AggregateStats)[]).map(key => <article key={key} className="rounded-2xl border border-border bg-white p-5"><p className="text-sm text-muted">{labels[key]}</p><p aria-label={labels[key]} className="mt-3 text-3xl font-bold">{snapshot.aggregates[key].toLocaleString('vi-VN')}</p></article>)}</section>
        {snapshot.aggregates.total_students === 0 && <p className="mb-6 rounded-2xl bg-white p-5">Chưa có học sinh trong hệ thống.</p>}
        <AIInsightsPanel stats={snapshot.aggregates} />
      </>}
      <footer className="py-6 text-xs leading-6 text-muted">Đã khám bao gồm học sinh hoàn thành khám và học sinh cần theo dõi ở đợt mới nhất. Chờ theo dõi là một phần của nhóm đã khám. Không suy luận xu hướng thời gian từ một bản thống kê.</footer>
    </div>
  </main>
}
