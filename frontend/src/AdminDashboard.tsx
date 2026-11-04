import { useEffect, useRef, useState } from 'react'

export type AggregateStats = {
  total_students: number
  checkups_completed: number
  followups_pending: number
  vision_flags: number
  dental_flags: number
}
type Insights = {
  summary: string
  recommendations: string[]
  disclaimer: string
  aggregates: AggregateStats
}
const labels: Record<keyof AggregateStats, string> = {
  total_students: 'Tổng học sinh', checkups_completed: 'Đã khám',
  followups_pending: 'Chờ theo dõi', vision_flags: 'Cờ thị lực', dental_flags: 'Cờ răng miệng',
}
const demoStats: AggregateStats = {
  total_students: 480, checkups_completed: 420, followups_pending: 36, vision_flags: 84, dental_flags: 63,
}
const disclaimer = 'AI chỉ cung cấp thông tin tham khảo, không phải chẩn đoán hoặc chỉ định điều trị. Nhân viên y tế cần kiểm tra trước khi sử dụng.'

// Integration seam: pass the CURRENT school-wide counts from the dashboard API.
// Never pass a student collection or spread a dashboard API response into fetch.
export function AIInsightsPanel({ stats, adminToken }: { stats: AggregateStats; adminToken: string }) {
  const [result, setResult] = useState<Insights | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const active = useRef<AbortController | null>(null)
  const snapshot = JSON.stringify(stats)
  useEffect(() => () => { active.current?.abort() }, [])
  // If dashboard filters/counts or credentials change, discard in-flight responses.
  useEffect(() => {
    active.current?.abort()
    active.current = null
    setResult(null)
    setError('')
    setLoading(false)
  }, [snapshot, adminToken])

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
      followups_pending: stats.followups_pending, vision_flags: stats.vision_flags, dental_flags: stats.dental_flags,
    }
    try {
      const response = await fetch('/api/admin/ai-insights', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify(payload), signal: controller.signal,
      })
      if (!response.ok) {
        const messages: Record<number, string> = {
          403: 'Cần thông tin truy cập quản trị hợp lệ.',
          422: 'Số liệu chưa hợp lệ hoặc chưa đủ 20 học sinh và 20 lượt khám. Hãy kiểm tra lại.',
          503: 'Dịch vụ AI chưa sẵn sàng. Vui lòng liên hệ quản trị viên.',
          504: 'AI phản hồi quá lâu. Hãy thử lại.',
        }
        throw new Error(messages[response.status] || 'Chưa thể tạo nhận xét AI. Hãy thử lại sau.')
      }
      const data = await response.json() as Insights
      if (typeof data.summary !== 'string' || !Array.isArray(data.recommendations) || !data.recommendations.every(x => typeof x === 'string') || typeof data.disclaimer !== 'string') {
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
      <button onClick={generate} disabled={loading || !adminToken.trim() || !enoughData} className="min-h-12 rounded-full bg-primary px-6 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50 hover:bg-primary-strong focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary">
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
  const [adminToken, setAdminToken] = useState('')
  const [stats, setStats] = useState(demoStats)
  return <main className="min-h-screen bg-background px-5 py-8 text-foreground sm:px-10">
    <div className="mx-auto max-w-6xl">
      <header className="flex items-center justify-between border-b border-border pb-6"><a href="#home" className="text-lg font-bold">school<span className="text-primary">health</span></a><span className="text-sm text-muted">Admin · Bản xem trước</span></header>
      <div className="py-10"><p className="text-xs font-bold tracking-widest text-primary">SỨC KHỎE HỌC ĐƯỜNG</p><h1 className="mt-3 font-display text-4xl font-bold">Tổng quan nhà trường</h1><p className="mt-4 max-w-2xl leading-7 text-muted">Theo dõi các số đếm hiện tại và tạo nhận xét ngắn gọn để hỗ trợ lập kế hoạch.</p></div>
      <aside className="mb-6 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm leading-6 text-amber-950">Dữ liệu demo giả lập — chưa kết nối API thống kê hoặc hệ thống đăng nhập. Có thể thay đổi số đếm để thử nghiệm; đây không phải dữ liệu học sinh thật.</aside>
      <section aria-label="Thống kê tổng hợp hiện tại" className="mb-6 grid gap-3 sm:grid-cols-3 lg:grid-cols-5">{(Object.keys(labels) as (keyof AggregateStats)[]).map(key => <label key={key} className="rounded-2xl border border-border bg-white p-5"><span className="text-sm text-muted">{labels[key]}</span><input aria-label={labels[key]} type="number" min="0" max="1000000" step="1" value={stats[key]} onChange={e => setStats({ ...stats, [key]: Number(e.target.value) })} className="mt-3 w-full border-b border-border bg-transparent py-2 text-3xl font-bold focus:outline-primary" /></label>)}</section>
      <div className="mb-6 rounded-2xl border border-border bg-white p-5"><label htmlFor="admin-access" className="text-sm font-semibold">Thông tin truy cập quản trị (môi trường phát triển)</label><input id="admin-access" type="password" autoComplete="off" value={adminToken} onChange={e => setAdminToken(e.target.value)} className="mt-2 block min-h-11 w-full max-w-md rounded-lg border border-border px-3"/><p className="mt-2 text-xs leading-6 text-muted">Dùng mã INSIGHTS_ADMIN_TOKEN do backend cấp, không phải khóa Ollama. Chỉ giữ trong phiên trang, không lưu vào trình duyệt. Sẽ thay bằng đăng nhập Admin khi tích hợp.</p></div>
      <AIInsightsPanel stats={stats} adminToken={adminToken} />
      <footer className="py-6 text-xs text-muted">Các nhóm cờ và chờ theo dõi có thể trùng nhau. Không suy luận xu hướng thời gian từ một bản thống kê.</footer>
    </div>
  </main>
}
