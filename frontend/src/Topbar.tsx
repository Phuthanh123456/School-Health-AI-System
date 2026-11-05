import { Button } from './components/ui'
import type { UserRole } from './auth'
import type { RefObject } from 'react'

export function Topbar({ role, pageContext, onMenuClick, menuTriggerRef, onSignOut }: {
  role: UserRole
  pageContext: string
  onMenuClick: () => void
  menuTriggerRef: RefObject<HTMLButtonElement | null>
  onSignOut: () => void
}) {
  const roleLabel = role === 'admin' ? 'Admin' : role === 'nurse' ? 'School nurse' : 'Parent'

  return (
    <header className="sticky top-0 z-20 flex min-h-16 items-center justify-between gap-3 border-b border-border bg-surface/95 px-4 backdrop-blur sm:px-6 lg:px-8">
      <div className="flex min-w-0 items-center gap-3">
        <button ref={menuTriggerRef} type="button" onClick={onMenuClick} aria-label="Open navigation" aria-haspopup="dialog" className="grid size-11 shrink-0 place-items-center rounded-control border border-border text-text hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary md:hidden">
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="size-5"><path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
        </button>
        <span className="truncate text-sm font-semibold text-muted">{pageContext}</span>
      </div>
      <div className="flex shrink-0 items-center gap-2 sm:gap-3">
        <span className="hidden rounded-full bg-primary-soft px-3 py-2 text-xs font-bold text-primary-strong sm:inline-flex">{roleLabel}</span>
        <Button variant="outline" size="sm" onClick={onSignOut}>Sign out</Button>
      </div>
    </header>
  )
}
