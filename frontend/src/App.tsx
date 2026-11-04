import { useEffect, useState } from 'react'
import LoginPage from './LoginPage'
import NurseStudents from './NurseStudents'
import { restoreSession, roleLandingPaths, signIn, signOut, type UserRole } from './auth'

const features = [
  {
    number: '01',
    title: 'Health records',
    description: 'Keep health history and records throughout the school years.',
    icon: 'record',
  },
  {
    number: '02',
    title: 'Continuous tracking',
    description: 'See trends across checkups and recognize when follow-up is needed.',
    icon: 'trend',
  },
  {
    number: '03',
    title: 'Coordinated care',
    description: 'Connect families, schools, and health staff with appropriate access.',
    icon: 'people',
  },
]

function FeatureIcon({ name }: { name: string }) {
  if (name === 'record') {
    return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="size-6"><path d="M7 4.75h10A2.25 2.25 0 0 1 19.25 7v13.25H6.5A2.75 2.75 0 0 1 3.75 17.5v-10A2.75 2.75 0 0 1 6.5 4.75H7Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"/><path d="M8 9h7M8 12.5h7M8 16h4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/></svg>
  }
  if (name === 'trend') {
    return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="size-6"><path d="M4 18.5h16M5.5 15l4.2-4.2 3.1 2.7 5.7-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/><path d="M14.5 7.5h4v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
  }
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="size-6"><path d="M9 11.25a3.25 3.25 0 1 0 0-6.5 3.25 3.25 0 0 0 0 6.5ZM16.5 10.5a2.75 2.75 0 1 0 0-5.5M3.75 19v-1.25A4.25 4.25 0 0 1 8 13.5h2a4.25 4.25 0 0 1 4.25 4.25V19H3.75ZM16 13.75h.5a3.75 3.75 0 0 1 3.75 3.75V19H16" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></svg>
}

function ArrowIcon() {
  return <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className="ml-2 size-4"><path d="M4 10h11M10 5l5 5-5 5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></svg>
}

const roleLandingContent: Record<Exclude<UserRole, 'nurse'>, { title: string; description: string }> = {
  admin: {
    title: 'Administrator workspace',
    description: 'Your role-specific dashboard will appear here as its features are added.',
  },
  parent: {
    title: 'Parent workspace',
    description: 'Your role-specific health overview will appear here as its features are added.',
  },
}

function RoleLandingPage({ role }: { role: Exclude<UserRole, 'nurse'> }) {
  const content = roleLandingContent[role]

  function handleSignOut() {
    signOut()
    window.location.assign('/')
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 py-12 text-foreground">
      <section className="w-full max-w-xl rounded-3xl border border-border bg-white p-8 shadow-sm sm:p-10">
        <p className="text-sm font-semibold uppercase tracking-wide text-primary-strong">SchoolHealth</p>
        <h1 className="mt-4 font-display text-3xl font-bold tracking-tight">{content.title}</h1>
        <p className="mt-3 leading-7 text-muted">{content.description}</p>
        <button
          type="button"
          onClick={handleSignOut}
          className="mt-8 inline-flex min-h-11 items-center rounded-full bg-primary px-5 py-3 text-sm font-semibold text-on-primary transition hover:bg-sky-mid focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        >
          Sign out
        </button>
      </section>
    </main>
  )
}

