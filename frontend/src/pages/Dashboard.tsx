import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { listJobs } from '../api/jobs'
import { listTemplates } from '../api/templates'
import { checkHealth } from '../api/health'
import { LoadingState } from '../components/ui/LoadingState'
import { StatusBadge } from '../components/ui/StatusBadge'
import { formatDate } from '../utils/format'
import type { Job } from '../types'

export function Dashboard() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [templateCount, setTemplateCount] = useState(0)
  const [apiOk, setApiOk] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const [jobList, templates, health] = await Promise.all([
          listJobs(),
          listTemplates(),
          checkHealth().catch(() => null),
        ])
        if (cancelled) return
        setJobs(jobList)
        setTemplateCount(templates.length)
        setApiOk(Boolean(health && health.status === 'ok'))
      } catch {
        if (!cancelled) setApiOk(false)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  if (loading) return <LoadingState label="Loading dashboard…" />

  const completed = jobs.filter((j) => j.status === 'completed' || j.status === 'partial').length
  const recent = jobs.slice(0, 5)

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Welcome</p>
          <h1>CertifyHub</h1>
          <p className="subtitle">Create professional certificates for many people in a few simple steps.</p>
        </div>
        <Link to="/generate" className="btn btn-primary">
          Generate Certificates
        </Link>
      </header>

      <section className="stat-grid">
        <article className="stat-card">
          <span>Total jobs</span>
          <strong>{jobs.length}</strong>
        </article>
        <article className="stat-card">
          <span>Finished jobs</span>
          <strong>{completed}</strong>
        </article>
        <article className="stat-card">
          <span>Templates</span>
          <strong>{templateCount}</strong>
        </article>
        <article className="stat-card">
          <span>API status</span>
          <strong className={apiOk ? 'text-success' : 'text-danger'}>
            {apiOk === null ? 'Checking…' : apiOk ? 'Online' : 'Offline'}
          </strong>
        </article>
      </section>

      <section className="panel">
        <div className="panel-header">
          <h2>Recent jobs</h2>
          <Link to="/jobs" className="btn-text">
            View all
          </Link>
        </div>
        {recent.length === 0 ? (
          <p className="muted">No jobs yet. Start by generating your first batch of certificates.</p>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Job</th>
                  <th>Date</th>
                  <th>Recipients</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {recent.map((job) => (
                  <tr key={job.id}>
                    <td>#{job.id}</td>
                    <td>{formatDate(job.created_at)}</td>
                    <td>{job.total_count}</td>
                    <td>
                      <StatusBadge status={job.status} />
                    </td>
                    <td>
                      <Link to={`/jobs/${job.id}`} className="btn-text">
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
