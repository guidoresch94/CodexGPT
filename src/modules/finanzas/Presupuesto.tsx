import { Pencil, SlidersHorizontal } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis } from 'recharts'
import { go } from '../../app/router'
import type { AppData } from '../../db/hooks'
import { GastosTabs } from './GastosTabs'
import { level, monthSummary, monthTxs, savedByCategory, spentByCategory } from '../../lib/calc'
import { fmtMonthShort, monthKey, shiftMonth, today } from '../../lib/dates'
import { money, money0, pct } from '../../lib/format'
import type { Category } from '../../types'
import { Card, CatIcon, cx, levelText, MonthSwitcher, PageHeader, ProgressBar, SectionTitle, Sheet } from '../../components/ui'
import { CategoryEditor } from './CategoryEditor'

export function Presupuesto({ data }: { data: AppData }) {
  const { transactions, categories, recurrings, settings, catMap } = data
  const [month, setMonth] = useState(monthKey(today()))
  const [edit, setEdit] = useState<Category | null>(null)

  const m = useMemo(() => monthSummary(transactions, categories, recurrings, settings, month), [transactions, categories, recurrings, settings, month])
  const prev = useMemo(() => monthSummary(transactions, categories, recurrings, settings, shiftMonth(month, -1)), [transactions, categories, recurrings, settings, month])
  const mtx = useMemo(() => monthTxs(transactions, month), [transactions, month])
  const byCat = useMemo(() => spentByCategory(mtx), [mtx])
  const saved = useMemo(() => savedByCategory(mtx), [mtx])

  const roots = categories.filter((c) => !c.parentId && !c.archived)
  const expenseRoots = roots.filter((c) => (c.type === 'fijo' || c.type === 'variable') && !c.reduce)
  const reduceRoots = roots.filter((c) => (c.type === 'fijo' || c.type === 'variable') && c.reduce)
  const savingRoots = roots.filter((c) => c.type === 'ahorro')
  const children = (id: string) => categories.filter((c) => c.parentId === id && !c.archived)

  const unassigned = settings.monthlyIncome - m.budget - m.savingsBudget

  const donut = [...m.byRoot.entries()]
    .map(([id, value]) => ({ id, value, name: catMap.get(id)?.name ?? 'Sin categoría', color: catMap.get(id)?.color ?? '#94a3b8' }))
    .filter((d) => d.value > 0)
    .sort((a, b) => b.value - a.value)

  const history = useMemo(
    () =>
      Array.from({ length: 6 }, (_, i) => {
        const k = shiftMonth(month, i - 5)
        const s = monthSummary(transactions, categories, recurrings, settings, k)
        return { key: k, label: fmtMonthShort(k), gasto: Math.round(s.spent), ahorro: Math.round(s.saved) }
      }),
    [transactions, categories, recurrings, settings, month],
  )

  const row = (c: Category) => {
    const spent = m.byRoot.get(c.id) ?? 0
    const subs = children(c.id)
    const lvl = c.type === 'fijo' && spent <= c.monthlyBudget ? 'ok' : level(spent, c.monthlyBudget)
    return (
      <div key={c.id} className="py-3">
        <div className="flex items-center gap-3">
          <button onClick={() => go('movimientos', c.id)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
            <CatIcon icon={c.icon} color={c.color} />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <span className="truncate text-sm font-medium">{c.name}</span>
                <span className="shrink-0 text-xs tabular-nums text-slate-500 dark:text-slate-400">
                  <b className={cx('text-sm', levelText[lvl])}>{money0(spent)}</b>
                  {c.monthlyBudget > 0 && ` / ${money0(c.monthlyBudget)}`}
                </span>
              </div>
              <div className="mt-1.5">
                <ProgressBar value={spent} max={c.monthlyBudget} fixed={c.type === 'fijo'} />
              </div>
              {c.monthlyBudget > 0 && (
                <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                  {spent <= c.monthlyBudget ? `Quedan ${money(c.monthlyBudget - spent)}` : `Te pasaste ${money(spent - c.monthlyBudget)}`}
                  <Diff now={spent} before={prev.byRoot.get(c.id) ?? 0} />
                </p>
              )}
            </div>
          </button>
          <button onClick={() => setEdit(c)} className="rounded-full p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5" aria-label={`Editar ${c.name}`}>
            <Pencil size={15} />
          </button>
        </div>
        {subs.length > 0 && (
          <div className="ml-[52px] mt-2 space-y-1">
            {subs.map((s) => (
              <button key={s.id} onClick={() => go('movimientos', s.id)} className="flex w-full justify-between text-xs text-slate-500 dark:text-slate-400">
                <span>
                  {s.icon} {s.name}
                </span>
                <span className="tabular-nums">{money(byCat.get(s.id) ?? 0)}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title="Gastos"
        right={
          <button onClick={() => go('categorias')} className="flex items-center gap-1.5 rounded-full bg-ios-fill px-3 py-1.5 text-xs">
            <SlidersHorizontal size={14} /> Categorías
          </button>
        }
      />
      <GastosTabs value="presupuesto" />
      <MonthSwitcher value={month} onChange={setMonth} />

      <Card className="mt-3">
        <div className="flex items-center gap-4">
          <div className="h-32 w-32 shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={donut.length ? donut : [{ value: 1, color: '#94a3b833', name: '' }]} dataKey="value" innerRadius="68%" outerRadius="100%" stroke="none" isAnimationActive={false}>
                  {(donut.length ? donut : [{ color: '#94a3b833' }]).map((d, i) => (
                    <Cell key={i} fill={d.color} />
                  ))}
                </Pie>
                {donut.length > 0 && <Tooltip formatter={(v) => money(Number(v))} contentStyle={{ borderRadius: 12, fontSize: 12 }} />}
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-slate-500 dark:text-slate-400">Gastado</p>
            <p className="text-2xl font-bold tabular-nums">{money0(m.spent)}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">de {money0(m.budget)} presupuestados</p>
            <div className="mt-2">
              <ProgressBar value={m.spent} max={m.budget} />
            </div>
            {m.fromFunds > 0 && <p className="mt-2 text-[11px] text-slate-500">+ {money0(m.fromFunds)} pagados desde tus ahorros</p>}
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1">
          {donut.slice(0, 6).map((d) => (
            <span key={d.id} className="flex items-center gap-1 text-[11px] text-slate-600 dark:text-slate-300">
              <span className="h-2 w-2 rounded-full" style={{ background: d.color }} />
              {d.name} {pct((d.value / m.spent) * 100)}
            </span>
          ))}
        </div>
      </Card>

      <Card className="mt-3 text-sm">
        <p className="mb-2 text-xs font-semibold text-slate-500 dark:text-slate-400">Tu plan mensual</p>
        <PlanLine label="Ingreso" value={settings.monthlyIncome} />
        <PlanLine label="Gastos presupuestados" value={-m.budget} />
        <PlanLine label="Ahorro previsto" value={-m.savingsBudget} />
        <div className="my-2 border-t border-slate-100 dark:border-white/5" />
        <PlanLine label={unassigned >= 0 ? 'Sin asignar' : 'Te falta para cuadrar'} value={unassigned} bold tone={unassigned >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'} />
        {unassigned < 0 && <p className="mt-2 text-[11px] text-slate-500">Tu plan reparte más de lo que ingresás. Bajá algún presupuesto (tocá ✏️).</p>}
      </Card>

      <SectionTitle>Gastos</SectionTitle>
      <Card className="divide-y divide-slate-100 py-1 dark:divide-white/5">{expenseRoots.map(row)}</Card>

      {reduceRoots.length > 0 && (
        <>
          <SectionTitle>Hábitos a reducir · objetivo € 0</SectionTitle>
          <Card className="divide-y divide-slate-100 py-1 dark:divide-white/5">{reduceRoots.map(row)}</Card>
        </>
      )}

      {savingRoots.length > 0 && (
        <>
          <SectionTitle>Ahorro · págate primero</SectionTitle>
          <Card className="space-y-3">
            {savingRoots.map((c) => {
              const v = saved.get(c.id) ?? 0
              return (
                <div key={c.id} className="flex items-center gap-3">
                  <CatIcon icon={c.icon} color={c.color} />
                  <div className="flex-1">
                    <div className="flex justify-between text-sm">
                      <span>{c.name}</span>
                      <span className="tabular-nums text-xs text-slate-500">
                        <b className="text-sm text-sky-600 dark:text-sky-400">{money0(v)}</b> / {money0(c.monthlyBudget)}
                      </span>
                    </div>
                    <div className="mt-1.5">
                      <ProgressBar value={v} max={c.monthlyBudget} color={v >= c.monthlyBudget ? '#10b981' : '#38bdf8'} />
                    </div>
                  </div>
                  <button onClick={() => setEdit(c)} className="rounded-full p-2 text-slate-400" aria-label={`Editar ${c.name}`}>
                    <Pencil size={15} />
                  </button>
                </div>
              )
            })}
          </Card>
        </>
      )}

      <SectionTitle>Últimos 6 meses</SectionTitle>
      <Card>
        <div className="h-44">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={history} margin={{ top: 8, right: 0, left: 0, bottom: 0 }}>
              <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={11} stroke="#94a3b8" />
              <Tooltip formatter={(v, n) => [money0(Number(v)), n === 'gasto' ? 'Gasto' : 'Ahorrado']} cursor={{ fill: '#94a3b822' }} contentStyle={{ borderRadius: 12, fontSize: 12 }} />
              <Bar dataKey="gasto" radius={[6, 6, 0, 0]} fill="#f97316" />
              <Bar dataKey="ahorro" radius={[6, 6, 0, 0]} fill="#38bdf8" />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-1 flex justify-center gap-4 text-[11px] text-slate-500">
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-orange-500" /> Gasto</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-sky-400" /> Ahorrado</span>
          <span>Presupuesto: {money0(m.budget)}</span>
        </div>
      </Card>

      <Sheet open={!!edit} onClose={() => setEdit(null)} title="Editar categoría">
        {edit && <CategoryEditor key={edit.id} data={data} initial={edit} onSaved={() => setEdit(null)} />}
      </Sheet>
    </div>
  )
}

function PlanLine({ label, value, bold, tone }: { label: string; value: number; bold?: boolean; tone?: string }) {
  return (
    <div className={cx('flex justify-between py-0.5', bold && 'font-semibold')}>
      <span className="text-slate-600 dark:text-slate-300">{label}</span>
      <span className={cx('tabular-nums', tone)}>{money(value)}</span>
    </div>
  )
}

/** Diferencia frente al mes anterior completo */
function Diff({ now, before }: { now: number; before: number }) {
  const d = now - before
  if (before === 0 || Math.abs(d) < 1) return null
  return (
    <span className={cx('ml-1', d > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400')}>
      · {d > 0 ? '▲' : '▼'} {money0(Math.abs(d))} vs mes pasado
    </span>
  )
}
