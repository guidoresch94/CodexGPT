import { Trash2 } from 'lucide-react'
import { useActions } from '../../app/actions'
import type { AppData } from '../../db/hooks'
import { db } from '../../db/schema'
import { fmtDayShort, monthKey, today } from '../../lib/dates'
import { money } from '../../lib/format'
import { costPerUse, heatmap, hitRate, streakDays, streakWeeks, sumBetween, UNIT_LABEL } from '../../lib/habits'
import type { Habit, HabitLog } from '../../types'
import { Button } from '../../components/ui'
import { monthRange } from '../../lib/dates'
import { useHabitTap } from './useHabitTap'

const LEVEL_ALPHA = ['', '55', '88', 'bb', 'ff']

export function HabitDetail({ habit: h, data, logs, onEdit }: { habit: Habit; data: AppData; logs: HabitLog[]; onEdit: () => void }) {
  const tap = useHabitTap(data)
  const { openHabitLog } = useActions()
  const grid = heatmap(h, logs)
  const key = monthKey(today())
  const { start, end } = monthRange(key)
  const monthTotal = sumBetween(h, logs, start, end)
  const cpu = costPerUse(h, logs, data.transactions, key)
  const streak = h.unit === 'si_no' ? streakDays(h, logs) : streakWeeks(h, logs)
  const recent = [...logs].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8)

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-2 text-center">
        <Stat label={h.unit === 'si_no' ? 'Racha (días)' : 'Racha (semanas)'} value={`🔥 ${streak}`} />
        <Stat label="Últimas 4 semanas" value={`${Math.round(hitRate(h, logs) * 100)} %`} />
        <Stat label="Este mes" value={`${Number.isInteger(monthTotal) ? monthTotal : monthTotal.toFixed(1)} ${UNIT_LABEL[h.unit]}`} />
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Últimas 15 semanas</p>
        <div className="flex gap-[3px] overflow-x-auto pb-1">
          <div className="mr-1 flex flex-col gap-[3px] text-[9px] leading-[14px] text-slate-400">
            {['L', '', 'X', '', 'V', '', 'D'].map((d, i) => (
              <span key={i} className="h-[14px]">{d}</span>
            ))}
          </div>
          {grid.map((week, w) => (
            <div key={w} className="flex flex-col gap-[3px]">
              {week.map((c) => (
                <span
                  key={c.date}
                  title={`${c.date}: ${c.value}`}
                  className={`h-[14px] w-[14px] rounded-[3px] ${c.level === 0 ? 'bg-slate-200 dark:bg-white/10' : c.level < 0 ? 'bg-transparent' : ''}`}
                  style={c.level > 0 ? { background: `${h.color}${LEVEL_ALPHA[c.level]}` } : undefined}
                />
              ))}
            </div>
          ))}
        </div>
        <div className="mt-1 flex items-center justify-end gap-1 text-[10px] text-slate-400">
          Menos
          {[0, 1, 2, 3, 4].map((l) => (
            <span key={l} className={`h-2.5 w-2.5 rounded-[2px] ${l === 0 ? 'bg-slate-200 dark:bg-white/10' : ''}`} style={l ? { background: `${h.color}${LEVEL_ALPHA[l]}` } : undefined} />
          ))}
          Más
        </div>
      </div>

      {cpu && (
        <div className="rounded-2xl bg-slate-100 p-3 text-sm dark:bg-white/5">
          <p className="text-xs text-slate-500 dark:text-slate-400">Coste por uso este mes</p>
          <p className="font-semibold">
            {cpu.perUse !== undefined ? `${money(cpu.perUse)} por sesión` : 'Aún sin sesiones este mes'}
          </p>
          <p className="text-[11px] text-slate-500">
            {money(cpu.spent)} en {data.catMap.get(h.linkedCategoryId!)?.name ?? 'la categoría'} / {cpu.sessions} sesiones. Cuantas más vayas, más barato sale.
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <Button onClick={() => (h.unit === 'veces' || h.unit === 'si_no' ? tap(h) : openHabitLog(h))}>Registrar hoy</Button>
        <Button variant="soft" onClick={onEdit}>Editar</Button>
      </div>

      {recent.length > 0 && (
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">Registros recientes</p>
          <div className="divide-y divide-slate-100 dark:divide-white/5">
            {recent.map((l) => (
              <div key={l.id} className="flex items-center justify-between py-2 text-sm">
                <span className="capitalize">{fmtDayShort(l.date)}</span>
                <span className="flex items-center gap-3">
                  <span className="tabular-nums text-slate-500">{h.unit === 'si_no' ? '✓' : `${l.value} ${UNIT_LABEL[h.unit]}`}</span>
                  <button onClick={() => db.habitLogs.delete(l.id)} aria-label="Borrar registro" className="text-slate-400 hover:text-red-500">
                    <Trash2 size={14} />
                  </button>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-slate-100 p-2.5 dark:bg-white/5">
      <p className="text-base font-bold tabular-nums">{value}</p>
      <p className="text-[10px] text-slate-500 dark:text-slate-400">{label}</p>
    </div>
  )
}
