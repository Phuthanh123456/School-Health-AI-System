import { useEffect, useState } from 'react'

import {
  getCheckupSession,
  listCheckupSessions,
  type CheckupSessionDetail,
  type CheckupSessionSummary,
} from '../api/checkupSessions'

type CheckupSessionsPageProps = {
  authorization: string
  selectedSessionId: string | null
  onBackHome: () => void
  onSelectSession: (sessionId: string | null) => void
  onContinueToResults: (sessionId: string) => void
}

type LoadState = 'idle' | 'loading' | 'ready' | 'error'

function formatDate(value: string): string {
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'long' }).format(date)
}

function CalendarIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="size-5">
      <path d="M7 3.75v3M17 3.75v3M4.25 9h15.5M6.5 5.25h11A2.25 2.25 0 0 1 19.75 7.5v11A2.25 2.25 0 0 1 17.5 20.75h-11A2.25 2.25 0 0 1 4.25 18.5v-11A2.25 2.25 0 0 1 6.5 5.25Z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function PeopleIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="size-5">
      <path d="M9 11.25a3.25 3.25 0 1 0 0-6.5 3.25 3.25 0 0 0 0 6.5ZM16.5 10.5a2.75 2.75 0 1 0 0-5.5M3.75 19v-1.25A4.25 4.25 0 0 1 8 13.5h2a4.25 4.25 0 0 1 4.25 4.25V19H3.75ZM16 13.75h.5a3.75 3.75 0 0 1 3.75 3.75V19H16" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function ArrowIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className="size-4">
      <path d="M4 10h11M10 5l5 5-5 5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function EmptySessions() {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-white px-6 py-10 text-center">
      <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-primary-soft text-primary-strong">
        <CalendarIcon />
      </span>
      <h3 className="mt-4 text-base font-bold">Chưa có đợt khám</h3>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted">
        Các đợt khám sẽ xuất hiện ở đây sau khi dữ liệu demo được nạp.
      </p>
    </div>
  )
}

