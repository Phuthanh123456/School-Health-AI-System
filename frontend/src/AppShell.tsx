import { useRef, useState, type ReactNode } from 'react'
import type { UserRole } from './auth'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'
import { MobileNavigation } from './MobileNavigation'

type NurseSection = 'profiles' | 'checkups'

export function AppShell({
  role,
  children,
  nurseSection,
  onNurseSectionChange,
  onSignOut,
}: {
  role: UserRole
  children: ReactNode
  nurseSection?: NurseSection
  onNurseSectionChange?: (section: NurseSection) => void
  onSignOut: () => void
}) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const menuTriggerRef = useRef<HTMLButtonElement>(null)
  const pathname = window.location.pathname.replace(/\/$/, '') || '/'
  const hash = window.location.hash
  const pageContext = role === 'admin'
    ? pathname === '/admin' ? 'Health management' : 'School overview & AI insights'
    : role === 'nurse'
      ? nurseSection === 'checkups' ? 'Checkup sessions and results' : 'Student profiles'
      : 'Family health'

  return (
    <div className="min-h-screen bg-background md:flex">
      <a href="#main-content" className="sr-only z-50 rounded-control bg-surface px-4 py-3 text-text focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:ring-2 focus:ring-primary">Skip to main content</a>
      <div className="sticky top-0 hidden h-dvh w-64 shrink-0 border-r border-border bg-surface md:block xl:w-72">
        <Sidebar role={role} pathname={pathname} hash={hash} nurseSection={nurseSection} onNurseSectionChange={onNurseSectionChange} />
      </div>
      <div className="min-w-0 flex-1">
        <Topbar
          role={role}
          pageContext={pageContext}
          onMenuClick={() => setMobileOpen(true)}
          menuTriggerRef={menuTriggerRef}
          onSignOut={onSignOut}
        />
        <div className="mx-auto w-full max-w-[96rem] px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
          <main id="main-content" tabIndex={-1} className="min-w-0 outline-none">{children}</main>
        </div>
      </div>
      <MobileNavigation
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        returnFocusRef={menuTriggerRef}
        role={role}
        pathname={pathname}
        hash={hash}
        nurseSection={nurseSection}
        onNurseSectionChange={onNurseSectionChange}
      />
    </div>
  )
}
