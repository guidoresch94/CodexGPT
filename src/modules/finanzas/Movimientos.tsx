import { Download, Search, Users, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useActions } from '../../app/actions'
import { go } from '../../app/router'
import type { AppData } from '../../db/hooks'
import { download, transactionsCsv } from '../../db/backup'
import { monthTxs, net, rootId } from '../../lib/calc'
import { fmtDayLong, monthKey, today } from '../../lib/dates'
import { money } from '../../lib/format'
import type { Transaction } from '../../types'
import { CatIcon, cx, Empty, MonthSwitcher, PageHeader } from '../../components/ui'

type KindFilter = 'todo' | 'gasto' | 'ingreso' | 'transferencia'

export function Movimientos({ data, filter }: { data: AppData; filter?: string }) {
  const { openTx } = useActions()
  const [month, setMonth] = useState(monthKey(today()))
  const [q, setQ] = useState('')
  const [kind, setKind] = useState<KindFilter>('todo')
  const { catMap, fundMap } = data
  const filterCat = filter ? catMap.get(filter) : undefined

  const list = useMemo(() => {
    const query = q.trim().toLowerCase()
    return monthTxs(data.transactions, month).filter((t) => {
      if (kind !== 'todo' && t.kind !== kind) return false
      if (filter && t.categoryId !== filter && rootId(t.categoryId, catMap) !== filter) return false
      if (query) {
        const hay = `${t.note ?? ''} ${catMap.get(t.categoryId ?? '')?.name ?? ''} ${t.amount}`.toLowerCase()
        if (!hay.includes(query)) return false
      }
      return true
    })
  }, [data.transactions, month, q, kind, filter, catMap])

  const groups = useMemo(() => {
    const g = new Map<string, Transaction[]>()
    for (const t of list) g.set(t.date, [...(g.get(t.date) ?? []), t])
    return [...g.entries()].sort((a, b) => b[0].localeCompare(a[0]))
  }, [list])

  const totalOut = list.filter((t) => t.kind === 'gasto').reduce((s, t) => s + net(t), 0)
  const totalIn = list.filter((t) => t.kind === 'ingreso').reduce((s, t) => s + t.amount, 0)

  const exportCsv = () =>
    download(`movimientos-${month}.csv`, transactionsCsv(list, catMap, (id) => fundMap.get(id ?? '')?.name ?? ''), 'text/csv;charset=utf-8')

  return (
    <div>
      <PageHeader
        title="Movimientos"
        right={
          <button onClick={exportCsv} className="rounded-full p-2 text-slate-500 hover:bg-slate-200 dark:hover:bg-white/10" aria-label="Exportar CSV" title="Exportar CSV">
            <Download size={20} />
          </button>
        }
      />
      <MonthSwitcher value={month} onChange={setMonth} />

      <div className="mt-3 flex items-center gap-2 rounded-2xl bg-white px-3 ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-white/5">
        <Search size={16} className="text-slate-400" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar nota, categoría o importe" className="w-full bg-transparent py-2.5 text-sm outline-none" />
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {(['todo', 'gasto', 'ingreso', 'transferencia'] as KindFilter[]).map((k) => (
          <button
            key={k}
            onClick={() => setKind(k)}
            className={cx('rounded-full px-3 py-1 text-xs capitalize', kind === k ? 'bg-emerald-500 text-slate-950' : 'bg-slate-200 text-slate-700 dark:bg-white/10 dark:text-slate-300')}
          >
            {k === 'transferencia' ? 'Huchas' : k === 'todo' ? 'Todo' : k + 's'}
          </button>
        ))}
        {filterCat && (
          <button onClick={() => go('movimientos')} className="flex items-center gap-1 rounded-full bg-sky-500/15 px-3 py-1 text-xs text-sky-700 dark:text-sky-300">
            {filterCat.icon} {filterCat.name} <X size={12} />
          </button>
        )}
      </div>

      <div className="mt-3 flex justify-between px-1 text-xs text-slate-500 dark:text-slate-400">
        <span>{list.length} movimientos</span>
        <span className="tabular-nums">
          −{money(totalOut)} · +{money(totalIn)}
        </span>
      </div>

      {groups.length === 0 ? (
        <Empty icon="🧾" text="No hay movimientos con estos filtros.">
          <button onClick={() => openTx()} className="mt-2 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950">
            Añadir uno
          </button>
        </Empty>
      ) : (
        groups.map(([date, txs]) => {
          const dayOut = txs.filter((t) => t.kind === 'gasto' && !t.fundId).reduce((s, t) => s + net(t), 0)
          return (
            <section key={date} className="mt-4">
              <div className="mb-1 flex justify-between px-1 text-xs text-slate-500 dark:text-slate-400">
                <span className="first-letter:uppercase">{fmtDayLong(date)}</span>
                {dayOut > 0 && <span className="tabular-nums">−{money(dayOut)}</span>}
              </div>
              <div className="divide-y divide-slate-100 overflow-hidden rounded-3xl bg-white ring-1 ring-slate-200 dark:divide-white/5 dark:bg-slate-900 dark:ring-white/5">
                {txs.map((t) => (
                  <TxRow key={t.id} t={t} data={data} onClick={() => openTx(t)} />
                ))}
              </div>
            </section>
          )
        })
      )}
    </div>
  )
}

export function TxRow({ t, data, onClick }: { t: Transaction; data: AppData; onClick: () => void }) {
  const c = data.catMap.get(t.categoryId ?? '')
  const f = data.fundMap.get(t.fundId ?? '')
  const parent = c?.parentId ? data.catMap.get(c.parentId) : undefined
  const sign = t.kind === 'gasto' ? '−' : t.kind === 'ingreso' ? '+' : '→'
  const tone = t.kind === 'ingreso' ? 'text-emerald-600 dark:text-emerald-400' : t.kind === 'transferencia' ? 'text-sky-600 dark:text-sky-400' : ''
  const icon = t.kind === 'transferencia' ? (f?.icon ?? '🐷') : (c?.icon ?? '❔')
  const color = t.kind === 'transferencia' ? (f?.color ?? '#60a5fa') : (c?.color ?? '#94a3b8')
  const title = t.note || (t.kind === 'transferencia' ? f?.name : c?.name) || 'Sin categoría'
  const sub = [
    t.kind === 'transferencia' ? `A ${f?.name ?? 'hucha'}` : parent ? `${parent.name} › ${c?.name}` : c?.name,
    t.kind === 'gasto' && f ? `desde ${f.name}` : undefined,
    t.paymentMethod,
  ]
    .filter(Boolean)
    .join(' · ')
  return (
    <button onClick={onClick} className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-slate-50 dark:active:bg-white/5">
      <CatIcon icon={icon} color={color} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm">{title}</p>
        <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">{sub}</p>
      </div>
      <div className="text-right">
        <p className={cx('text-sm font-semibold tabular-nums', tone)}>
          {sign}
          {money(net(t))}
        </p>
        {t.shared && (
          <p className="flex items-center justify-end gap-1 text-[10px] text-slate-500">
            <Users size={10} /> de {money(t.shared.total)}
          </p>
        )}
      </div>
    </button>
  )
}
