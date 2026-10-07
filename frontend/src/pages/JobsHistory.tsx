import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { listJobs } from '../api/jobs'
import { EmptyState } from '../components/ui/EmptyState'
import { ErrorMessage } from '../components/ui/ErrorMessage'
import { LoadingState } from '../components/ui/LoadingState'
import { StatusBadge } from '../components/ui/StatusBadge'
import type { Job } from '../types'
import { toUserMessage } from '../utils/errors'
import { formatDate } from '../utils/format'

export function JobsHistory() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const data = await listJobs()
        if (!cancelled) setJobs(data)
      } catch (err) {
        if (!cancelled) setError(toUserMessage(err))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  if (loading) return <LoadingState label="Loading jobs…" />

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">History</p>
          <h1>Jobs</h1>
          <p className="subtitle">Review previous certificate generation runs and reopen their results.</p>
        </div>
        <Link to="/generate" className="btn btn-primary">
          New Batch
        </Link>
      </header>

      <ErrorMessage message={error} onDismiss={() => setError('')} />

      {jobs.length === 0 ? (
        <EmptyState
          title="No jobs yet"
          description="When you generate certificates, they will appear here."
          action={
            <Link to="/generate" className="btn btn-primary">
              Generate Certificates
            </Link>
          }
        />
      ) : (
        <section className="panel">
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Job ID</th>
                  <th>Date</th>
                  <th>Recipients</th>
                  <th>Successful</th>
                  <th>Failed</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {jobs.map((job) => (
                  <tr key={job.id}>
                    <td>#{job.id}</td>
                    <td>{formatDate(job.created_at)}</td>
                    <td>{job.total_count}</td>
                    <td>{job.completed_count}</td>
                    <td>{job.failed_count}</td>
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
        </section>
      )}
    </div>
  )
}
