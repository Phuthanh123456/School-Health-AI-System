import type { HTMLAttributes } from 'react'

export type SkeletonProps = HTMLAttributes<HTMLDivElement> & {
  shape?: 'text' | 'circle' | 'rect'
}

const shapes = {
  text: 'h-4 w-full rounded-md',
  circle: 'size-10 rounded-full',
  rect: 'min-h-10 w-full rounded-control',
}

export function Skeleton({ shape = 'rect', className = '', ...props }: SkeletonProps) {
  return (
    <div
      {...props}
      aria-hidden="true"
      className={`animate-pulse bg-slate-200 ${shapes[shape]} ${className}`.trim()}
    />
  )
}
