import { useState } from 'react'
import { toISO, today } from '../../lib/dates'
import { parseAmount } from '../../lib/format'
import { UNIT_LABEL } from '../../lib/habits'
import type { Habit } from '../../types'
import { useToast } from '../../components/Toast'
import { Button, cx, Input } from '../../components/ui'
import { db } from '../../db/schema'
import { addLog } from './actions'

const QUICK: Record<Habit['unit'], number[]> = {
  min: [15, 20, 30, 45, 60, 90],
  km: [3, 5, 7, 10, 15, 21],
  paginas: [5, 10, 20, 30, 50, 100],
  veces: [1, 2, 3],
  si_no: [1],
}

/** Registrar cantidad (min, km, páginas) con chips rápidos */
export function HabitLogForm({ habit, onDone }: { habit: Habit; onDone: () => void }) {
  const toast = useToast()
  const [value, setValue] = useState('')
  const [date, setDate] = useState(today())
  const yesterday = toISO(new Date(Date.now() - 864e5))

  const save = async (v: number) => {
    if (v <= 0) return
    const log = await addLog(habit, v, date)
    toast({ text: `${habit.icon} +${v} ${UNIT_LABEL[habit.unit]}`, action: { label: 'Deshacer', run: () => db.habitLogs.delete(log.id) } })
    onDone()
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {[
          { d: today(), l: 'Hoy' },
          { d: yesterday, l: 'Ayer' },
        ].map((o) => (
          <button key={o.l} onClick={() => setDate(o.d)} className={cx('rounded-full px-3 py-1 text-xs', date === o.d ? 'bg-emerald-500 text-slate-950' : 'bg-slate-200 dark:bg-white/10')}>
            {o.l}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {QUICK[habit.unit].map((q) => (
          <button
            key={q}
            onClick={() => save(q)}
            className="rounded-2xl bg-slate-100 py-4 text-lg font-semibold tabular-nums active:scale-95 dark:bg-white/5"
          >
            {q} <span className="text-xs font-normal text-slate-500">{UNIT_LABEL[habit.unit]}</span>
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <Input inputMode="decimal" placeholder={`Otra cantidad (${UNIT_LABEL[habit.unit]})`} value={value} onChange={(e) => setValue(e.target.value)} />
        <Button disabled={!(parseAmount(value) > 0)} onClick={() => save(parseAmount(value))}>
          Añadir
        </Button>
      </div>
    </div>
  )
}
