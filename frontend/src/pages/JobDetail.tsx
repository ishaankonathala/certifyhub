import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { downloadAllCertificates, getJob, listJobCertificates } from '../api/jobs'
import { CertificateRow } from '../components/certificates/CertificateRow'
import { ErrorMessage } from '../components/ui/ErrorMessage'
import { LoadingState } from '../components/ui/LoadingState'
import { ProgressBar } from '../components/ui/ProgressBar'
import { StatusBadge } from '../components/ui/StatusBadge'
import type { Certificate, Job } from '../types'
import { toUserMessage } from '../utils/errors'
import { formatDate } from '../utils/format'

export function JobDetail() {
  const { jobId } = useParams()
  const [job, setJob] = useState<Job | null>(null)
  const [certificates, setCertificates] = useState<Certificate[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [zipBusy, setZipBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!jobId) return
      setLoading(true)
      try {
        const id = Number(jobId)
        const [jobData, certs] = await Promise.all([getJob(id), listJobCertificates(id)])
        if (cancelled) return
        setJob(jobData)
        setCertificates(certs)
      } catch (err) {
        if (!cancelled) setError(toUserMessage(err, 'This job could not be found.'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [jobId])

  if (loading) return <LoadingState label="Loading job…" />
  if (!job) {
    return (
      <div className="page">
        <ErrorMessage message={error || 'Job not found.'} />
        <Link to="/jobs" className="btn btn-secondary">
          Back to jobs
        </Link>
      </div>
    )
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Job #{job.id}</p>
          <h1>Job details</h1>
          <p className="subtitle">Created {formatDate(job.created_at)}</p>
        </div>
        <div className="header-actions">
          <StatusBadge status={job.status} />
          <button
            type="button"
            className="btn btn-primary"
            disabled={zipBusy || job.completed_count === 0}
            onClick={() => {
              setZipBusy(true)
              void downloadAllCertificates(job.id)
                .catch((err) => setError(toUserMessage(err)))
                .finally(() => setZipBusy(false))
            }}
          >
            {zipBusy ? 'Preparing ZIP…' : 'Download All'}
          </button>
        </div>
      </header>

      <ErrorMessage message={error} onDismiss={() => setError('')} />

      <section className="panel">
        <ProgressBar percent={job.progress_percent ?? 0} />
        <div className="review-grid compact">
          <article>
            <span>Recipients</span>
            <strong>{job.total_count}</strong>
          </article>
          <article>
            <span>Successful</span>
            <strong>{job.completed_count}</strong>
          </article>
          <article>
            <span>Failed</span>
            <strong>{job.failed_count}</strong>
          </article>
          <article>
            <span>Updated</span>
            <strong>{formatDate(job.updated_at)}</strong>
          </article>
        </div>
      </section>

      <section className="panel">
        <h2>Certificates</h2>
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
      </section>
    </div>
  )
}
