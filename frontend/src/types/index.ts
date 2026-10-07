export interface Template {
  id: number
  name: string
  title: string
  body_text: string
  issuer_name: string
  created_at: string
}

export interface TemplateCreate {
  name: string
  title: string
  body_text: string
  issuer_name: string
}

export interface Recipient {
  name: string
  email: string
  notes?: string
}

export interface RecipientRow extends Recipient {
  id: string
  valid: boolean
  error?: string
}

export interface Job {
  id: number
  template_id: number
  status: string
  total_count: number
  completed_count: number
  failed_count: number
  progress_percent?: number
  created_at: string
  updated_at?: string
  message?: string
}

export interface Certificate {
  id: number
  job_id: number
  recipient_name: string
  recipient_email: string
  certificate_code: string
  status: string
  error_message: string | null
  created_at: string
  completed_at: string | null
  download_url: string | null
}

export interface CertificateDetails {
  eventName: string
  courseName: string
  issuerName: string
  date: string
  description: string
  templateId: number | null
}
