import type { RecipientRow } from '../../types'
import { createRecipientRow } from '../../utils/csv'

interface Props {
  rows: RecipientRow[]
  onChange: (rows: RecipientRow[]) => void
}

export function RecipientTable({ rows, onChange }: Props) {
  const updateRow = (id: string, field: 'name' | 'email' | 'notes', value: string) => {
    onChange(
      rows.map((row) => {
        if (row.id !== id) return row
        const next = { ...row, [field]: value }
        return createRecipientRow(next.name, next.email, next.notes ?? '')
      }),
    )
  }

  const removeRow = (id: string) => {
    onChange(rows.filter((row) => row.id !== id))
  }

  const addRow = () => {
    onChange([...rows, createRecipientRow()])
  }

  return (
    <div className="table-card">
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Additional Information</th>
              <th aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="muted-cell">
                  No recipients yet. Add people manually or upload a CSV.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className={row.valid ? undefined : 'row-invalid'}>
                  <td>
                    <input
                      value={row.name}
                      onChange={(e) => updateRow(row.id, 'name', e.target.value)}
                      placeholder="Full name"
                      aria-label="Recipient name"
                    />
                    {!row.valid && row.error ? <span className="field-error">{row.error}</span> : null}
                  </td>
                  <td>
                    <input
                      value={row.email}
                      onChange={(e) => updateRow(row.id, 'email', e.target.value)}
                      placeholder="name@example.com"
                      aria-label="Recipient email"
                    />
                  </td>
                  <td>
                    <input
                      value={row.notes ?? ''}
                      onChange={(e) => updateRow(row.id, 'notes', e.target.value)}
                      placeholder="Optional notes"
                      aria-label="Additional information"
                    />
                  </td>
                  <td>
                    <button type="button" className="btn-text danger" onClick={() => removeRow(row.id)}>
                      Remove
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <div className="table-actions">
        <button type="button" className="btn btn-secondary" onClick={addRow}>
          + Add Recipient
        </button>
        <span className="muted">
          {rows.filter((r) => r.valid).length} valid · {rows.filter((r) => !r.valid).length} need fixes
        </span>
      </div>
    </div>
  )
}