function CheckupSessionsPage({
  authorization,
  selectedSessionId,
  onBackHome,
  onSelectSession,
  onContinueToResults,
}: CheckupSessionsPageProps) {
  const [sessions, setSessions] = useState<CheckupSessionSummary[]>([])
  const [sessionsState, setSessionsState] = useState<LoadState>('loading')
  const [sessionsError, setSessionsError] = useState('')
  const [sessionsReload, setSessionsReload] = useState(0)

  const [session, setSession] = useState<CheckupSessionDetail | null>(null)
  const [sessionState, setSessionState] = useState<LoadState>('idle')
  const [sessionError, setSessionError] = useState('')
  const [sessionReload, setSessionReload] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    setSessionsState('loading')
    setSessionsError('')

    listCheckupSessions(authorization, controller.signal)
      .then((data) => {
        setSessions(data)
        setSessionsState('ready')
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        setSessionsError(error instanceof Error ? error.message : 'Không tải được danh sách đợt khám.')
        setSessionsState('error')
      })

    return () => controller.abort()
  }, [authorization, sessionsReload])

  useEffect(() => {
    if (!selectedSessionId) {
      setSession(null)
      setSessionError('')
      setSessionState('idle')
      return
    }

    const controller = new AbortController()
    setSessionState('loading')
    setSessionError('')

    getCheckupSession(selectedSessionId, authorization, controller.signal)
      .then((data) => {
        setSession(data)
        setSessionState('ready')
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        setSession(null)
        setSessionError(error instanceof Error ? error.message : 'Không tải được danh sách học sinh.')
        setSessionState('error')
      })

    return () => controller.abort()
  }, [authorization, selectedSessionId, sessionReload])

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto min-h-screen max-w-7xl px-4 sm:px-8">
        <header className="flex min-h-16 items-center justify-between gap-4 border-b border-border py-3">
          <a href="#home" onClick={onBackHome} className="flex min-h-11 items-center gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2" aria-label="Về trang chủ SchoolHealth">
            <span className="grid size-9 place-items-center rounded-xl bg-primary text-white">
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="size-5"><path d="M12 4.25v15.5M4.25 12h15.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
            </span>
            <span className="font-display text-base font-extrabold tracking-[-0.04em]">school<span className="text-primary-strong">health</span></span>
          </a>
          <span className="hidden rounded-full border border-border bg-white px-3 py-2 text-xs font-semibold text-muted sm:inline-flex">
            KHU VỰC NHÂN VIÊN Y TẾ
          </span>
          <button type="button" onClick={onBackHome} className="inline-flex min-h-11 items-center rounded-full border border-border bg-white px-4 text-sm font-semibold transition-colors duration-150 hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2">
            Về trang chủ
          </button>
        </header>

        <section className="py-8 sm:py-10" aria-labelledby="page-title">
          <nav aria-label="Điều hướng đường dẫn" className="mb-5 text-sm text-muted">
            <a href="#home" onClick={onBackHome} className="rounded underline-offset-4 hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">Trang chủ</a>
            <span aria-hidden="true" className="mx-2">/</span>
            <span aria-current="page" className="font-semibold text-foreground">Đợt khám</span>
          </nav>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-bold tracking-[0.16em] text-primary-strong">THEO DÕI SỨC KHỎE HỌC ĐƯỜNG</p>
              <h1 id="page-title" className="mt-2 font-display text-3xl font-bold tracking-tight sm:text-4xl">Đợt khám sức khỏe</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-muted sm:text-base">
                Chọn một đợt khám có sẵn để xem lớp và danh sách học sinh tham gia.
              </p>
            </div>
            {sessionsState === 'ready' && sessions.length > 0 && (
              <span className="inline-flex w-fit items-center rounded-full border border-border bg-white px-3 py-2 text-sm font-semibold text-muted" aria-live="polite">
                {sessions.length} đợt khám
              </span>
            )}
          </div>

          <div className="mt-8 grid items-start gap-6 lg:grid-cols-[minmax(17rem,0.82fr)_minmax(0,1.18fr)]">
            <section aria-labelledby="sessions-heading" className="min-w-0">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 id="sessions-heading" className="text-lg font-bold">Phiên khám có sẵn</h2>
                {sessionsState === 'error' && (
                  <button type="button" onClick={() => setSessionsReload((value) => value + 1)} className="min-h-11 rounded-lg px-3 text-sm font-semibold text-primary-strong underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                    Thử lại
                  </button>
                )}
              </div>

              {sessionsState === 'loading' && (
                <div role="status" aria-live="polite" className="rounded-2xl border border-border bg-white px-5 py-6 text-sm text-muted">
                  Đang tải danh sách đợt khám…
                </div>
              )}

              {sessionsState === 'error' && (
                <div role="alert" className="rounded-2xl border border-red-200 bg-white px-5 py-5">
                  <p className="font-semibold text-red-800">Không tải được đợt khám</p>
                  <p className="mt-1 text-sm leading-6 text-muted">{sessionsError}</p>
                </div>
              )}

              {sessionsState === 'ready' && sessions.length === 0 && <EmptySessions />}

              {sessionsState === 'ready' && sessions.length > 0 && (
                <ul className="grid max-h-[36rem] gap-3 overflow-y-auto pr-1" aria-label="Danh sách đợt khám">
                  {sessions.map((item) => {
                    const isSelected = selectedSessionId === item.id
                    return (
                      <li key={item.id}>
                        <button
                          type="button"
                          aria-pressed={isSelected}
                          onClick={() => onSelectSession(item.id)}
                          className={`w-full rounded-2xl border p-4 text-left transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${isSelected ? 'border-primary bg-primary-soft' : 'border-border bg-white hover:border-primary/60'}`}
                        >
                          <span className="flex items-start justify-between gap-3">
                            <span className="min-w-0">
                              <span className="block text-base font-bold leading-6 text-foreground">{item.title}</span>
                              <span className="mt-2 flex items-center gap-2 text-sm text-muted">
                                <CalendarIcon />
                                <span>{formatDate(item.checkup_date)}</span>
                              </span>
                            </span>
                            <span className={`grid size-9 shrink-0 place-items-center rounded-xl ${isSelected ? 'bg-white text-primary-strong' : 'bg-background text-muted'}`} aria-hidden="true">
                              <ArrowIcon />
                            </span>
                          </span>
                          <span className="mt-4 flex flex-wrap items-center gap-2 text-xs font-semibold">
                            <span className="rounded-full bg-background px-3 py-1.5 text-foreground">
                              {item.class_name ? `Lớp ${item.class_name}` : 'Chưa có lớp'}
                            </span>
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-background px-3 py-1.5 text-muted">
                              <PeopleIcon />
                              {item.participant_count} học sinh
                            </span>
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>

            <section aria-labelledby="session-detail-heading" className="min-w-0 rounded-2xl border border-border bg-white">
              <div className="border-b border-border px-5 py-4 sm:px-6">
                <h2 id="session-detail-heading" className="text-lg font-bold">Chi tiết phiên khám</h2>
                <p className="mt-1 text-sm text-muted">Danh sách học sinh thuộc phiên đã chọn.</p>
              </div>

              {!selectedSessionId && (
                <div className="px-6 py-12 text-center sm:py-16">
                  <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-primary-soft text-primary-strong"><CalendarIcon /></span>
                  <p className="mt-4 font-semibold">Chọn một phiên khám</p>
                  <p className="mt-2 text-sm leading-6 text-muted">Thông tin phiên và danh sách học sinh sẽ hiển thị tại đây.</p>
                </div>
              )}

              {selectedSessionId && sessionState === 'loading' && (
                <div role="status" aria-live="polite" className="px-6 py-10 text-sm text-muted">Đang tải danh sách học sinh…</div>
              )}

              {selectedSessionId && sessionState === 'error' && (
                <div className="px-5 py-7 sm:px-6">
                  <div role="alert" className="rounded-xl border border-red-200 bg-background p-4">
                    <p className="font-semibold text-red-800">Không mở được phiên khám</p>
                    <p className="mt-1 text-sm leading-6 text-muted">{sessionError}</p>
                  </div>
                  <button type="button" onClick={() => setSessionReload((value) => value + 1)} className="mt-4 min-h-11 rounded-lg px-3 text-sm font-semibold text-primary-strong underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                    Tải lại phiên khám
                  </button>
                </div>
              )}

              {sessionState === 'ready' && session && (
                <div className="p-5 sm:p-6">
                  <div className="flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-xs font-bold tracking-[0.14em] text-primary-strong">{session.id}</p>
                      <h3 className="mt-2 font-display text-2xl font-bold leading-tight">{session.title}</h3>
                      <p className="mt-2 text-sm text-muted">{formatDate(session.checkup_date)}</p>
                    </div>
                    <button type="button" onClick={() => onSelectSession(null)} className="inline-flex min-h-11 w-fit items-center rounded-full border border-border px-4 text-sm font-semibold text-foreground transition-colors hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2">
                      Chọn phiên khác
                    </button>
                  </div>

                  <div className="mt-5 flex flex-wrap gap-3">
                    <span className="rounded-xl bg-background px-4 py-3 text-sm">
                      <span className="block text-xs text-muted">Lớp</span>
                      <span className="mt-1 block font-bold">{session.class_name ? `Lớp ${session.class_name}` : 'Chưa có lớp'}</span>
                    </span>
                    <span className="rounded-xl bg-background px-4 py-3 text-sm">
                      <span className="block text-xs text-muted">Học sinh tham gia</span>
                      <span className="mt-1 block font-bold">{session.participant_count}</span>
                    </span>
                  </div>

                  <div className="mt-6">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <h4 className="font-bold">Danh sách học sinh</h4>
                      <span className="text-sm text-muted">{session.students.length} học sinh</span>
                    </div>
                    {session.students.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-border bg-background px-4 py-6 text-center">
                        <p className="font-semibold">Phiên khám chưa có học sinh</p>
                        <p className="mt-1 text-sm text-muted">Danh sách sẽ hiển thị khi học sinh được gán vào phiên.</p>
                      </div>
                    ) : (
                      <ul className="max-h-[22rem] divide-y divide-border overflow-y-auto rounded-xl border border-border" aria-label={`Học sinh trong phiên ${session.title}`}>
                        {session.students.map((student, index) => (
                          <li key={student.id} className="flex min-h-14 items-center gap-3 px-3 py-2.5 sm:px-4">
                            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary-soft text-xs font-bold text-primary-strong" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-semibold">{student.full_name}</span>
                              <span className="mt-0.5 block text-xs text-muted">{student.id} · Lớp {student.class_name}</span>
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div className="mt-6 border-t border-border pt-5">
                    <button type="button" disabled={session.students.length === 0} onClick={() => onContinueToResults(session.id)} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-on-primary transition-colors duration-150 hover:bg-primary-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto">
                      Tiếp tục đến nhập kết quả <ArrowIcon />
                    </button>
                    <p className="mt-2 text-xs leading-5 text-muted">{session.students.length === 0 ? 'Phiên này chưa có học sinh tham gia nên chưa thể nhập kết quả.' : 'Mã phiên sẽ được chuyển sang màn hình nhập kết quả.'}</p>
                  </div>
                </div>
              )}
            </section>
          </div>
        </section>
      </div>
    </main>
  )
}

export default CheckupSessionsPage
