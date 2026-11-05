import { navigationConfig, type NavigationItem } from './navigationConfig'
import type { UserRole } from './auth'

type NurseSection = 'profiles' | 'checkups'

function isCurrent(item: NavigationItem, role: UserRole, pathname: string, hash: string, section?: NurseSection) {
  if ('section' in item) return role === 'nurse' && section === item.section
  if (item.href === '/admin/overview') {
    return pathname === '/admin/overview' || pathname === '/admin/insights' || (pathname === '/' && hash === '#admin')
  }
  return pathname === item.href
}

function NavigationIcon({ kind, active }: { kind: 'records' | 'overview' | 'family' | 'profiles' | 'checkups'; active: boolean }) {
  const color = active ? 'text-primary' : 'text-subtle'
  return <span aria-hidden="true" className={`grid size-8 shrink-0 place-items-center rounded-lg ${active ? 'bg-surface' : 'bg-background'} ${color}`}>
    <svg viewBox="0 0 24 24" fill="none" className="size-[18px]" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      {kind === 'records' && <><path d="M7 3.75h8l4 4v12.5H7a2 2 0 0 1-2-2v-12a2.5 2.5 0 0 1 2-2.5Z"/><path d="M15 4v4h4M9 12h6M9 15.5h6"/></>}
      {kind === 'overview' && <><path d="M4 19.5h16M6.5 16V10m5 6V5m5 11v-8"/><path d="m5 8 5-3 5 3 4-3"/></>}
      {kind === 'family' && <><circle cx="9" cy="8" r="3"/><path d="M3.5 19v-1.2A4.3 4.3 0 0 1 7.8 13.5h2.4a4.3 4.3 0 0 1 4.3 4.3V19M16 5.5a2.7 2.7 0 0 1 0 5.2m1.1 2.8h.4a3.8 3.8 0 0 1 3.8 3.8V19h-3"/></>}
      {kind === 'profiles' && <><circle cx="12" cy="8" r="3.25"/><path d="M5 20v-1.25a5.75 5.75 0 0 1 5.75-5.75h2.5A5.75 5.75 0 0 1 19 18.75V20"/></>}
      {kind === 'checkups' && <><rect x="4" y="5.5" width="16" height="15" rx="2"/><path d="M8 3.5v4M16 3.5v4M4 10h16M8 14h3m-3 3h6"/></>}
    </svg>
  </span>
}

export function Sidebar({
  role,
  pathname,
  hash,
  nurseSection,
  onNurseSectionChange,
  onNavigate,
  onClose,
  className = '',
}: {
  role: UserRole
  pathname: string
  hash: string
  nurseSection?: NurseSection
  onNurseSectionChange?: (section: NurseSection) => void
  onNavigate?: () => void
  onClose?: () => void
  className?: string
}) {
  return (
    <aside aria-label={`${role} workspace`} className={`flex h-full min-h-0 w-full flex-col bg-surface ${className}`.trim()}>
      <div className="flex min-h-20 items-center justify-between gap-3 border-b border-border px-5">
        <a href="/" className="flex min-h-11 items-center gap-3 rounded-control focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2" aria-label="SchoolHealth home">
          <span aria-hidden="true" className="grid size-9 place-items-center rounded-control bg-primary text-lg font-bold text-on-primary">+</span>
          <span className="font-display text-lg font-extrabold tracking-tight text-text">school<span className="text-primary-strong">health</span></span>
        </a>
        {onClose && <button type="button" onClick={onClose} aria-label="Close navigation" className="grid size-11 place-items-center rounded-control text-xl text-muted hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">×</button>}
      </div>

      <div className="px-5 py-5">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-subtle">Workspace</p>
        <p className="mt-1 text-sm font-semibold text-text">{role === 'admin' ? 'Administration' : role === 'nurse' ? 'School health' : 'Family portal'}</p>
      </div>

      <nav aria-label={`${role} navigation`} className="flex-1 space-y-1 px-3">
        {navigationConfig[role].map((item) => {
          const current = isCurrent(item, role, pathname, hash, nurseSection)
          const className = `flex min-h-12 w-full items-center gap-3 rounded-control px-3 text-left text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${current ? 'bg-primary-soft text-primary-strong' : 'text-muted hover:bg-background hover:text-text'}`
          const kind = 'section' in item
            ? item.section
            : item.href === '/admin' ? 'records' : item.href === '/parent' ? 'family' : 'overview'
          const icon = <NavigationIcon kind={kind} active={current} />

          if ('section' in item) {
            return <button key={item.section} type="button" aria-pressed={current} aria-describedby={`${role}-${item.section}-description`} className={className} onClick={() => { onNurseSectionChange?.(item.section); onNavigate?.() }}>
              {icon}<span className="min-w-0 flex-1">{item.label}<span id={`${role}-${item.section}-description`} className="sr-only">{item.description}</span></span>
            </button>
          }

          return <a key={item.href} href={item.href} aria-current={current ? 'page' : undefined} aria-describedby={`${role}-${item.href.replaceAll('/', '-')}-description`} className={className} onClick={onNavigate}>
            {icon}<span className="min-w-0 flex-1">{item.label}<span id={`${role}-${item.href.replaceAll('/', '-')}-description`} className="sr-only">{item.description}</span></span>
          </a>
        })}
      </nav>

      <div className="border-t border-border px-5 py-4 text-xs leading-5 text-subtle">
        Health information is available only to authorized accounts.
      </div>
    </aside>
  )
}
