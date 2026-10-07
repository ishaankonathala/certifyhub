import { ApiError } from '../api/client'

export function toUserMessage(error: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (error instanceof ApiError) {
    if (error.status === 0 || error.message.includes('Failed to fetch')) {
      return 'Unable to reach CertifyHub. Make sure the API server is running.'
    }
    if (error.status === 404) {
      return error.message || 'We could not find what you were looking for.'
    }
    if (error.status === 409) {
      return error.message || 'This action conflicts with the current state.'
    }
    if (error.status === 422) {
      return formatValidationDetail(error.detail) ?? 'Please check the form fields and try again.'
    }
    if (error.status >= 500) {
      return 'The server ran into a problem. Please try again in a moment.'
    }
    return error.message || fallback
  }

  if (error instanceof TypeError && error.message.includes('fetch')) {
    return 'Unable to reach CertifyHub. Make sure the API server is running.'
  }

  if (error instanceof Error && error.message) {
    return error.message
  }

  return fallback
}

function formatValidationDetail(detail: unknown): string | null {
  if (typeof detail === 'object' && detail !== null && 'detail' in detail) {
    const inner = (detail as { detail: unknown }).detail
    if (typeof inner === 'string') return inner
    if (Array.isArray(inner) && inner.length > 0) {
      const first = inner[0] as { msg?: string; loc?: unknown[] }
      if (first.msg) {
        return first.msg
      }
    }
  }
  return null
}
