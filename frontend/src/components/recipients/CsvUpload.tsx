import { useRef, useState } from 'react'
import type { RecipientRow } from '../../types'
import { SAMPLE_CSV, parseRecipientsCsv } from '../../utils/csv'

interface Props {
  onParsed: (rows: RecipientRow[]) => void
}

export function CsvUpload({ onParsed }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState('')

  const handleFile = async (file: File | null) => {
    setError('')
    if (!file) return
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setError('Please upload a .csv file.')
      return
    }
    const text = await file.text()
    const result = parseRecipientsCsv(text)
    if (result.error) {
      setError(result.error)
      return
    }
    onParsed(result.rows)
  }

  const downloadSample = () => {
    const blob = new Blob([SAMPLE_CSV], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'certifyhub-recipients-sample.csv'
    anchor.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="csv-panel">
      <div className="csv-drop" onClick={() => inputRef.current?.click()}>
        <strong>Upload CSV</strong>
        <p>Choose a file with columns: name, email</p>
        <button type="button" className="btn btn-secondary">
          Choose File
        </button>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          hidden
          onChange={(e) => void handleFile(e.target.files?.[0] ?? null)}
        />
      </div>
      <div className="csv-help">
        <p>Expected format:</p>
        <pre>{SAMPLE_CSV.trim()}</pre>
        <button type="button" className="btn-text" onClick={downloadSample}>
          Download sample CSV
        </button>
      </div>
      {error ? <p className="field-error">{error}</p> : null}
    </div>
  )
}
