import { useId, type ComponentPropsWithoutRef, type ReactNode } from 'react'

export type InputProps = Omit<ComponentPropsWithoutRef<'input'>, 'size'> & {
  error?: ReactNode
  helperText?: ReactNode
}

export function Input({
  error,
  helperText,
  className = '',
  'aria-describedby': describedBy,
  'aria-invalid': ariaInvalid,
  ...props
}: InputProps) {
  const id = useId()
  const helperId = helperText ? `${id}-help` : undefined
  const errorId = error ? `${id}-error` : undefined
  const linkedDescriptions = [describedBy, helperId, errorId].filter(Boolean).join(' ') || undefined

  return (
    <>
      <input
        {...props}
        aria-invalid={error ? true : ariaInvalid}
        aria-describedby={linkedDescriptions}
        className={`min-h-11 w-full rounded-control border border-border bg-surface px-3 py-2 text-base text-text placeholder:text-subtle focus-visible:border-primary-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-1 aria-invalid:border-danger aria-invalid:ring-2 aria-invalid:ring-danger/20 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-subtle ${className}`.trim()}
      />
      {helperText && <span id={helperId} className="mt-1 block text-sm leading-5 text-muted">{helperText}</span>}
      {error && <span id={errorId} className="mt-1 block text-sm leading-5 text-danger">{error}</span>}
    </>
  )
}
