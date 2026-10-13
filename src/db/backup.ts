import { db } from './schema'
import type { Backup, Category, Transaction } from '../types'
import { net } from '../lib/calc'
import { capability } from '../lib/platform'

export async function exportBackup(): Promise<Backup> {
  const [settings, categories, transactions, recurrings, funds] = await Promise.all([
    db.settings.toArray(),
    db.categories.toArray(),
    db.transactions.toArray(),
    db.recurrings.toArray(),
    db.funds.toArray(),
  ])
  return { app: 'mi-vida', version: 1, exportedAt: new Date().toISOString(), settings, categories, transactions, recurrings, funds }
}

export async function importBackup(data: Backup) {
  if (data?.app !== 'mi-vida' || !Array.isArray(data.categories) || !Array.isArray(data.transactions)) {
    throw new Error('El archivo no parece una copia de seguridad de Mi Vida.')
  }
  await db.transaction('rw', [db.settings, db.categories, db.transactions, db.recurrings, db.funds], async () => {
    await Promise.all([db.settings.clear(), db.categories.clear(), db.transactions.clear(), db.recurrings.clear(), db.funds.clear()])
    await db.settings.bulkPut(data.settings ?? [])
    await db.categories.bulkPut(data.categories)
    await db.transactions.bulkPut(data.transactions)
    await db.recurrings.bulkPut(data.recurrings ?? [])
    await db.funds.bulkPut(data.funds ?? [])
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
