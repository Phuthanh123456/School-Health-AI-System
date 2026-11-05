import type { ReactNode } from 'react'
import { Badge, Button, PageHeader } from './components/ui'

export const button = 'inline-flex min-h-11 items-center justify-center rounded-control bg-primary px-4 py-2 text-sm font-semibold text-on-primary hover:bg-primary-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50'
export const secondaryButton = 'inline-flex min-h-11 items-center justify-center rounded-control border border-border bg-surface px-4 py-2 text-sm font-semibold text-text hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50'
export const selectStyle = 'mt-2 min-h-11 w-full rounded-control border border-border bg-surface px-3 py-2 text-base text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1'

export function RoleWorkspace({ role, title, description, children }: {
  role: string; title: string; description: string; children: ReactNode
}) {
  return <section className="space-y-6">
    <PageHeader eyebrow={role} title={title} description={description} />
    {children}
  </section>
}

export function LoadError({ message, retry }: { message: string; retry: () => void }) {
  return <div role="alert" className="mb-5 rounded-card border border-warning bg-warning-soft p-5 text-warning">
    <p>{message}</p><Button variant="outline" className="mt-3" type="button" onClick={retry}>Try again</Button>
    <a href="/login" className="ml-4 inline-block py-3 text-sm font-semibold underline">Sign in</a>
  </div>
}

export function StatusBadge({ status }: { status: string }) {
  const variant = status === 'Normal' ? 'success' : status === 'Needs Follow-up' ? 'warning' : 'neutral'
  return <Badge variant={variant}>{status}</Badge>
}
