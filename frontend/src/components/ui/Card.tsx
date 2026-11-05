import type { ComponentPropsWithoutRef, ElementType } from 'react'

export type CardProps<T extends ElementType = 'div'> = {
  as?: T
} & ComponentPropsWithoutRef<T>

export function Card<T extends ElementType = 'div'>({
  as,
  className = '',
  ...props
}: CardProps<T>) {
  const Component = as ?? 'div'
  return (
    <Component
      {...props}
      className={`rounded-card border border-border bg-surface shadow-card ${className}`.trim()}
    />
  )
}