function LandingPage() {
  return (
    <main className="min-h-screen overflow-hidden bg-background text-foreground">
      <div className="relative mx-auto flex min-h-screen max-w-7xl flex-col px-6 sm:px-10">
        <header className="flex items-center justify-between border-b border-border py-6">
          <a href="#home" className="flex items-center gap-3" aria-label="SchoolHealth home">
            <span className="grid size-10 place-items-center rounded-2xl bg-primary text-xl text-white shadow-sm">
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="size-6"><path d="M12 4.25v15.5M4.25 12h15.5M6.52 6.52l10.96 10.96m0-10.96L6.52 17.48" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
            </span>
            <span className="font-display text-lg font-extrabold tracking-[-0.04em]">
              school<span className="text-primary-strong">health</span>
            </span>
          </a>
          <span className="hidden rounded-full border border-border bg-white/80 px-4 py-2 text-xs font-semibold tracking-wide text-muted sm:block">
            CONNECTED SCHOOL HEALTH
          </span>
          <a href="/login" className="inline-flex min-h-11 cursor-pointer items-center rounded-full border border-border bg-white px-4 py-2.5 text-sm font-semibold transition duration-200 hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2">
            Sign in <ArrowIcon />
          </a>
        </header>

        <section id="home" className="grid flex-1 items-center gap-14 py-16 lg:grid-cols-[1.02fr_0.98fr] lg:py-20">
          <div className="relative z-10 max-w-2xl">
            <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-border bg-primary-soft px-3.5 py-2 text-xs font-semibold text-primary-strong">
              <span className="size-2 rounded-full bg-primary" />
              Better care starts with understanding
            </div>
            <h1 className="font-display text-[clamp(3.2rem,7vw,6.5rem)] font-semibold leading-[0.98] tracking-[-0.075em]">
              Every checkup,
              <br />
              <span className="text-primary">a healthier</span>
              <br />
              start.
            </h1>
            <p className="mt-7 max-w-lg text-base leading-7 text-muted sm:text-lg sm:leading-8">
              SchoolHealth connects health records, checkup results, and the people who support each student—for continuous, clear, and safe school health care.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-4">
              <a href="#features" className="inline-flex min-h-12 cursor-pointer items-center rounded-full bg-primary px-6 py-3.5 text-sm font-semibold text-on-primary shadow-sm transition duration-200 hover:-translate-y-0.5 hover:bg-sky-mid focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2">
                Explore the platform <ArrowIcon />
              </a>
              <span className="text-xs text-muted">For families · schools · school health staff</span>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-[34rem] lg:mr-0">
            <div className="relative rounded-3xl border border-border bg-white p-4 shadow-sm sm:p-6">
              <div className="flex items-start justify-between border-b border-border pb-5">
                <div>
                  <p className="text-xs font-medium text-subtle">HEALTH OVERVIEW</p>
                  <h2 className="mt-1 font-display text-xl font-bold tracking-tight">One continuous journey</h2>
                </div>
                <span className="rounded-full bg-primary-soft px-3 py-1.5 text-xs font-semibold text-primary-strong">2025 — 2026</span>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-background p-4">
                  <span className="grid size-9 place-items-center rounded-xl bg-primary-soft text-primary-strong"><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="size-5"><path d="M20.25 8.25c0 5.25-8.25 10-8.25 10s-8.25-4.75-8.25-10a4.25 4.25 0 0 1 8.25-1.4 4.25 4.25 0 0 1 8.25 1.4Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"/><path d="M3.75 12h4l1.75-3 2.5 6 1.75-3h6.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></svg></span>
                  <p className="mt-5 text-sm font-semibold">Centralized records</p>
                  <p className="mt-1 text-sm leading-6 text-muted">Health history across school years</p>
                </div>
                <div className="rounded-2xl bg-background p-4">
                  <span className="grid size-9 place-items-center rounded-xl bg-primary-soft text-primary-strong"><FeatureIcon name="trend" /></span>
                  <p className="mt-5 text-sm font-semibold">Clear tracking</p>
                  <p className="mt-1 text-sm leading-6 text-muted">Trends and results from each checkup</p>
                </div>
              </div>

              <div className="mt-3 rounded-2xl border border-border p-4 sm:p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-subtle">SHARED CARE</p>
                    <p className="mt-1 text-sm font-semibold">Care together, with the right access</p>
                  </div>
                  <div className="flex -space-x-2" aria-label="Family, school, and health staff">
                    <span className="grid size-9 place-items-center rounded-full border-2 border-white bg-sky-soft text-xs">FA</span>
                    <span className="grid size-9 place-items-center rounded-full border-2 border-white bg-primary-soft text-xs">SC</span>
                    <span className="grid size-9 place-items-center rounded-full border-2 border-white bg-sky-mid text-xs">HS</span>
                  </div>
                </div>
                <div role="img" className="mt-5 flex h-14 items-end gap-2" aria-label="Illustrative health trends chart">
                  {[34, 47, 40, 62, 53, 76, 66, 88, 73, 94, 82, 100].map((height, index) => (
                    <span
                      key={index}
                      className={`flex-1 rounded-t-md ${index === 9 ? 'bg-primary' : 'bg-sky-mid'}`}
                      style={{ height: `${height}%` }}
                    />
                  ))}
                </div>
                <p className="mt-2 text-right text-xs text-subtle">Illustrative trends over time</p>
              </div>
              <div className="mt-3 flex items-center gap-2 rounded-xl bg-background px-4 py-3 text-sm leading-6 text-muted">
                <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="size-5 shrink-0 text-primary"><path d="m12 3 1.6 6.4L20 11l-6.4 1.6L12 19l-1.6-6.4L4 11l6.4-1.6L12 3Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/><path d="m19 15 .7 2.3L22 18l-2.3.7L19 21l-.7-2.3L16 18l2.3-.7L19 15Z" fill="currentColor"/></svg>
                AI can help explain information; clinical decisions remain with health professionals.
              </div>
            </div>
            <div className="absolute -left-6 top-24 hidden rounded-2xl border border-white bg-white px-4 py-3 shadow-lg sm:block">
              <span className="text-xs text-subtle">Ready for</span>
              <p className="mt-0.5 text-sm font-bold">a healthier school year</p>
            </div>
          </div>
        </section>

        <section id="features" className="grid gap-4 border-t border-border py-8 sm:grid-cols-3 sm:py-10">
          {features.map((feature) => (
            <article key={feature.number} className="group flex gap-4 rounded-2xl p-3 transition hover:bg-white/70">
              <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-primary-soft text-primary-strong">
                <FeatureIcon name={feature.icon} />
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold tracking-widest text-subtle">{feature.number}</span>
                  <h3 className="text-sm font-bold">{feature.title}</h3>
                </div>
                <p className="mt-1.5 max-w-xs text-sm leading-6 text-muted">{feature.description}</p>
              </div>
            </article>
          ))}
        </section>

        <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-border py-5 text-xs text-subtle">
          <span>SchoolHealth · Continuous school health care</span>
          <span>Use synthetic data in demos.</span>
        </footer>
      </div>
    </main>
  )
}

