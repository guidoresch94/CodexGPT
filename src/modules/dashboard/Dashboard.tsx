import { Check, Settings as Gear } from 'lucide-react'
import { useMemo } from 'react'
import { go } from '../../app/router'
import { useActions } from '../../app/actions'
import { db } from '../../db/schema'
import type { AppData } from '../../db/hooks'
import { alerts, fundBalance, monthSummary, recurringStatus, weekly } from '../../lib/calc'
import { fmtDayLong, fmtDayShort, monthKey, today, weekdayInitial } from '../../lib/dates'
import { money, money0, pct, uid } from '../../lib/format'
import { useToast } from '../../components/Toast'
import { Card, CatIcon, cx, levelText, PageHeader, ProgressBar, SectionTitle } from '../../components/ui'
import { level } from '../../lib/calc'

export function Dashboard({ data }: { data: AppData }) {
  const { settings, transactions, categories, recurrings, catMap, funds } = data
  const key = monthKey(today())
  const w = useMemo(() => weekly(transactions, catMap, settings), [transactions, catMap, settings])
  const m = useMemo(() => monthSummary(transactions, categories, recurrings, settings, key), [transactions, categories, recurrings, settings, key])
  const notes = useMemo(() => alerts(transactions, categories, recurrings, settings), [transactions, categories, recurrings, settings])
  const pending = useMemo(() => recurringStatus(recurrings, transactions, key).filter((r) => !r.paid), [recurrings, transactions, key])

  const top = [...m.byRoot.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3)
  const hour = new Date().getHours()
  const hello = hour < 14 ? 'Buenos días' : hour < 21 ? 'Buenas tardes' : 'Buenas noches'

  return (
    <div>
      <PageHeader
        subtitle={fmtDayLong(today())}
        title={`${hello}, ${settings.name}`}
        right={
          <button onClick={() => go('ajustes')} className="rounded-full p-2 text-slate-500 hover:bg-slate-200 dark:hover:bg-white/10" aria-label="Ajustes">
            <Gear size={22} />
          </button>
        }
      />

      <WeeklyCard w={w} allowance={settings.weeklyAllowance} />

      {pending.length > 0 && <PendingList data={data} items={pending} />}

      <SectionTitle action={<button onClick={() => go('presupuesto')} className="text-xs text-emerald-600 dark:text-emerald-400">Ver presupuesto</button>}>
        Este mes
      </SectionTitle>
      <Card>
        <div className="grid grid-cols-3 gap-2 text-center">
          <Stat label="Ingresos" value={money0(m.income)} tone="text-emerald-600 dark:text-emerald-400" />
          <Stat label="Gastos" value={money0(m.spent)} />
          <Stat label="A huchas" value={money0(m.saved)} tone="text-sky-600 dark:text-sky-400" />
        </div>
        <div className="mt-4">
          <div className="mb-1 flex justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Gastado del presupuesto</span>
            <span className="tabular-nums">
              {money0(m.spent)} / {money0(m.budget)}
            </span>
          </div>
          <ProgressBar value={m.spent} max={m.budget} />
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-slate-50 p-3 dark:bg-white/[0.03]">
            <p className="text-[11px] text-slate-500 dark:text-slate-400">Ahorro previsto a fin de mes</p>
            <p className={cx('text-lg font-bold tabular-nums', m.projectedSaving >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500')}>{money0(m.projectedSaving)}</p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">Tasa de ahorro {pct(m.savingRate)}</p>
          </div>
          <div className="rounded-2xl bg-slate-50 p-3 dark:bg-white/[0.03]">
            <p className="text-[11px] text-slate-500 dark:text-slate-400">Sueldo en vivienda</p>
            <p className={cx('text-lg font-bold tabular-nums', m.housingPct <= settings.housingTarget ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-500')}>
              {pct(m.housingPct)}
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">Objetivo ≤ {settings.housingTarget} %</p>
          </div>
        </div>
      </Card>

      {notes.length > 0 && (
        <>
          <SectionTitle>Avisos</SectionTitle>
          <div className="space-y-2">
            {notes.map((n, i) => (
              <div
                key={i}
                className={cx(
                  'rounded-2xl px-4 py-3 text-sm',
                  n.tone === 'over' && 'bg-red-500/10 text-red-700 dark:text-red-300',
                  n.tone === 'warn' && 'bg-amber-500/10 text-amber-800 dark:text-amber-300',
                  n.tone === 'good' && 'bg-emerald-500/10 text-emerald-800 dark:text-emerald-300',
                  n.tone === 'info' && 'bg-sky-500/10 text-sky-800 dark:text-sky-300',
                )}
              >
                {n.text}
              </div>
            ))}
          </div>
        </>
      )}

      {top.length > 0 && (
        <>
          <SectionTitle>Donde más gastas este mes</SectionTitle>
          <Card className="space-y-3">
            {top.map(([id, spent]) => {
              const c = catMap.get(id)
              if (!c) return null
              return (
                <button key={id} onClick={() => go('movimientos', id)} className="flex w-full items-center gap-3 text-left">
                  <CatIcon icon={c.icon} color={c.color} />
                  <div className="min-w-0 flex-1">
                    <div className="flex justify-between text-sm">
                      <span className="truncate">{c.name}</span>
                      <span className={cx('tabular-nums font-medium', levelText[c.type === 'fijo' && spent <= c.monthlyBudget ? 'ok' : level(spent, c.monthlyBudget)])}>{money0(spent)}</span>
                    </div>
                    <div className="mt-1.5">
                      <ProgressBar value={spent} max={c.monthlyBudget} thin fixed={c.type === 'fijo'} />
                    </div>
                  </div>
                </button>
              )
            })}
          </Card>
        </>
      )}

      <SectionTitle action={<button onClick={() => go('huchas')} className="text-xs text-emerald-600 dark:text-emerald-400">Ver todas</button>}>Huchas</SectionTitle>
      <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1">
        {funds
          .filter((f) => !f.archived)
          .map((f) => {
            const b = fundBalance(f, transactions)
            return (
              <Card key={f.id} className="w-40 shrink-0" onClick={() => go('huchas')}>
                <div className="text-2xl">{f.icon}</div>
                <p className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">{f.name}</p>
                <p className="text-lg font-bold tabular-nums">{money0(b)}</p>
                {f.target ? (
                  <div className="mt-2">
                    <ProgressBar value={b} max={f.target} color={f.color} thin />
                    <p className="mt-1 text-[10px] text-slate-500">de {money0(f.target)}</p>
                  </div>
                ) : null}
              </Card>
            )
          })}
      </div>
    </div>
  )
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div>
      <p className="text-[11px] text-slate-500 dark:text-slate-400">{label}</p>
      <p className={cx('text-base font-bold tabular-nums', tone)}>{value}</p>
    </div>
  )
}

function WeeklyCard({ w, allowance }: { w: ReturnType<typeof weekly>; allowance: number }) {
  const { openTx } = useActions()
  const max = Math.max(...w.days.map((d) => d.amount), allowance / 7)
  const now = today()
  const over = w.remaining < 0
  return (
    <Card className="bg-gradient-to-br from-emerald-500/15 via-white to-white dark:from-emerald-500/20 dark:via-slate-900 dark:to-slate-900">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">💳 Tarjeta semanal · te quedan</p>
          <p className={cx('text-4xl font-bold tabular-nums tracking-tight', over ? 'text-red-500' : 'text-slate-900 dark:text-white')}>{money(w.remaining)}</p>
          <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-300">
            {over ? 'Hasta el lunes, modo ahorro 🙏' : (
              <>
                ≈ <b className="tabular-nums">{money(w.perDayAllowed)}</b>/día · {w.daysLeft} {w.daysLeft === 1 ? 'día' : 'días'}
              </>
            )}
          </p>
        </div>
        <button onClick={() => openTx()} className="rounded-2xl bg-emerald-500 px-3 py-2 text-sm font-semibold text-slate-950 active:scale-95">
          + Gasto
        </button>
      </div>
      <div className="mt-3">
        <ProgressBar value={w.spent} max={allowance} />
        <p className="mt-1 text-right text-[11px] text-slate-500 tabular-nums">
          {money0(w.spent)} de {money0(allowance)}
        </p>
      </div>
      <div className="mt-2 flex items-end gap-1.5">
        {w.days.map((d) => (
          <div key={d.date} className="flex flex-1 flex-col items-center gap-1" title={`${fmtDayShort(d.date)}: ${money(d.amount)}`}>
            <div className="flex h-12 w-full items-end">
              <div
                className={cx('w-full rounded-md', d.date === now ? 'bg-emerald-500' : d.date < now ? 'bg-slate-300 dark:bg-white/20' : 'bg-slate-200/60 dark:bg-white/5')}
                style={{ height: `${Math.max(4, (d.amount / max) * 100)}%` }}
              />
            </div>
            <span className={cx('text-[10px]', d.date === now ? 'font-bold text-emerald-600 dark:text-emerald-400' : 'text-slate-400')}>{weekdayInitial(d.date)}</span>
          </div>
        ))}
      </div>
    </Card>
  )
}

function PendingList({ data, items }: { data: AppData; items: ReturnType<typeof recurringStatus> }) {
  const toast = useToast()
  const now = today()
  const visible = items.filter((i) => i.due <= now).concat(items.filter((i) => i.due > now).slice(0, 3))

  const pay = async (r: (typeof items)[number]['recurring'], due: string) => {
    const id = uid()
    await db.transactions.put({
      id,
      date: due > now ? now : due,
      amount: r.amount,
      kind: r.kind,
      categoryId: r.categoryId,
      fundId: r.fundId,
      recurringId: r.id,
      note: r.name,
      paymentMethod: 'Domiciliación',
      createdAt: Date.now(),
    })
    toast({ text: `${r.name}: marcado ✓`, action: { label: 'Deshacer', run: () => db.transactions.delete(id) } })
  }

  if (!visible.length) return null
  return (
    <>
      <SectionTitle action={<button onClick={() => go('fijos')} className="text-xs text-emerald-600 dark:text-emerald-400">Gestionar</button>}>
        Fijos del mes
      </SectionTitle>
      <Card className="divide-y divide-slate-100 p-0 dark:divide-white/5">
        {visible.map(({ recurring: r, due, overdue }) => {
          const c = data.catMap.get(r.categoryId ?? '')
          return (
            <div key={r.id} className="flex items-center gap-3 px-4 py-3">
              <CatIcon icon={c?.icon ?? '📌'} color={c?.color ?? '#94a3b8'} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">{r.name}</p>
                <p className={cx('text-[11px]', overdue ? 'text-amber-600 dark:text-amber-400' : 'text-slate-500')}>
                  {overdue ? 'Pendiente desde' : 'Vence'} el {Number(due.slice(8, 10))} · {money(r.amount)}
                </p>
              </div>
              <button
                onClick={() => pay(r, due)}
                className="flex items-center gap-1 rounded-xl bg-emerald-500/15 px-3 py-1.5 text-xs font-semibold text-emerald-700 active:scale-95 dark:text-emerald-300"
              >
                <Check size={14} /> {r.kind === 'ingreso' ? 'Cobrado' : r.kind === 'transferencia' ? 'Hecho' : 'Pagado'}
              </button>
            </div>
          )
        })}
      </Card>
    </>
  )
}
