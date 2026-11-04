import type { ReactNode } from 'react'
import { signOut } from './auth'

export const button = 'inline-flex min-h-11 items-center justify-center rounded-xl bg-primary-strong px-4 py-2 text-sm font-semibold text-white hover:bg-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50'
export const secondaryButton = 'inline-flex min-h-11 items-center justify-center rounded-xl border border-border bg-white px-4 py-2 text-sm font-semibold hover:border-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50'
export const selectStyle = 'mt-2 min-h-11 w-full rounded-xl border border-border bg-white px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-primary'

export function RoleWorkspace({ role, title, description, children }: {
  role: string; title: string; description: string; children: ReactNode
}) {
  return <main className="min-h-screen bg-background px-4 py-6 text-foreground sm:px-8">
    <div className="mx-auto max-w-7xl">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-5">
        <a href="/" className="font-display text-xl font-bold">school<span className="text-primary-strong">health</span></a>
        <div className="flex items-center gap-3"><span className="rounded-full bg-primary-soft px-3 py-2 text-xs font-bold">{role}</span>
          <button type="button" className={secondaryButton} onClick={() => { signOut(); window.location.assign('/login') }}>Sign out</button></div>
      </header>
      <div className="py-8"><h1 className="font-display text-3xl font-bold sm:text-4xl">{title}</h1><p className="mt-3 max-w-3xl leading-7 text-muted">{description}</p></div>
      {children}
    </div>
  </main>
}

export function LoadError({ message, retry }: { message: string; retry: () => void }) {
  return <div role="alert" className="mb-5 rounded-2xl border border-amber-300 bg-amber-50 p-5 text-amber-950">
    <p>{message}</p><button className={`${secondaryButton} mt-3`} type="button" onClick={retry}>Try again</button>
    <a href="/login" className="ml-4 inline-block py-3 text-sm font-semibold underline">Sign in</a>
  </div>
}

export function StatusBadge({ status }: { status: string }) {
  const style = status === 'Normal' ? 'bg-sky-100 text-sky-900' : status === 'Needs Follow-up' ? 'bg-amber-100 text-amber-950' : 'bg-slate-100 text-slate-700'
  return <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${style}`}>{status}</span>
}