function ProtectedRoute({ role }: { role: UserRole }) {
  const [status, setStatus] = useState<'checking' | 'authenticated' | 'unavailable'>('checking')
  const [retry, setRetry] = useState(0)

  useEffect(() => {
    let cancelled = false
    let expiryTimer: number | undefined

    restoreSession()
      .then((session) => {
        if (cancelled) return
        if (!session) {
          window.location.replace('/login')
          return
        }
        if (session.expiresAt <= Date.now()) {
          signOut()
          window.location.replace('/login')
          return
        }
        if (session.user.role !== role) {
          window.location.replace(roleLandingPaths[session.user.role])
          return
        }

        setStatus('authenticated')
        expiryTimer = window.setTimeout(() => {
          signOut()
          window.location.replace('/login')
        }, Math.max(0, session.expiresAt - Date.now()))
      })
      .catch(() => {
        if (!cancelled) setStatus('unavailable')
      })

    return () => {
      cancelled = true
      if (expiryTimer !== undefined) window.clearTimeout(expiryTimer)
    }
  }, [retry, role])

  if (status === 'checking') {
    return (
      <main className="grid min-h-screen place-items-center bg-background px-6 text-foreground" role="status">
        <p className="text-sm text-muted">Verifying your session…</p>
      </main>
    )
  }

  if (status === 'unavailable') {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-6 py-12 text-foreground">
        <section className="w-full max-w-lg rounded-3xl border border-border bg-white p-8 shadow-sm">
          <h1 className="font-display text-2xl font-bold tracking-tight">Session could not be verified</h1>
          <p className="mt-3 leading-7 text-muted">
            Check your connection to SchoolHealth and try again. Your session will stay unavailable until it can be verified.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => {
                setStatus('checking')
                setRetry((attempt) => attempt + 1)
              }}
              className="min-h-11 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-on-primary hover:bg-sky-mid focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            >
              Try again
            </button>
            <a href="/login" className="inline-flex min-h-11 items-center rounded-full border border-border px-5 py-3 text-sm font-semibold hover:border-primary hover:text-primary">
              Go to sign in
            </a>
          </div>
        </section>
      </main>
    )
  }

  if (status !== 'authenticated') return null
  if (role === 'nurse') return <NurseStudents />
  return <RoleLandingPage role={role} />
}

function App() {
  const pathname = window.location.pathname.replace(/\/$/, '')

  if (pathname === '/login') {
    return (
      <LoginPage
        onLogin={async (credentials) => {
          const user = await signIn(credentials)
          window.location.assign(roleLandingPaths[user.role])
        }}
      />
    )
  }
  if (pathname === '/nurse') return <ProtectedRoute role="nurse" />
  if (pathname === '/admin') return <ProtectedRoute role="admin" />
  if (pathname === '/parent') return <ProtectedRoute role="parent" />

  return <LandingPage />
}

export default App
