import { apiRequest, downloadBlob } from './client'
import type { Certificate, Job, Recipient } from '../types'

export function listJobs(): Promise<Job[]> {
  return apiRequest<Job[]>('/api/v1/jobs')
}

export function getJob(jobId: number): Promise<Job> {
  return apiRequest<Job>(`/api/v1/jobs/${jobId}`)
}

export function createJob(templateId: number, recipients: Recipient[]): Promise<Job> {
  return apiRequest<Job>('/api/v1/jobs', {
    method: 'POST',
    body: JSON.stringify({
      template_id: templateId,
      recipients: recipients.map((r) => ({
        name: r.name.trim(),
        email: r.email.trim(),
      })),
    }),
  })
}

export function listJobCertificates(jobId: number): Promise<Certificate[]> {
  return apiRequest<Certificate[]>(`/api/v1/jobs/${jobId}/certificates`)
}

export function downloadAllCertificates(jobId: number): Promise<void> {
  return downloadBlob(`/api/v1/jobs/${jobId}/download-all`, `certifyhub-job-${jobId}.zip`)
}
