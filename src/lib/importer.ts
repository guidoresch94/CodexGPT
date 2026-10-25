import type { Category, DateStr, ID, Transaction } from '../types'
import { daysBetween } from './dates'
import { round2 } from './format'
import type { Rows } from './xlsx'

/**
 * Importación de extractos (BBVA y similares) con clasificación en 3 capas:
 * 1. Reglas que aprendiste (comercio → categoría), la más fiable.
 * 2. Diccionario de comercios y palabras clave conocidas.
 * 3. Pistas (Bizum con concepto, "bar", "cafe"…) → sugerencia a confirmar.
 */

export interface BankRow {
  date: DateStr
  /** Concepto principal (ej. "Lidl c casanova", "Bizum") */
  concept: string
  /** Detalle (ej. "Pago con tarjeta", "ENVIADO: padel", "N 2026… Basic-Fit…") */
  detail: string
  amount: number
}

export type Bucket =
  | 'super'
  | 'restaurantes'
  | 'cafe'
  | 'delivery'
  | 'tabaco'
  | 'transporte'
  | 'deporte'
  | 'suscripciones'
  | 'salud'
  | 'ropa'
  | 'compras'
  | 'casa'
  | 'viajes'
  | 'ocio'
  | 'suministros'
  | 'alquiler'
  | 'efectivo'
  | 'nomina'
  | 'ingreso'

export type Confidence = 'regla' | 'conocido' | 'pista' | 'nada'

export interface Classified {
  row: BankRow
  key: string
  label: string
  kind: Transaction['kind']
  refund: boolean
  categoryId?: ID
  ignore: boolean
  confidence: Confidence
  hash: string
  /** Gasto que ya cargaste a mano y parece el mismo */
  duplicateOf?: Transaction
  /** Domiciliación (cuotas): no cuenta como sesión de hábito */
  isDebit: boolean
}

// ── Lectura del Excel ───────────────────────────────────────────────────

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()

