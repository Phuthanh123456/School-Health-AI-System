import type { ReactNode } from 'react'

export type PageHeaderProps = {
  title: string
  description?: ReactNode
  eyebrow?: ReactNode
  actions?: ReactNode
  className?: string
}

export function PageHeader({ title, description, eyebrow, actions, className = '' }: PageHeaderProps) {
  return (
    <header className={`flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-end sm:justify-between ${className}`.trim()}>
      <div className="min-w-0">
        {eyebrow && <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary-strong">{eyebrow}</p>}
        <h1 className={`${eyebrow ? 'mt-2' : ''} text-2xl font-bold leading-tight tracking-tight text-text sm:text-3xl`}>{title}</h1>
        {description && <p className="mt-2 max-w-prose text-base leading-6 text-muted">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-3">{actions}</div>}
    </header>
  )
}
