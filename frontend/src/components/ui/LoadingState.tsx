interface Props {
  label?: string
}

export function LoadingState({ label = 'Loading…' }: Props) {
  return (
    <div className="loading-state">
      <div className="spinner" aria-hidden />
      <p>{label}</p>
    </div>
  )
}
