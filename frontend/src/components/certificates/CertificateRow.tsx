import { useState } from 'react'
import type { Certificate } from '../../types'
import { downloadCertificate } from '../../api/certificates'
import { toUserMessage } from '../../utils/errors'
import { StatusBadge } from '../ui/StatusBadge'

interface Props {
  certificate: Certificate
}

export function CertificateRow({ certificate }: Props) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [showError, setShowError] = useState(false)

  const onDownload = async () => {
    setBusy(true)
    setError('')
    try {
      await downloadCertificate(
        certificate.id,
        `${certificate.certificate_code}.pdf`,
      )
    } catch (err) {
      setError(toUserMessage(err, 'Could not download this certificate.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <tr>
      <td>
        <div className="stack-tight">
          <strong>{certificate.recipient_name}</strong>
          <span className="muted">{certificate.recipient_email}</span>
        </div>
      </td>
      <td>
        {certificate.status === 'completed' ? (
          <StatusBadge status="completed" />
        ) : certificate.status === 'failed' ? (
          <StatusBadge status="failed" />
        ) : (
          <StatusBadge status={certificate.status} />
        )}
      </td>
      <td>
        {certificate.status === 'completed' ? (
          <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={() => void onDownload()}>
            {busy ? 'Downloading…' : 'Download'}
          </button>
        ) : certificate.status === 'failed' ? (
          <button type="button" className="btn-text" onClick={() => setShowError((v) => !v)}>
            {showError ? 'Hide Error' : 'View Error'}
          </button>
        ) : (
          <span className="muted">Pending</span>
        )}
        {showError && certificate.error_message ? (
          <p className="field-error">{certificate.error_message}</p>
        ) : null}
        {error ? <p className="field-error">{error}</p> : null}
      </td>
    </tr>
  )
}