function toISODate(v: unknown): DateStr | undefined {
  if (typeof v === 'number' && v > 20000 && v < 80000) {
    // Fecha serial de Excel
    const d = new Date(Math.round((v - 25569) * 864e5))
    return d.toISOString().slice(0, 10)
  }
  const m = /(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/.exec(String(v ?? ''))
  if (!m) return /^\d{4}-\d{2}-\d{2}/.test(String(v)) ? String(v).slice(0, 10) : undefined
  const y = m[3].length === 2 ? `20${m[3]}` : m[3]
  return `${y}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
}

function toAmount(v: unknown): number | undefined {
  if (typeof v === 'number') return v
  const s = String(v ?? '').replace(/[€\s]/g, '').replace('−', '-')
  if (!s) return undefined
  const n = Number(s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s)
  return Number.isFinite(n) ? n : undefined
}

/** Busca la fila de cabecera (Fecha / Concepto / Importe…) y devuelve los movimientos */
export function parseBankRows(rows: Rows): BankRow[] {
  const headerIdx = rows.findIndex((r) => {
    const t = r.map((c) => norm(String(c ?? '')))
    return t.some((c) => c === 'importe' || c === 'cantidad') && t.some((c) => c.startsWith('concepto') || c.startsWith('descrip'))
  })
  if (headerIdx < 0) return guessRows(rows)
  const h = rows[headerIdx].map((c) => norm(String(c ?? '')))
  const col = (...names: string[]) => h.findIndex((c) => names.some((n) => c === n || c.startsWith(n)))
  const iDate = col('fecha valor', 'fecha operacion', 'fecha')
  const iDate2 = col('fecha')
  const iConcept = col('concepto', 'descripcion')
  const iDetail = col('movimiento', 'detalle')
  const iObs = col('observaciones', 'mas datos')
  const iAmount = col('importe', 'cantidad')
  const out: BankRow[] = []
  for (const r of rows.slice(headerIdx + 1)) {
    const date = toISODate(r[iDate]) ?? toISODate(r[iDate2])
    const amount = toAmount(r[iAmount])
    const concept = String(r[iConcept] ?? '').trim()
    if (!date || amount === undefined || amount === 0 || !concept) continue
    const detail = [r[iDetail], r[iObs]].filter((x) => x && String(x).trim()).join(' · ')
    out.push({ date, concept, detail, amount: round2(amount) })
  }
  return out
}

/**
 * Sin cabecera (copiaste solo unas filas): adivina las columnas por su contenido.
 * Fecha = celda con dd/mm/aaaa; importe = número con signo o decimales; concepto = el primer texto.
 */
function guessRows(rows: Rows): BankRow[] {
  const out: BankRow[] = []
  for (const r of rows) {
    const cells = r.map((c) => (c === null ? '' : c))
    const iDate = cells.findIndex((c) => !!toISODate(c) && /\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}|^\d{5}$/.test(String(c)))
    if (iDate < 0) continue
    const numeric = cells.map((c, i) => ({ i, n: i === iDate ? undefined : toAmount(c), raw: String(c) })).filter((x) => x.n !== undefined && /[.,]\d{1,2}$|^-/.test(x.raw.trim()))
    // El primer importe suele ser el movimiento; el último, el saldo
    const amount = numeric[0]?.n
    const texts = cells
      .map((c, i) => ({ i, t: String(c).trim() }))
      // En el orden del banco: primero el concepto, después el detalle
      .filter((x) => x.i !== iDate && x.t && toAmount(x.t) === undefined && !toISODate(x.t) && !/^(eur|€)$/i.test(x.t))
    if (amount === undefined || amount === 0 || !texts.length) continue
    const concept = texts[0].t
    const detail = texts.slice(1).map((x) => x.t).join(' · ')
    out.push({ date: toISODate(cells[iDate])!, concept, detail, amount: round2(amount) })
  }
  if (!out.length) throw new Error('No encontré movimientos. Copiá las filas con fecha, concepto e importe.')
  return out
}

// ── Normalización y diccionario ─────────────────────────────────────────

const STOP = new Set(['barcelona', 'es', 'esp', 'spain', 'sl', 'sa', 's.l.', 's.a.', 'slu', 'bcn', 'c', 'de', 'del', 'la', 'el'])

/** Texto útil de un movimiento (concepto + detalle cuando el concepto es genérico) */
export function describe(row: BankRow) {
  const c = norm(row.concept)
  const d = norm(row.detail)
  if (c === 'bizum') return `bizum ${d.replace(/^(enviado|recibido):?\s*/, (m) => m)}`
  if (/^(adeudo|recibo|transferencia)/.test(c)) return `${c} ${d}`
  return c
}

/** Clave para agrupar el mismo comercio aunque cambie la tienda o el código (Macxipa tuset / Macxipa muntaner) */
export function merchantKey(row: BankRow): string {
  const c = norm(row.concept)
  const d = norm(row.detail)
  if (c === 'bizum') {
    const dir = /^recibido/.test(d) ? 'bizum recibido' : 'bizum enviado'
    const what = d.replace(/^(enviado|recibido):?\s*/, '').split(/\s+/)[0] ?? ''
    return what && what !== 'sin' ? `${dir}: ${what}` : dir
  }
  if (/^adeudo|^recibo/.test(c)) {
    const company = d.replace(/^n\s*\d+\s*/, '').split(/[\s,]+/).find((w) => w.length > 2 && !STOP.has(w))
    return `adeudo ${company ?? c}`
  }
  if (/^transferencia recibida/.test(c)) return 'transferencia recibida'
  if (/^transferencia/.test(c)) return `transferencia: ${d.split(/\s+/)[0] ?? ''}`.trim()
  if (/abono de nomina|nomina|sueldo/.test(c + ' ' + d)) return 'nomina'
  if (/ret\.? efectivo|cajero/.test(c)) return 'efectivo'
  const words = c
    .replace(/^sq \*|\*/g, ' ')
    .replace(/[^a-z0-9&'\s.-]/g, ' ')
    .split(/\s+/)
    .map((w) => w.replace(/\d+$/, '').replace(/^\d+$/, ''))
    .filter((w) => w.length > 1 && !STOP.has(w) && !/\d{2,}/.test(w))
  if (!words.length) return c.replace(/\s.*$/, '') || c
  // Cadenas conocidas: basta la primera palabra (Lidl, Mercadona, Granier…)
  const first = words[0].replace(/^maxcipa$/, 'macxipa')
  if (first.length <= 3 && words[1]) return `${first} ${words[1]}`
  return first
}

/** Nombre bonito para mostrar: "Lidl c casanova barcelona es" → "Lidl C Casanova" */
export function prettyMerchant(s?: string) {
  if (!s) return ''
  const clean = s.replace(/\s{2,}.*$/, '').replace(/^sq \*/i, '').replace(/\b(barcelona|es)\b\s*$/i, '').trim()
  return clean.charAt(0).toUpperCase() + clean.slice(1)
}

const DICT: [Bucket, RegExp][] = [
  ['nomina', /abono de nomina|\bnomina\b|sueldo|salar/],
  ['ingreso', /transferencia recibida/],
  ['efectivo', /ret\.? efectivo|cajero/],
  ['alquiler', /alquiler|lloguer|arrendamiento/],
  ['suministros', /endesa|naturgy|iberdrola|aigues|agua|holaluz|octopus|repsol luz|digi|movistar fibra|fibra/],
  ['tabaco', /estanc|tabac|tabaco|vaper/],
  ['deporte', /basic.?fit|\bpadel\b|playtomic|decathlon|esport|sport|gimnas|\bgym\b|basquet|basket|futbol|tenis/],
  ['delivery', /uber \*?eats|glovo|just eat|deliveroo|telepizza/],
  ['super', /lidl|mercadona|alcampo|consum|caprabo|condis|coviran|ametller|bonpreu|bon preu|carref|aldi\b|\bspar\b|^dia\b|\bdia \d|supermerc|supermec|supermarket|\bsuper\b|co aliment|coaliment|guissona|tot alimentacio|tot fruita|fruiter|tgtg|too good|superstore|one stop|24h|iman traders|premmia|momtaz|faizan|tandy|bonarea|veritas|carnisseria|panaderia/],
  ['cafe', /granier|^365\b|obrador|\bforn\b|cafe|coffee|caffe|pa i cafe|vivari|calidcafe|cal fuster|txots|a prop|starbucks|cake|cheesecake|pastisseria|bakery|croissant/],
  ['restaurantes', /\bbar\b|restaur|bistro|burguer|burger|smash|pizza|thai|noodle|sushi|ramen|yo tei|kebab|kevabro|panas|ceviche|honest greens|lucciano|cuvee|yesterday|\blior\b|heladeria|helado|chalito|taberna|cerveceria|criscito|almogavares|llumi|parrilla|mc ?donald|\bbk\d|burger king|\bbk \w|tapas|brasa|taqueria|mexican|pintxo|anahuac|nou 115|casa estop|chiku/],
  ['transporte', /bicing|renfe|\bave\b|\btmb\b|taxi|cabify|bolt|uber \*?trip|ballenoil|repsol|cepsa|galp|gasolin|mobilitat|parking|aparcament|t-usual|t-casual|alsa|vueling bus/],
  ['suscripciones', /spotify|netflix|google|apple\.com|icloud|hbo|disney|prime video|amazon prime|vodafone|orange|yoigo|chatgpt|openai|anthropic|youtube/],
  ['salud', /sanitas|farmacia|clinic|optica|dentist|fisio|hospital|adeslas|asisa/],
  ['ropa', /zara|pull and bear|pull&bear|c&a|primark|h&m|\bmango\b|bershka|uniqlo|decimas|stradivarius|massimo|lefties|jd sports|nike|adidas/],
  ['casa', /ikea|leroy|bauhaus|maisons|zara home|muebles|mueble|ferreteria|bricomart/],
  ['compras', /amazon|pccomponentes|fnac|media ?markt|el corte ingles|aliexpress|shein|loteria|loterias|miravia/],
  ['viajes', /booking|ryanair|vueling|iberia|airbnb|hotel|hostal|camping|gotogate|kayak|edreams|easyjet|blablacar|\bouigo\b|iryo/],
  ['ocio', /cine|teatro|concierto|entradas|ticketmaster|museu|museo|tinder|bumble|steam|playstation/],
]

/** Comercios que probablemente son de un tipo, pero conviene que lo confirmes */
const MAYBE: [Bucket, RegExp][] = [
  ['cafe', /macxipa|maxcipa|cafe|cafeteria|granja/],
  ['restaurantes', /casa|can|el|la/],
]

/** Palabras del concepto de un Bizum o transferencia → tipo de gasto */
const HINTS: [Bucket, RegExp][] = [
  ['deporte', /padel|basquet|basket|futbol|pista|gym|tenis/],
  ['restaurantes', /birra|cerve|cena|comida|almuerzo|desayuno|pizza|burger|milanesa|parrilla|asado|sushi|tapas|vermut|bar\b|mexicana|kamado/],
  ['viajes', /viaje|vuelo|hotel|camping|kayak|finde|escapada/],
  ['ocio', /cumple|regalo|entradas|concierto|fiesta|tinder/],
  ['casa', /mueble|sofa|casa|piso/],
]

export function guessBucket(row: BankRow): { bucket?: Bucket; confidence: Confidence } {
  const text = describe(row)
  const c = norm(row.concept)
  const isBizum = c === 'bizum'
  const isTransfer = /^transferencia realizada/.test(c)
  if (!isBizum && !isTransfer) for (const [b, re] of DICT) if (re.test(text)) return { bucket: b, confidence: 'conocido' }
  if (isBizum || isTransfer) {
    const concept = norm(row.detail).replace(/^(enviado|recibido):?\s*/, '')
    for (const [b, re] of HINTS) if (re.test(concept)) return { bucket: b, confidence: 'pista' }
    // Bizum a amigos sin pista: casi siempre es salir
    if (isBizum) return { bucket: 'restaurantes', confidence: 'pista' }
  }
  for (const [b, re] of MAYBE) if (re.test(text)) return { bucket: b, confidence: 'pista' }
  return { confidence: 'nada' }
}

// ── Del "tipo" a TUS categorías ─────────────────────────────────────────

const SYN: Record<Bucket, RegExp[]> = {
  super: [/super|mercado|comida|aliment|compra semanal/],
  restaurantes: [/restaur|social|ocio|salir|bares?\b|comer fuera/],
  cafe: [/cafe|cafes|delivery/, /restaur|social|ocio/],
  delivery: [/delivery/, /restaur|social|ocio/],
  tabaco: [/taba|fumar|cigar/],
  transporte: [/transp|bicing|movilidad/],
  deporte: [/deport|gym|gimn|padel/],
  suscripciones: [/suscrip|movil|telefon/, /seguro/],
  salud: [/salud|farmac|medic/, /seguro/, /suscrip/],
  ropa: [/ropa|necesar|vestir/, /compra/],
  compras: [/compra/, /ropa|necesar/],
  casa: [/mueble|casa|hogar/, /compra/],
  viajes: [/viaj|vacac/, /restaur|social|ocio/],
  ocio: [/ocio|social|salir/, /restaur/],
  suministros: [/suministr|luz|agua|internet/],
  alquiler: [/alquiler|vivienda/],
  efectivo: [/efectivo|cash/],
  nomina: [/nomina|sueldo|salario/],
  ingreso: [/otros ingresos|ingreso/],
}

export function categoryForBucket(bucket: Bucket, cats: Category[]): ID | undefined {
  const income = bucket === 'nomina' || bucket === 'ingreso'
  const pool = cats.filter((c) => !c.archived && (income ? c.type === 'ingreso' : c.type === 'fijo' || c.type === 'variable'))
  for (const re of SYN[bucket]) {
    const hit = pool.find((c) => re.test(norm(c.name)))
    if (hit) return hit.id
  }
  return undefined
}

// ── Clasificación completa ──────────────────────────────────────────────

export function classifyRows(rows: BankRow[], cats: Category[], rules: Record<string, string>, existing: Transaction[]): Classified[] {
  const catIds = new Set(cats.map((c) => c.id))
  const seenHashes = new Set(existing.map((t) => t.importHash).filter(Boolean))
  const occurrences = new Map<string, number>()

  const out = rows.map((row) => {
    const key = merchantKey(row)
    const base = `${row.date}|${row.amount}|${norm(row.concept)}|${norm(row.detail)}`
    const n = (occurrences.get(base) ?? 0) + 1
    occurrences.set(base, n)
    const hash = `${base}#${n}`
    const d = norm(row.detail)
    const isIncome = row.amount > 0
    const refund = isIncome && norm(row.concept) === 'bizum' && /^recibido/.test(d)
    const kind: Transaction['kind'] = isIncome && !refund ? 'ingreso' : 'gasto'

    let categoryId: ID | undefined
    let confidence: Confidence = 'nada'
    let ignore = false
    const rule = rules[key]
    if (rule === 'ignorar') {
      ignore = true
      confidence = 'regla'
    } else if (rule && catIds.has(rule)) {
      categoryId = rule
      confidence = 'regla'
    } else {
      const g = guessBucket(row)
      if (g.bucket) {
        categoryId = categoryForBucket(g.bucket, cats)
        confidence = categoryId ? g.confidence : 'nada'
      }
      if (kind === 'ingreso' && !categoryId) {
        categoryId = categoryForBucket('ingreso', cats)
        confidence = categoryId ? 'pista' : 'nada'
      }
    }

    return {
      row,
      key,
      label: prettyMerchant(norm(row.concept) === 'bizum' || /^(adeudo|transferencia)/.test(norm(row.concept)) ? `${row.concept}: ${row.detail.replace(/^N\s*\d+\s*/i, '')}` : row.concept),
      kind,
      refund,
      categoryId,
      ignore: ignore || seenHashes.has(hash),
      confidence: seenHashes.has(hash) ? 'regla' : confidence,
      hash,
      isDebit: /^(adeudo|recibo)/.test(norm(row.concept)),
      ...(seenHashes.has(hash) ? { alreadyImported: true } : {}),
    } as Classified
  })
  matchDuplicates(out, existing)
  return out
}

