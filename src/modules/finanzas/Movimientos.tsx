import { Download, Search, Sparkles, Upload, Users, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useActions } from '../../app/actions'
import { go } from '../../app/router'
import type { AppData } from '../../db/hooks'
import { GastosTabs } from './GastosTabs'
import { download, transactionsXlsx } from '../../db/backup'
import { isBudgetExpense, monthTxs, net, rootId } from '../../lib/calc'
import { CountUp } from '../../components/Fx'
import { fmtDayLong, monthKey, monthRange, today } from '../../lib/dates'
import { money } from '../../lib/format'
import type { Transaction } from '../../types'
import { prettyMerchant } from '../../lib/importer'
import { CatIcon, cx, Empty, MonthSwitcher, PageHeader } from '../../components/ui'

type KindFilter = 'todo' | 'gasto' | 'ingreso' | 'transferencia'

export function Movimientos({ data, filter }: { data: AppData; filter?: string }) {
  const { openTx } = useActions()
  const [month, setMonthRaw] = useState(monthKey(today()))
  const setMonth = (m: string) => {
    setMonthRaw(m)
    setDay(null)
  }
  const [q, setQ] = useState('')
  const [kind, setKind] = useState<KindFilter>('todo')
  const [day, setDay] = useState<string | null>(null)
  const { catMap, fundMap } = data
  const filterCat = filter ? catMap.get(filter) : undefined
  const onlyUnclassified = filter === 'sin-clasificar'

  const list = useMemo(() => {
    const query = q.trim().toLowerCase()
    const base = onlyUnclassified ? data.transactions.filter((t) => t.kind === 'gasto' && !t.categoryId) : monthTxs(data.transactions, month)
    return base.filter((t) => {
      if (kind !== 'todo' && t.kind !== kind) return false
      if (day && t.date !== day) return false
      if (filter && !onlyUnclassified && t.categoryId !== filter && rootId(t.categoryId, catMap) !== filter) return false
      if (query) {
        const hay = `${t.note ?? ''} ${t.merchant ?? ''} ${catMap.get(t.categoryId ?? '')?.name ?? ''} ${t.amount}`.toLowerCase()
        if (!hay.includes(query)) return false
      }
      return true
    })
  }, [data.transactions, month, q, kind, filter, catMap, onlyUnclassified, day])
  const bars = useMemo(() => {
    const { days } = monthRange(month)
    const per = Array.from({ length: days }, (_, i) => ({ d: `${month}-${String(i + 1).padStart(2, '0')}`, v: 0 }))
    for (const t of monthTxs(data.transactions, month)) if (isBudgetExpense(t)) per[Number(t.date.slice(8, 10)) - 1].v += Math.max(0, net(t))
    return per
  }, [data.transactions, month])
  const maxBar = Math.max(1, ...bars.map((b) => b.v))
  const unclassifiedCount = useMemo(() => data.transactions.filter((t) => t.kind === 'gasto' && !t.categoryId).length, [data.transactions])

  const groups = useMemo(() => {
    const g = new Map<string, Transaction[]>()
    for (const t of list) g.set(t.date, [...(g.get(t.date) ?? []), t])
    return [...g.entries()].sort((a, b) => b[0].localeCompare(a[0]))
  }, [list])

  const totalOut = list.filter((t) => t.kind === 'gasto').reduce((s, t) => s + net(t), 0)
  const totalIn = list.filter((t) => t.kind === 'ingreso').reduce((s, t) => s + t.amount, 0)

  const exportXlsx = () =>
    download(`movimientos-${month}.xlsx`, transactionsXlsx(list, catMap, (id) => fundMap.get(id ?? '')?.name ?? ''), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')

  return (
    <div>
      <PageHeader
        title="Gastos"
        right={
          <div className="mb-1.5 flex gap-2">
            <button onClick={exportXlsx} className="grid h-9 w-9 place-items-center rounded-full bg-ios-card text-accent" aria-label="Exportar a Excel" title="Exportar a Excel">
              <Download size={18} />
            </button>
            <button onClick={() => go('asistente')} className="grid h-9 w-9 place-items-center rounded-full bg-violet-500 text-white" aria-label="Cargar con IA" title="Cargar con IA">
              <Sparkles size={17} />
            </button>
            <button onClick={() => go('importar')} className="flex h-9 items-center gap-1.5 rounded-full bg-accent px-3.5 text-[15px] font-semibold text-white" aria-label="Importar extracto">
              <Upload size={16} /> Importar
            </button>
          </div>
        }
      />
      <GastosTabs value="movimientos" />
      {!onlyUnclassified && <MonthSwitcher value={month} onChange={setMonth} />}

      <div className="mt-3 flex items-center gap-2 rounded-[12px] bg-ios-fill px-3">
        <Search size={16} className="text-slate-400" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar comercio, nota o importe" className="w-full bg-transparent py-2.5 text-[15px] outline-none" />
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {(['todo', 'gasto', 'ingreso', 'transferencia'] as KindFilter[]).map((k) => (
          <button
            key={k}
            onClick={() => setKind(k)}
            className={cx('rounded-full px-3 py-1 text-xs capitalize', kind === k ? 'bg-accent text-white' : 'bg-ios-fill text-slate-700 dark:text-slate-300')}
          >
            {k === 'transferencia' ? 'Ahorros' : k === 'todo' ? 'Todo' : k + 's'}
          </button>
        ))}
        {unclassifiedCount > 0 && !onlyUnclassified && (
          <button onClick={() => go('movimientos', 'sin-clasificar')} className="rounded-full bg-amber-500/15 px-3 py-1 text-xs font-semibold text-amber-700 dark:text-amber-300">
            🏷️ Sin clasificar ({unclassifiedCount})
          </button>
        )}
        {onlyUnclassified && (
          <button onClick={() => go('movimientos')} className="flex items-center gap-1 rounded-full bg-amber-500/15 px-3 py-1 text-xs font-semibold text-amber-700 dark:text-amber-300">
            🏷️ Sin clasificar <X size={12} />
          </button>
        )}
        {filterCat && (
          <button onClick={() => go('movimientos')} className="flex items-center gap-1 rounded-full bg-sky-500/15 px-3 py-1 text-xs text-sky-700 dark:text-sky-300">
            {filterCat.icon} {filterCat.name} <X size={12} />
          </button>
        )}
      </div>

      <div className="mt-3 rounded-[22px] bg-ios-card p-4">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-[13px] text-slate-500">{day ? `El ${Number(day.slice(8, 10))}` : 'Gastaste'}</p>
            <p className="text-[28px] font-bold leading-none tabular-nums">
              <CountUp value={totalOut} format={money} />
            </p>
          </div>
          <div className="text-right">
            <p className="text-[13px] text-slate-500">Entró</p>
            <p className="text-[17px] font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">{money(totalIn)}</p>
          </div>
        </div>
        {!onlyUnclassified && (
          <div className="mt-3 flex h-14 items-end gap-[2px]">
            {bars.map((b) => (
              <button
                key={b.d}
                onClick={() => setDay(day === b.d ? null : b.d)}
                className={cx('flex-1 rounded-t-[3px] transition-all duration-300', day === b.d ? 'bg-accent' : day ? 'bg-slate-300 dark:bg-slate-700' : 'bg-accent/60')}
                style={{ height: `${Math.max(4, (b.v / maxBar) * 100)}%` }}
                aria-label={`Día ${Number(b.d.slice(8, 10))}: ${money(b.v)}`}
              />
            ))}
          </div>
        )}
        <p className="mt-2 flex items-center justify-between text-[12px] text-slate-500">
          <span>{list.length} movimientos</span>
          {day ? (
            <button onClick={() => setDay(null)} className="font-semibold text-accent">
              Ver todo el mes ✕
            </button>
          ) : (
            <span>Tocá una barra para ver ese día</span>
          )}
        </p>
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
              <div className="divide-y divide-slate-100 overflow-hidden rounded-[22px] bg-ios-card dark:divide-white/5">
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
  const sign = t.refund ? '+' : t.kind === 'gasto' ? '−' : t.kind === 'ingreso' ? '+' : '→'
  const tone = t.kind === 'ingreso' || t.refund ? 'text-emerald-600 dark:text-emerald-400' : t.kind === 'transferencia' ? 'text-sky-600 dark:text-sky-400' : ''
  const icon = t.kind === 'transferencia' ? (f?.icon ?? '🐷') : (c?.icon ?? '❓')
  const color = t.kind === 'transferencia' ? (f?.color ?? '#60a5fa') : (c?.color ?? '#94a3b8')
  const title = t.note || prettyMerchant(t.merchant) || (t.kind === 'transferencia' ? f?.name : c?.name) || 'Sin categoría'
  const sub = [
    t.kind === 'transferencia' ? `A ${f?.name ?? 'ahorros'}` : parent ? `${parent.name} › ${c?.name}` : (c?.name ?? 'Sin clasificar'),
    t.refund ? 'te devolvieron' : undefined,
    t.kind === 'gasto' && f ? `desde ${f.name}` : undefined,
    t.paymentMethod,
  ]
    .filter(Boolean)
    .join(' · ')
  return (
    <button onClick={onClick} className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-slate-50 dark:active:bg-white/5">
      <CatIcon icon={icon} color={color} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px]">{title}</p>
        <p className={cx('truncate text-[12px]', c || t.kind !== 'gasto' ? 'text-slate-500' : 'font-medium text-amber-600')}>{sub}</p>
      </div>
      <div className="text-right">
        <p className={cx('text-[15px] font-semibold tabular-nums', tone)}>
          {sign}
          {money(Math.abs(net(t)))}
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
