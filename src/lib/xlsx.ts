import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate'

/**
 * Lector/escritor mínimo de Excel (.xlsx) sin librerías pesadas:
 * un .xlsx es un zip con XML dentro. También acepta CSV/TSV.
 */

export type Cell = string | number | null
export type Rows = Cell[][]

const decode = (s: string) =>
  s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&amp;/g, '&')

const encode = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** "AB12" → 27 (índice de columna desde 0) */
const colIndex = (ref: string) => {
  const letters = ref.replace(/\d+/g, '')
  let n = 0
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64)
  return n - 1
}

const allText = (xml: string) => [...xml.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((m) => decode(m[1])).join('')

function readXlsx(bytes: Uint8Array): Rows {
  const files = unzipSync(bytes)
  const shared = files['xl/sharedStrings.xml'] ? [...strFromU8(files['xl/sharedStrings.xml']).matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => allText(m[1])) : []
  const sheetPath = Object.keys(files).filter((k) => /^xl\/worksheets\/sheet\d*\.xml$/.test(k)).sort()[0]
  if (!sheetPath) throw new Error('El Excel no tiene hojas.')
  const xml = strFromU8(files[sheetPath])
  const rows: Rows = []
  for (const rm of xml.matchAll(/<row[^>]*?(?:\/>|>([\s\S]*?)<\/row>)/g)) {
    const row: Cell[] = []
    for (const cm of (rm[1] ?? '').matchAll(/<c\s([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = cm[1]
      const inner = cm[2] ?? ''
      const ref = /r="([A-Z]+\d+)"/.exec(attrs)?.[1]
      const type = /t="(\w+)"/.exec(attrs)?.[1]
      const v = /<v>([\s\S]*?)<\/v>/.exec(inner)?.[1]
      let value: Cell = null
      if (type === 's' && v !== undefined) value = shared[Number(v)] ?? ''
      else if (type === 'inlineStr') value = allText(inner)
      else if (type === 'str' || type === 'b' || type === 'e') value = v !== undefined ? decode(v) : null
      else if (v !== undefined) value = Number(v)
      row[ref ? colIndex(ref) : row.length] = value
    }
    rows.push(Array.from(row, (c) => c ?? null))
  }
  return rows
}

/** Texto con columnas (CSV, o celdas copiadas de Excel/Numbers/Sheets, que llegan separadas por tabuladores) */
export function readDelimited(text: string): Rows {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim())
  const sep = [';', '\t', ','].sort((a, b) => (lines[0]?.split(b).length ?? 0) - (lines[0]?.split(a).length ?? 0))[0]
  return lines.map((l) => {
    const out: string[] = []
    let cur = ''
    let q = false
    for (let i = 0; i < l.length; i++) {
      const ch = l[i]
      if (ch === '"') {
        if (q && l[i + 1] === '"') {
          cur += '"'
          i++
        } else q = !q
      } else if (ch === sep && !q) {
        out.push(cur)
        cur = ''
      } else cur += ch
    }
    out.push(cur)
    return out.map((c) => c.trim())
  })
}

/** Lee la primera hoja de un .xlsx o un CSV/TSV */
export function readSpreadsheet(buf: ArrayBuffer): Rows {
  const bytes = new Uint8Array(buf)
  // Los .xlsx empiezan por "PK" (zip)
  if (bytes[0] === 0x50 && bytes[1] === 0x4b) return readXlsx(bytes)
  return readDelimited(new TextDecoder('utf-8').decode(bytes))
}

/** Crea un .xlsx con una hoja. La primera fila va en negrita y con filtro. */
export function writeXlsx(rows: Rows, sheetName = 'Movimientos'): Uint8Array {
  const letter = (i: number) => {
    let s = ''
    for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s
    return s
  }
  const sheetRows = rows
    .map((r, ri) => {
      const cells = r
        .map((c, ci) => {
          const ref = `${letter(ci)}${ri + 1}`
          const style = ri === 0 ? ' s="1"' : typeof c === 'number' ? ' s="2"' : ''
          if (c === null || c === undefined || c === '') return ''
          if (typeof c === 'number') return `<c r="${ref}"${style}><v>${c}</v></c>`
          return `<c r="${ref}" t="inlineStr"${style}><is><t xml:space="preserve">${encode(String(c))}</t></is></c>`
        })
        .join('')
      return `<row r="${ri + 1}">${cells}</row>`
    })
    .join('')
  const cols = rows[0]?.length ?? 1
  const widths = Array.from({ length: cols }, (_, i) => {
    const max = Math.min(60, Math.max(8, ...rows.slice(0, 300).map((r) => String(r[i] ?? '').length + 2)))
    return `<col min="${i + 1}" max="${i + 1}" width="${max}" customWidth="1"/>`
  }).join('')
  const lastRef = `${letter(cols - 1)}${Math.max(1, rows.length)}`
  const sheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${widths}</cols><sheetData>${sheetRows}</sheetData><autoFilter ref="A1:${lastRef}"/></worksheet>`
  const files = {
    '[Content_Types].xml': strToU8(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>',
    ),
    '_rels/.rels': strToU8(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
    ),
    'xl/workbook.xml': strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${encode(sheetName)}" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    ),
    'xl/_rels/workbook.xml.rels': strToU8(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>',
    ),
    'xl/styles.xml': strToU8(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="1"><numFmt numFmtId="164" formatCode="#,##0.00 &quot;€&quot;"/></numFmts><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="3"><xf/><xf fontId="1" applyFont="1"/><xf numFmtId="164" applyNumberFormat="1"/></cellXfs></styleSheet>',
    ),
    'xl/worksheets/sheet1.xml': strToU8(sheet),
  }
  return zipSync(files)
}
