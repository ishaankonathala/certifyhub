import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { listTemplates } from '../api/templates'
import { EmptyState } from '../components/ui/EmptyState'
import { ErrorMessage } from '../components/ui/ErrorMessage'
import { LoadingState } from '../components/ui/LoadingState'
import type { Template } from '../types'
import { toUserMessage } from '../utils/errors'
import { formatDate } from '../utils/format'

export function Templates() {
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const data = await listTemplates()
        if (!cancelled) setTemplates(data)
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

  if (loading) return <LoadingState label="Loading templates…" />

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Design</p>
          <h1>Templates</h1>
          <p className="subtitle">
            CertifyHub uses a clean predefined certificate layout. Create or reuse templates when you generate.
          </p>
        </div>
        <Link to="/generate" className="btn btn-primary">
          Use in Generator
        </Link>
      </header>

      <ErrorMessage message={error} onDismiss={() => setError('')} />

      <section className="panel preview-panel">
        <div className="template-preview" aria-hidden>
          <p className="preview-issuer">YOUR ORGANIZATION</p>
          <h2>Certificate of Completion</h2>
          <p>This is to certify that</p>
          <p className="preview-name">Recipient Name</p>
          <p>has successfully completed the program.</p>
        </div>
        <div>
          <h3>Default Certificate</h3>
          <p className="muted">Status: Active</p>
          <p>
            Landscape PDF with organization name, title, recipient name, achievement text, issue date, and unique
            certificate ID.
          </p>
        </div>
      </section>

      {templates.length === 0 ? (
        <EmptyState
          title="No saved templates yet"
          description="Templates are created automatically when you generate certificates with new details."
          action={
            <Link to="/generate" className="btn btn-secondary">
              Generate Certificates
            </Link>
          }
        />
      ) : (
        <section className="panel">
          <h2>Saved templates</h2>
          <div className="template-grid">
            {templates.map((template) => (
              <article key={template.id} className="template-card">
                <div className="badge badge-success">Active</div>
                <h3>{template.name}</h3>
                <p>
                  <strong>{template.title}</strong>
                </p>
                <p className="muted">{template.issuer_name}</p>
                <p>{template.body_text}</p>
                <p className="muted">Created {formatDate(template.created_at)}</p>
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
