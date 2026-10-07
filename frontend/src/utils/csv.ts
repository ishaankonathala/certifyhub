import type { RecipientRow } from '../types'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function createRecipientRow(
  name = '',
  email = '',
  notes = '',
): RecipientRow {
  const trimmedName = name.trim()
  const trimmedEmail = email.trim()
  let valid = true
  let error: string | undefined

  if (!trimmedName) {
    valid = false
    error = 'Name is required'
  } else if (!trimmedEmail) {
    valid = false
    error = 'Email is required'
  } else if (!EMAIL_RE.test(trimmedEmail)) {
    valid = false
    error = 'Enter a valid email address'
  }

  return {
    id: crypto.randomUUID(),
    name: trimmedName,
    email: trimmedEmail,
    notes: notes.trim(),
    valid,
    error,
  }
}

export function validateRecipientRow(row: RecipientRow): RecipientRow {
  return createRecipientRow(row.name, row.email, row.notes ?? '')
}

export function parseRecipientsCsv(text: string): { rows: RecipientRow[]; error?: string } {
  const lines = text
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)

  if (lines.length === 0) {
    return { rows: [], error: 'The CSV file is empty.' }
  }

  const header = lines[0].toLowerCase()
  const hasHeader = header.includes('name') && header.includes('email')
  const dataLines = hasHeader ? lines.slice(1) : lines

  if (dataLines.length === 0) {
    return { rows: [], error: 'No recipient rows found in the CSV.' }
  }

  const rows = dataLines.map((line) => {
    const parts = splitCsvLine(line)
    const name = parts[0] ?? ''
    const email = parts[1] ?? ''
    const notes = parts[2] ?? ''
    return createRecipientRow(name, email, notes)
  })

  return { rows }
}

function splitCsvLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i]
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i += 1
      } else {
        inQuotes = !inQuotes
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current)
      current = ''
    } else {
      current += char
    }
  }
  result.push(current)
  return result.map((part) => part.trim())
}

export const SAMPLE_CSV = `name,email
Ishaan Karthikeya,ishaan@example.com
Rahul Sharma,rahul@example.com
Priya Reddy,priya@example.com
`
