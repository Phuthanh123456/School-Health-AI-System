import { useEffect, useState } from 'react'
import AdminHealthManagement from './AdminHealthManagement'
import AdminDashboard from './AdminDashboard'
import ParentDashboard from './ParentDashboard'
import LoginPage from './LoginPage'
import LandingPage from './LandingPage'
import NurseStudents from './NurseStudents'
import { NurseCheckupEntry } from './NurseCheckupEntry'
import { AppShell } from './AppShell'
import { restoreSession, roleLandingPaths, signIn, signOut, type UserRole } from './auth'

function RoleLandingPage({ role }: { role: Exclude<UserRole, 'nurse'> }) {
  return role === 'admin' ? <AdminHealthManagement /> : <ParentDashboard />
}

function ProtectedRoute({ role, insights = false, overview = false }: { role: UserRole; insights?: boolean; overview?: boolean }) {
  const [status, setStatus] = useState<'checking' | 'authenticated' | 'unavailable'>('checking')
  const [retry, setRetry] = useState(0)
  const [nurseSection, setNurseSection] = useState<'profiles' | 'checkups'>('profiles')
  const [nurseRoute, setNurseRoute] = useState<NurseRoute>({ kind: 'nurse-entry' })

  function navigateNurseSection(next: 'profiles' | 'checkups') {
    if (nurseSection === 'profiles' && next === 'checkups') setNurseRoute({ kind: 'nurse-entry' })
    setNurseSection(next)
  }

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
  const content = role === 'admin' && (insights || overview)
    ? <AdminDashboard />
    : role === 'nurse'
      ? <NurseWorkspace section={nurseSection} route={nurseRoute} onSectionChange={navigateNurseSection} onRouteChange={setNurseRoute} />
      : <RoleLandingPage role={role} />

  return <AppShell
    role={role}
    nurseSection={role === 'nurse' ? nurseSection : undefined}
    onNurseSectionChange={role === 'nurse' ? navigateNurseSection : undefined}
    onSignOut={() => { signOut(); window.location.assign('/login') }}
  >{content}</AppShell>
}

type NurseRoute =
  | { kind: 'nurse-entry' }
  | { kind: 'checkup-sessions'; selectedSessionId: string | null }
  | { kind: 'result-entry'; sessionId: string | null }

function NurseWorkspace({ section, route, onSectionChange, onRouteChange }: {
  section: 'profiles' | 'checkups'
  onSectionChange: (section: 'profiles' | 'checkups') => void
  route: NurseRoute
  onRouteChange: (route: NurseRoute) => void
}) {
  if (section === 'checkups') {
    return (
      <NurseCheckupEntry
        route={route}
        onClose={() => onSectionChange('profiles')}
        onSelectSession={(sessionId) => onRouteChange({ kind: 'checkup-sessions', selectedSessionId: sessionId })}
        onContinueToResults={(sessionId) => onRouteChange({ kind: 'result-entry', sessionId })}
      />
    )
  }

  return <NurseStudents />
}

function App() {
  const pathname = window.location.pathname.replace(/\/$/, '')

  if (pathname === '' && window.location.hash === '#admin') return <ProtectedRoute role="admin" overview />

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
  if (pathname === '/admin/insights') return <ProtectedRoute role="admin" insights />
  if (pathname === '/admin/overview') return <ProtectedRoute role="admin" overview />
  if (pathname === '/parent') return <ProtectedRoute role="parent" />

  return <LandingPage />
}

export default App
