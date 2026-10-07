export function formatDate(value?: string | null): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatStatus(status: string): string {
  const map: Record<string, string> = {
    pending: 'Queued',
    processing: 'Processing',
    completed: 'Completed',
    partial: 'Partially completed',
    failed: 'Failed',
  }
  return map[status] ?? status
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'certificate'
}
