interface Props {
  message: string
  onDismiss?: () => void
}

export function ErrorMessage({ message, onDismiss }: Props) {
  if (!message) return null
  return (
    <div className="alert alert-error" role="alert">
      <div>
        <strong>Something needs attention</strong>
        <p>{message}</p>
      </div>
      {onDismiss ? (
        <button type="button" className="btn-text" onClick={onDismiss}>
          Dismiss
        </button>
      ) : null}
    </div>
  )
}
