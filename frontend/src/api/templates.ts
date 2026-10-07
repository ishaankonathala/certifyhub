import { apiRequest } from './client'
import type { Template, TemplateCreate } from '../types'

export function listTemplates(): Promise<Template[]> {
  return apiRequest<Template[]>('/api/v1/templates')
}

export function getTemplate(id: number): Promise<Template> {
  return apiRequest<Template>(`/api/v1/templates/${id}`)
}

export function createTemplate(payload: TemplateCreate): Promise<Template> {
  return apiRequest<Template>('/api/v1/templates', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}
