import { apiRequest } from './client'

export function checkHealth(): Promise<{ status: string; service: string }> {
  return apiRequest('/health')
}
