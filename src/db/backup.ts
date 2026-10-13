import { allTables, db } from './schema'
import type { Backup, Category, Transaction } from '../types'
import { net } from '../lib/calc'
import { capability } from '../lib/platform'

export async function exportBackup(): Promise<Backup> {
  const [settings, categories, transactions, recurrings, funds, habits, habitLogs, goals, ideas, reviews] = await Promise.all(allTables().map((t) => t.toArray()))
  return {
    app: 'mi-vida',
    version: 2,
    exportedAt: new Date().toISOString(),
    settings,
    categories,
    transactions,
    recurrings,
    funds,
    habits,
    habitLogs,
    goals,
    ideas,
    reviews,
  } as Backup
}

export async function importBackup(data: Backup) {
  if (data?.app !== 'mi-vida' || !Array.isArray(data.categories) || !Array.isArray(data.transactions)) {
    throw new Error('El archivo no parece una copia de seguridad de Mi Vida.')
  }
  await db.transaction('rw', allTables(), async () => {
    await Promise.all(allTables().map((t) => t.clear()))
    await db.settings.bulkPut(data.settings ?? [])
    await db.categories.bulkPut(data.categories)
    await db.transactions.bulkPut(data.transactions)
    await db.recurrings.bulkPut(data.recurrings ?? [])
    await db.funds.bulkPut(data.funds ?? [])
    await db.habits.bulkPut(data.habits ?? [])
    await db.habitLogs.bulkPut(data.habitLogs ?? [])
    await db.goals.bulkPut(data.goals ?? [])
    await db.ideas.bulkPut(data.ideas ?? [])
    await db.reviews.bulkPut(data.reviews ?? [])
  })
}

const csvCell = (v: string | number | undefined) => {
  const s = v === undefined ? '' : String(v)
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}
const num = (n: number) => n.toFixed(2).replace('.', ',')

/** CSV con ; y coma decimal (se abre bien en Excel en español) */
export function transactionsCsv(txs: Transaction[], cats: Map<string, Category>, fundName: (id?: string) => string) {
  const header = ['Fecha', 'Tipo', 'Categoría', 'Importe', 'Mi parte', 'Hucha', 'Nota', 'Método de pago']
  const rows = [...txs]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((t) =>
      [
        t.date.split('-').reverse().join('/'),
        t.kind,
        cats.get(t.categoryId ?? '')?.name ?? '',
        num(t.amount),
        num(net(t)),
        fundName(t.fundId),
        t.note,
        t.paymentMethod,
      ]
        .map(csvCell)
        .join(';'),
    )
  return '﻿' + [header.join(';'), ...rows].join('\n')
}

interface Downloads {
  save(r: { filename: string; data: string }): Promise<unknown>
}

/** Descarga un archivo (en el visor de Claude, a través de su diálogo de guardar) */
export async function download(filename: string, content: string, type: string) {
  const cap = await capability<Downloads>('downloads')
  if (cap) {
    try {
      await cap.save({ filename, data: content })
      return true
    } catch {
      return false
    }
  }
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  return true
}
