/**
 * Parses CSV or JSON data files into an array of row objects.
 * Each row becomes one data-scope iteration in the collection runner.
 */

export type DataRow = Record<string, string>

export interface ParseResult {
  rows: DataRow[]
  error?: string
}

// ---------------------------------------------------------------------------
// CSV
// ---------------------------------------------------------------------------

function parseCSV(content: string): ParseResult {
  const lines = content.split(/\r?\n/).filter(l => l.trim())
  if (lines.length < 2) {
    return { rows: [], error: lines.length === 0 ? 'File is empty' : 'CSV has no data rows (only header)' }
  }

  const headers = splitCSVLine(lines[0]!)
  if (headers.length === 0) return { rows: [], error: 'CSV header row is empty' }

  const rows: DataRow[] = []
  for (let i = 1; i < lines.length; i++) {
    const values = splitCSVLine(lines[i]!)
    const row: DataRow = {}
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]!] = values[j] ?? ''
    }
    rows.push(row)
  }

  return { rows }
}

function splitCSVLine(line: string): string[] {
  const result: string[] = []
  let i = 0
  while (i < line.length) {
    if (line[i] === '"') {
      // Quoted field
      i++
      let field = ''
      while (i < line.length) {
        if (line[i] === '"' && line[i + 1] === '"') {
          field += '"'
          i += 2
        } else if (line[i] === '"') {
          i++
          break
        } else {
          field += line[i]
          i++
        }
      }
      result.push(field.trim())
      if (line[i] === ',') i++ // skip comma
    } else {
      // Unquoted field — read until comma
      const start = i
      while (i < line.length && line[i] !== ',') i++
      result.push(line.slice(start, i).trim())
      if (line[i] === ',') i++ // skip comma
    }
  }
  return result
}

// ---------------------------------------------------------------------------
// JSON
// ---------------------------------------------------------------------------

function parseJSON(content: string): ParseResult {
  let parsed: unknown
  try {
    parsed = JSON.parse(content)
  } catch {
    return { rows: [], error: 'Invalid JSON' }
  }

  if (!Array.isArray(parsed)) {
    return { rows: [], error: 'JSON data must be an array of objects' }
  }

  const rows: DataRow[] = parsed.map(item => {
    if (typeof item !== 'object' || item === null) return {}
    const row: DataRow = {}
    for (const [k, v] of Object.entries(item as Record<string, unknown>)) {
      row[k] = typeof v === 'string' ? v : String(v)
    }
    return row
  })

  return { rows }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export type DataFileType = 'csv' | 'json'

export function detectFileType(filename: string): DataFileType | null {
  const ext = filename.split('.').pop()?.toLowerCase()
  if (ext === 'csv') return 'csv'
  if (ext === 'json') return 'json'
  return null
}

export function parseDataFile(content: string, type: DataFileType): ParseResult {
  if (type === 'csv') return parseCSV(content)
  return parseJSON(content)
}
