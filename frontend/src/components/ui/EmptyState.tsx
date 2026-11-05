import { useId, type ReactNode } from 'react'

export type EmptyStateProps = {
  title: string
  description: ReactNode
  action?: ReactNode
  icon?: ReactNode
  className?: string
}

export function EmptyState({ title, description, action, icon, className = '' }: EmptyStateProps) {
  const titleId = useId()

  return (
    <section
      aria-labelledby={titleId}
      className={`rounded-card border border-dashed border-border bg-surface px-6 py-8 text-center ${className}`.trim()}
    >
      {icon && <div aria-hidden="true" className="mx-auto mb-3 grid size-11 place-items-center rounded-control bg-secondary-soft text-secondary-strong">{icon}</div>}
      <h2 id={titleId} className="text-base font-bold text-text">{title}</h2>
      <div className="mx-auto mt-2 max-w-prose text-sm leading-6 text-muted">{description}</div>
      {action && <div className="mt-5">{action}</div>}
    </section>
  )
}
