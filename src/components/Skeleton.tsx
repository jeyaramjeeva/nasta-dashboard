import type { ReactNode } from 'react'

export function SkeletonPage() {
  return (
    <div className="skel-page" aria-busy="true" aria-label="Loading">
      <div className="skel skel-title" />
      <div className="skel skel-sub" />
      <div className="skel-grid">
        {Array.from({ length: 4 }).map((_, i) => (
          <div className="skel skel-card" key={i} />
        ))}
      </div>
      <div className="skel-grid skel-grid--2">
        <div className="skel skel-chart" />
        <div className="skel skel-chart" />
      </div>
    </div>
  )
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string
  body: string
  action?: ReactNode
}) {
  return (
    <div className="empty-state">
      <div className="empty-state__orb" />
      <h2>{title}</h2>
      <p>{body}</p>
      {action}
    </div>
  )
}
