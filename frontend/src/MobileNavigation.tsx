import { useEffect, useRef, type RefObject } from 'react'
import type { UserRole } from './auth'
import { Sidebar } from './Sidebar'

type NurseSection = 'profiles' | 'checkups'

export function MobileNavigation({
  open,
  onClose,
  returnFocusRef,
  role,
  pathname,
  hash,
  nurseSection,
  onNurseSectionChange,
}: {
  open: boolean
  onClose: () => void
  returnFocusRef: RefObject<HTMLButtonElement | null>
  role: UserRole
  pathname: string
  hash: string
  nurseSection?: NurseSection
  onNurseSectionChange?: (section: NurseSection) => void
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const wasOpen = useRef(false)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    if (open && !dialog.open) {
      dialog.showModal()
      wasOpen.current = true
      dialog.querySelector<HTMLElement>('nav a[aria-current="page"], nav button[aria-current="page"], nav a, nav button')?.focus()
    } else if (!open && dialog.open) {
      dialog.close()
    }

    return () => {
      if (dialog.open) dialog.close()
    }
  }, [open, returnFocusRef])

  useEffect(() => {
    if (!open && wasOpen.current) {
      wasOpen.current = false
      returnFocusRef.current?.focus()
    }
  }, [open, returnFocusRef])

  if (!open) return null

  return (
    <dialog
      ref={dialogRef}
      aria-label="Mobile navigation"
      onCancel={(event) => { event.preventDefault(); onClose() }}
      className="fixed inset-y-0 left-0 m-0 h-dvh max-h-none w-[min(20rem,88vw)] max-w-none border-0 bg-transparent p-0 text-text backdrop:bg-slate-950/45"
    >
      <Sidebar
        role={role}
        pathname={pathname}
        hash={hash}
        nurseSection={nurseSection}
        onNurseSectionChange={onNurseSectionChange}
        onNavigate={onClose}
        onClose={onClose}
        className="shadow-xl"
      />
    </dialog>
  )
}
