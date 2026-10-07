interface Props {
  percent: number
  label?: string
}

export function ProgressBar({ percent, label }: Props) {
  const safe = Math.max(0, Math.min(100, percent))
  return (
    <div className="progress-wrap">
      <div className="progress-meta">
        <span>{label ?? 'Progress'}</span>
        <strong>{Math.round(safe)}%</strong>
      </div>
      <div className="progress-track" role="progressbar" aria-valuenow={safe} aria-valuemin={0} aria-valuemax={100}>
        <div className="progress-fill" style={{ width: `${safe}%` }} />
      </div>
    </div>
  )
}
