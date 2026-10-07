import { formatStatus } from '../../utils/format'

const TONE: Record<string, string> = {
  pending: 'badge badge-muted',
  processing: 'badge badge-info',
  completed: 'badge badge-success',
  partial: 'badge badge-warning',
  failed: 'badge badge-danger',
  success: 'badge badge-success',
}

interface Props {
  status: string
}

export function StatusBadge({ status }: Props) {
  const className = TONE[status] ?? 'badge badge-muted'
  return <span className={className}>{formatStatus(status)}</span>
}
