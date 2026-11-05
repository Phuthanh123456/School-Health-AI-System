import { useEffect, useId, useRef, type ReactNode } from 'react'
import { Button } from './Button'

export type DialogProps = {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  children: ReactNode
  actions?: ReactNode
  closeLabel?: string
  className?: string
}

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  actions,
  closeLabel = 'Close dialog',
  className = '',
}: DialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const descriptionId = useId()

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()

    return () => {
      if (dialog.open) dialog.close()
    }
  }, [open])

  if (!open) return null

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
      className={`m-auto max-h-[min(90dvh,48rem)] w-[calc(100%_-_2rem)] max-w-lg overflow-y-auto rounded-dialog border border-border bg-surface p-0 text-text shadow-xl backdrop:bg-slate-950/40 ${className}`.trim()}
    >
      <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4 sm:px-6">
        <div>
          <h2 id={titleId} className="text-lg font-bold leading-6">{title}</h2>
          {description && <p id={descriptionId} className="mt-1 text-sm leading-6 text-muted">{description}</p>}
        </div>
        <Button
          variant="ghost"
          size="sm"
          aria-label={closeLabel}
          onClick={onClose}
          className="shrink-0"
        >
          <span aria-hidden="true">×</span>
        </Button>
      </div>
      <div className="px-5 py-5 sm:px-6">{children}</div>
      {actions && <footer className="flex flex-wrap justify-end gap-3 border-t border-border px-5 py-4 sm:px-6">{actions}</footer>}
    </dialog>
  )
}
