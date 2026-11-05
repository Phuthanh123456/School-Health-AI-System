import type { HTMLAttributes } from 'react'

export type BadgeVariant = 'neutral' | 'info' | 'success' | 'warning' | 'danger'
export type BadgeProps = HTMLAttributes<HTMLSpanElement> & { variant?: BadgeVariant }

const variants: Record<BadgeVariant, string> = {
  neutral: 'bg-slate-100 text-slate-800',
  info: 'bg-info-soft text-info',
  success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-warning',
  danger: 'bg-danger-soft text-danger',
}

export function Badge({ variant = 'neutral', className = '', ...props }: BadgeProps) {
  return (
    <span
      {...props}
      className={`inline-flex min-h-6 items-center rounded-full px-2.5 py-1 text-xs font-semibold leading-4 ${variants[variant]} ${className}`.trim()}
    />
  )
}
