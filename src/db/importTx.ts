import { db } from './schema'
import type { AppData } from './hooks'
import { habitsForCategory, linkModeOf } from '../lib/habits'
import type { Classified } from '../lib/importer'
import { isAlreadyImported } from '../lib/importer'
import { today } from '../lib/dates'
import { uid } from '../lib/format'
import type { HabitLog, Transaction } from '../types'

export interface ImportChoice {
  /** Categoría elegida por grupo (clave de comercio) o 'ignorar' */
  byKey: Record<string, string | undefined>
  /** Hash de movimientos que, aunque parezcan duplicados, se importan igual */
  forceImport: Set<string>
  /** Nota por grupo (ej. «Cafetería») que se guarda en cada movimiento */
  notes?: Record<string, string>
}

/** Guarda los movimientos, une duplicados, crea sesiones de hábito y aprende reglas */
export async function commitImport(items: Classified[], choice: ImportChoice, data: AppData) {
  const txs: Transaction[] = []
  const merges: { id: string; importHash: string; merchant: string }[] = []
  const logs: HabitLog[] = []
  let ignored = 0
  for (const it of items) {
    if (isAlreadyImported(it)) continue
    const picked = choice.byKey[it.key]
    if (picked === 'ignorar') {
      ignored++
      continue
    }
    // El detalle «Pago con tarjeta» / «Otros» no aporta nada: solo se guarda si dice algo (Bizum, adeudos…)
    const merchant = [it.row.concept, /^(pago con tarjeta|otros)$/i.test(it.row.detail.trim()) ? '' : it.row.detail].filter(Boolean).join(' · ')
    if (it.duplicateOf && !choice.forceImport.has(it.hash)) {
      merges.push({ id: it.duplicateOf.id, importHash: it.hash, merchant })
      continue
    }
    const categoryId = picked ?? it.categoryId
    const concept = it.row.concept.toLowerCase()
    const tx: Transaction = {
      id: uid(),
      date: it.row.date,
      amount: Math.abs(it.row.amount),
      kind: it.kind,
      categoryId,
      refund: it.refund || undefined,
      merchant,
      note: choice.notes?.[it.key]?.trim() || undefined,
      importHash: it.hash,
      paymentMethod: concept === 'bizum' ? 'Bizum' : it.isDebit ? 'Domiciliación' : /tarjeta/i.test(it.row.detail) ? 'Tarjeta' : undefined,
      createdAt: Date.now(),
    }
    txs.push(tx)
    // Un pádel pagado cuenta como sesión de "Deporte" (las cuotas domiciliadas no)
    if (tx.kind === 'gasto' && !tx.refund && !it.isDebit)
      for (const h of habitsForCategory(categoryId, data.habits, data.catMap))
        if (linkModeOf(h) === 'suma' && !h.auto && (h.unit === 'veces' || h.unit === 'si_no'))
          logs.push({ id: uid(), habitId: h.id, date: tx.date, value: 1, txId: tx.id })
  }

  // Reglas aprendidas: la próxima vez, ese comercio se clasifica solo
  const rules = { ...(data.settings.merchantRules ?? {}) }
  const learned = new Set<string>()
  for (const it of items) {
    const picked = choice.byKey[it.key] ?? it.categoryId
    if (!picked || isAlreadyImported(it)) continue
    if (rules[it.key] !== picked) learned.add(it.key)
    rules[it.key] = picked
  }

  await db.transaction('rw', [db.transactions, db.habitLogs, db.settings], async () => {
    await db.transactions.bulkPut(txs)
    for (const m of merges) await db.transactions.update(m.id, { importHash: m.importHash, merchant: m.merchant })
    await db.habitLogs.bulkPut(logs)
    await db.settings.update('main', { merchantRules: rules, lastImport: today() })
  })
  return { created: txs.length, merged: merges.length, ignored, sessions: logs.length, learned: learned.size }
}

/** Guarda los movimientos que propuso la IA (y suma sesiones de hábitos enlazados) */
export async function saveDrafts(drafts: { date: string; amount: number; kind: 'gasto' | 'ingreso'; categoryId?: string; note: string; refund: boolean }[], data: AppData) {
  const txs: Transaction[] = []
  const logs: HabitLog[] = []
  for (const d of drafts) {
    const tx: Transaction = {
      id: uid(),
      date: d.date,
      amount: d.amount,
      kind: d.kind,
      categoryId: d.categoryId,
      note: d.note || undefined,
      refund: d.refund || undefined,
      createdAt: Date.now(),
    }
    txs.push(tx)
    if (tx.kind === 'gasto' && !tx.refund)
      for (const h of habitsForCategory(tx.categoryId, data.habits, data.catMap))
        if (linkModeOf(h) === 'suma' && !h.auto && (h.unit === 'veces' || h.unit === 'si_no'))
          logs.push({ id: uid(), habitId: h.id, date: tx.date, value: 1, txId: tx.id })
  }
  await db.transaction('rw', [db.transactions, db.habitLogs], async () => {
    await db.transactions.bulkPut(txs)
    await db.habitLogs.bulkPut(logs)
  })
  return { created: txs.length, sessions: logs.length, ids: txs.map((t) => t.id) }
}