/**
 * ¿Ya lo cargaste a mano? Se empareja cada gasto manual con el movimiento del banco
 * más parecido: mismo importe (±1 %), fecha cercana (±3 días) y, si puede ser, misma categoría.
 */
function matchDuplicates(items: Classified[], existing: Transaction[]) {
  const manual = existing.filter((t) => !t.importHash && !t.recurringId && !t.sample)
  const pairs: { score: number; item: Classified; tx: Transaction }[] = []
  for (const tx of manual)
    for (const item of items) {
      if (isAlreadyImported(item)) continue
      const amount = Math.abs(item.row.amount)
      const diff = Math.abs(tx.amount - amount)
      const days = Math.abs(daysBetween(tx.date, item.row.date))
      const sameKind = tx.kind === item.kind || (item.refund && tx.kind === 'gasto')
      if (!sameKind || days > 3 || diff > Math.max(0.05, amount * 0.01)) continue
      pairs.push({ score: diff * 20 + days + (tx.categoryId && tx.categoryId !== item.categoryId ? 2 : 0), item, tx })
    }
  const usedTx = new Set<string>()
  const usedItem = new Set<Classified>()
  for (const p of pairs.sort((a, b) => a.score - b.score)) {
    if (usedTx.has(p.tx.id) || usedItem.has(p.item)) continue
    usedTx.add(p.tx.id)
    usedItem.add(p.item)
    p.item.duplicateOf = p.tx
  }
}

export const isAlreadyImported = (c: Classified) => (c as Classified & { alreadyImported?: boolean }).alreadyImported === true
