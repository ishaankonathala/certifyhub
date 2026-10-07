import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { createJob, downloadAllCertificates, getJob, listJobCertificates } from '../api/jobs'
import { createTemplate, listTemplates } from '../api/templates'
import { CertificateRow } from '../components/certificates/CertificateRow'
import { CsvUpload } from '../components/recipients/CsvUpload'
import { RecipientTable } from '../components/recipients/RecipientTable'
import { ErrorMessage } from '../components/ui/ErrorMessage'
import { ProgressBar } from '../components/ui/ProgressBar'
import { StatusBadge } from '../components/ui/StatusBadge'
import type { Certificate, CertificateDetails, Job, RecipientRow, Template } from '../types'
import { createRecipientRow } from '../utils/csv'
import { toUserMessage } from '../utils/errors'
import { slugify } from '../utils/format'

type Step = 'details' | 'recipients' | 'review' | 'progress' | 'done'
type RecipientMode = 'manual' | 'csv'

const TERMINAL = new Set(['completed', 'partial', 'failed'])

export function GenerateCertificates() {
  const navigate = useNavigate()
  const [step, setStep] = useState<Step>('details')
  const [templates, setTemplates] = useState<Template[]>([])
  const [mode, setMode] = useState<RecipientMode>('manual')
  const [rows, setRows] = useState<RecipientRow[]>([createRecipientRow()])
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [job, setJob] = useState<Job | null>(null)
  const [certificates, setCertificates] = useState<Certificate[]>([])
  const [zipBusy, setZipBusy] = useState(false)

  const [details, setDetails] = useState<CertificateDetails>({
    eventName: '',
    courseName: 'Certificate of Completion',
    issuerName: '',
    date: new Date().toISOString().slice(0, 10),
    description: 'has successfully completed the program.',
    templateId: null,
  })

  useEffect(() => {
    void listTemplates()
      .then((items) => {
        setTemplates(items)
        if (items.length > 0) {
          setDetails((prev) => ({
            ...prev,
            templateId: prev.templateId ?? items[0].id,
            eventName: prev.eventName || items[0].name,
            courseName: prev.courseName || items[0].title,
            issuerName: prev.issuerName || items[0].issuer_name,
            description: prev.description || items[0].body_text,
          }))
        }
      })
      .catch(() => undefined)
  }, [])

  const validRows = useMemo(() => rows.filter((r) => r.valid && r.name && r.email), [rows])
  const invalidRows = useMemo(() => rows.filter((r) => !r.valid), [rows])

  useEffect(() => {
    if (!job || step !== 'progress') return undefined

    let cancelled = false
    const poll = async () => {
      try {
        const latest = await getJob(job.id)
        if (cancelled) return
        setJob(latest)
        if (TERMINAL.has(latest.status)) {
          const certs = await listJobCertificates(latest.id)
          if (cancelled) return
          setCertificates(certs)
          setStep('done')
        }
      } catch (err) {
        if (!cancelled) setError(toUserMessage(err))
      }
    }

    void poll()
    const timer = window.setInterval(() => void poll(), 1500)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [job, step])

  const updateDetail = <K extends keyof CertificateDetails>(key: K, value: CertificateDetails[K]) => {
    setDetails((prev) => ({ ...prev, [key]: value }))
  }

  const validateDetails = (): boolean => {
    if (!details.eventName.trim() || !details.courseName.trim() || !details.issuerName.trim()) {
      setError('Please fill in the certificate name, course/event title, and issuing organization.')
      return false
    }
    if (!details.description.trim()) {
      setError('Please add a short certificate description or achievement.')
      return false
    }
    setError('')
    return true
  }

  const goRecipients = () => {
    if (!validateDetails()) return
    setStep('recipients')
  }

  const goReview = () => {
    if (rows.length === 0) {
      setError('Add at least one recipient before continuing.')
      return
    }
    if (validRows.length === 0) {
      setError('None of the recipients look valid yet. Please fix the highlighted rows.')
      return
    }
    if (invalidRows.length > 0) {
      setError(
        `${invalidRows.length} recipient${invalidRows.length === 1 ? '' : 's'} could not be processed. Please review the highlighted rows.`,
      )
      return
    }
    setError('')
    setStep('review')
  }

  const resolveTemplateId = async (): Promise<number> => {
    if (details.templateId) {
      const selected = templates.find((t) => t.id === details.templateId)
      if (
        selected &&
        selected.title === details.courseName.trim() &&
        selected.issuer_name === details.issuerName.trim() &&
        selected.body_text === buildBody()
      ) {
        return selected.id
      }
    }

    const created = await createTemplate({
      name: `${slugify(details.eventName)}-${Date.now().toString(36)}`,
      title: details.courseName.trim(),
      body_text: buildBody(),
      issuer_name: details.issuerName.trim(),
    })
    setTemplates((prev) => [created, ...prev])
    setDetails((prev) => ({ ...prev, templateId: created.id }))
    return created.id
  }

  const buildBody = () => {
    const base = details.description.trim()
    if (!details.date) return base
    return `${base} (Issued: ${details.date})`
  }

  const onGenerate = async () => {
    setSubmitting(true)
    setError('')
    try {
      const templateId = await resolveTemplateId()
      const created = await createJob(
        templateId,
        validRows.map((r) => ({ name: r.name, email: r.email })),
      )
      setJob(created)
      setStep('progress')
    } catch (err) {
      setError(toUserMessage(err, 'Could not start certificate generation.'))
    } finally {
      setSubmitting(false)
    }
  }

  const onDownloadAll = async () => {
    if (!job) return
    setZipBusy(true)
    setError('')
    try {
      await downloadAllCertificates(job.id)
    } catch (err) {
      setError(toUserMessage(err, 'Could not download the ZIP file.'))
    } finally {
      setZipBusy(false)
    }
  }

  const remaining = job
    ? Math.max(0, job.total_count - job.completed_count - job.failed_count)
    : 0

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Workflow</p>
          <h1>Generate Certificates</h1>
          <p className="subtitle">Fill in the details, add recipients, then generate PDFs in one click.</p>
        </div>
      </header>

      <ol className="stepper">
        {[
          ['details', '1. Details'],
          ['recipients', '2. Recipients'],
          ['review', '3. Review'],
          ['progress', '4. Generate'],
        ].map(([key, label]) => (
          <li key={key} className={step === key || (step === 'done' && key === 'progress') ? 'active' : ''}>
            {label}
          </li>
        ))}
      </ol>

      <ErrorMessage message={error} onDismiss={() => setError('')} />

      {step === 'details' ? (
        <section className="panel form-panel">
          <h2>Certificate details</h2>
          <div className="form-grid">
            <label>
              Certificate / Event Name
              <input
                value={details.eventName}
                onChange={(e) => updateDetail('eventName', e.target.value)}
                placeholder="AI Workshop 2026"
              />
            </label>
            <label>
              Course / Event Title
              <input
                value={details.courseName}
                onChange={(e) => updateDetail('courseName', e.target.value)}
                placeholder="Certificate of Completion"
              />
            </label>
            <label>
              Issuing Organization
              <input
                value={details.issuerName}
                onChange={(e) => updateDetail('issuerName', e.target.value)}
                placeholder="CertifyHub Academy"
              />
            </label>
            <label>
              Date
              <input
                type="date"
                value={details.date}
                onChange={(e) => updateDetail('date', e.target.value)}
              />
            </label>
            <label className="full">
              Certificate Description / Achievement
              <textarea
                rows={3}
                value={details.description}
                onChange={(e) => updateDetail('description', e.target.value)}
                placeholder="has successfully completed the AI Workshop."
              />
            </label>
            <label className="full">
              Template
              <select
                value={details.templateId ?? ''}
                onChange={(e) => {
                  const id = e.target.value ? Number(e.target.value) : null
                  updateDetail('templateId', id)
                  const selected = templates.find((t) => t.id === id)
                  if (selected) {
                    setDetails((prev) => ({
                      ...prev,
                      templateId: selected.id,
                      courseName: selected.title,
                      issuerName: selected.issuer_name,
                      description: selected.body_text,
                      eventName: prev.eventName || selected.name,
                    }))
                  }
                }}
              >
                <option value="">Create new from details above</option>
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name} — {template.title}
                  </option>
                ))}
              </select>
              <span className="help-text">
                Leave as “Create new” to save these details as a template, or reuse an existing one.
              </span>
            </label>
          </div>
          <div className="form-actions">
            <button type="button" className="btn btn-primary" onClick={goRecipients}>
              Continue to Recipients
            </button>
          </div>
        </section>
      ) : null}

      {step === 'recipients' ? (
        <section className="panel">
          <div className="panel-header">
            <h2>Add recipients</h2>
            <div className="segmented">
              <button
                type="button"
                className={mode === 'manual' ? 'active' : ''}
                onClick={() => setMode('manual')}
              >
                Add Manually
              </button>
              <button type="button" className={mode === 'csv' ? 'active' : ''} onClick={() => setMode('csv')}>
                Upload CSV
              </button>
            </div>
          </div>

          {mode === 'csv' ? (
            <CsvUpload
              onParsed={(parsed) => {
                setRows(parsed)
                setMode('manual')
                setError(
                  parsed.some((r) => !r.valid)
                    ? `${parsed.filter((r) => !r.valid).length} recipients need fixes. Review the highlighted rows.`
                    : '',
                )
              }}
            />
          ) : null}

          <RecipientTable rows={rows} onChange={setRows} />

          <div className="form-actions">
            <button type="button" className="btn btn-secondary" onClick={() => setStep('details')}>
              Back
            </button>
            <button type="button" className="btn btn-primary" onClick={goReview}>
              Continue to Review
            </button>
          </div>
        </section>
      ) : null}

      {step === 'review' ? (
        <section className="panel">
          <h2>Review before generating</h2>
          <div className="review-grid">
            <article>
              <span>Certificate</span>
              <strong>{details.eventName || details.courseName}</strong>
            </article>
            <article>
              <span>Recipients</span>
              <strong>{rows.length}</strong>
            </article>
            <article>
              <span>Valid</span>
              <strong className="text-success">{validRows.length}</strong>
            </article>
            <article>
              <span>Invalid</span>
              <strong className={invalidRows.length ? 'text-danger' : ''}>{invalidRows.length}</strong>
            </article>
          </div>
          <p className="muted">
            Organization: {details.issuerName} · Course: {details.courseName}
          </p>
          <div className="form-actions">
            <button type="button" className="btn btn-secondary" onClick={() => setStep('recipients')}>
              Back
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={submitting || validRows.length === 0}
              onClick={() => void onGenerate()}
            >
              {submitting ? 'Starting…' : 'Generate Certificates'}
            </button>
          </div>
        </section>
      ) : null}

      {step === 'progress' && job ? (
        <section className="panel center-panel">
          <h2>Generating certificates…</h2>
          <ProgressBar percent={job.progress_percent ?? 0} label="Overall progress" />
          <p className="progress-count">
            {job.completed_count + job.failed_count} / {job.total_count} completed
          </p>
          <div className="review-grid compact">
            <article>
              <span>Successful</span>
              <strong>{job.completed_count}</strong>
            </article>
            <article>
              <span>Failed</span>
              <strong>{job.failed_count}</strong>
            </article>
            <article>
              <span>Remaining</span>
              <strong>{remaining}</strong>
            </article>
            <article>
              <span>Status</span>
              <StatusBadge status={job.status} />
            </article>
          </div>
        </section>
      ) : null}

      {step === 'done' && job ? (
        <section className="panel">
          <div className="success-banner">
            <h2>Generation complete</h2>
            <p>
              Total: {job.total_count} · Successful: {job.completed_count} · Failed: {job.failed_count}
            </p>
          </div>
          <div className="form-actions">
            <button
              type="button"
              className="btn btn-primary"
              disabled={zipBusy || job.completed_count === 0}
              onClick={() => void onDownloadAll()}
            >
              {zipBusy ? 'Preparing ZIP…' : 'Download All'}
            </button>
            <Link to={`/jobs/${job.id}`} className="btn btn-secondary">
              Open Job Details
            </Link>
            <button
              type="button"
              className="btn-text"
              onClick={() => {
                setStep('details')
                setJob(null)
                setCertificates([])
                setRows([createRecipientRow()])
              }}
            >
              Start another batch
            </button>
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Recipient</th>
                  <th>Status</th>
                  <th>Certificate</th>
                </tr>
              </thead>
              <tbody>
                {certificates.map((cert) => (
                  <CertificateRow key={cert.id} certificate={cert} />
                ))}
              </tbody>
            </table>
          </div>
          <button type="button" className="btn-text" onClick={() => navigate('/jobs')}>
            View all jobs
          </button>
        </section>
      ) : null}
    </div>
  )
}
