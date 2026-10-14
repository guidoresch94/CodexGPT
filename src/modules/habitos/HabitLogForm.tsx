import { useState } from 'react'
import type { AppData } from '../../db/hooks'
import { db } from '../../db/schema'
import { toISO, today } from '../../lib/dates'
import { money, num, parseAmount, round2, uid } from '../../lib/format'
import { linkModeOf, UNIT_LABEL } from '../../lib/habits'
import type { Habit } from '../../types'
import { useToast } from '../../components/Toast'
import { Button, cx, Input } from '../../components/ui'

const QUICK: Record<Habit['unit'], number[]> = {
  min: [15, 20, 30, 45, 60, 90],
  km: [3, 5, 7, 10, 15, 21],
  paginas: [5, 10, 20, 30, 50, 100],
  veces: [1, 2, 3],
  si_no: [1],
}

/** Registrar cantidad (min, km, páginas) con chips rápidos y, si aplica, lo que costó */
export function HabitLogForm({ habit, data, onDone }: { habit: Habit; data: AppData; onDone: () => void }) {
  const toast = useToast()
  const [value, setValue] = useState('')
  const [cost, setCost] = useState('')
  const [date, setDate] = useState(today())
  const yesterday = toISO(new Date(Date.now() - 864e5))
  const cat = habit.linkedCategoryId && linkModeOf(habit) === 'suma' ? data.catMap.get(habit.linkedCategoryId) : undefined

  const save = async (v: number) => {
    if (v <= 0) return
    const logId = uid()
    const paid = parseAmount(cost)
    let txId: string | undefined
    if (cat && paid > 0) {
      txId = uid()
      await db.transactions.put({ id: txId, date, amount: round2(paid), kind: 'gasto', categoryId: cat.id, note: habit.name, createdAt: Date.now() })
    }
    await db.habitLogs.put({ id: logId, habitId: habit.id, date, value: v, txId })
    toast({
      text: `${habit.icon} +${num(v, Number.isInteger(v) ? 0 : 1)} ${UNIT_LABEL[habit.unit]}${txId ? ` · ${money(paid)}` : ''}`,
      action: {
        label: 'Deshacer',
        run: async () => {
          await db.habitLogs.delete(logId)
          if (txId) await db.transactions.delete(txId)
        },
      },
    })
    onDone()
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {[
          { d: today(), l: 'Hoy' },
          { d: yesterday, l: 'Ayer' },
        ].map((o) => (
          <button key={o.l} onClick={() => setDate(o.d)} className={cx('rounded-full px-3.5 py-1.5 text-[13px] font-medium', date === o.d ? 'bg-accent text-white' : 'bg-ios-fill')}>
            {o.l}
          </button>
        ))}
      </div>
      {cat && (
        <div className="flex items-center gap-3 rounded-[14px] bg-ios-card p-3">
          <span className="text-[15px]">{cat.icon}</span>
          <span className="flex-1 text-[13px] text-slate-500">¿Pagaste algo? Se carga en {cat.name}</span>
          <input
            inputMode="decimal"
            placeholder="€ 0"
            value={cost}
            onChange={(e) => setCost(e.target.value)}
            className="w-20 rounded-[10px] bg-ios-fill px-2.5 py-2 text-right text-[15px] outline-none"
            aria-label="Costo"
          />
        </div>
      )}
      <div className="grid grid-cols-3 gap-2">
        {QUICK[habit.unit].map((q) => (
          <button key={q} onClick={() => save(q)} className="rounded-[14px] bg-ios-card py-4 text-lg font-semibold tabular-nums active:scale-95 active:opacity-70">
            {q} <span className="text-xs font-normal text-slate-500">{UNIT_LABEL[habit.unit]}</span>
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <Input inputMode="decimal" placeholder={`Otra cantidad (${UNIT_LABEL[habit.unit]})`} value={value} onChange={(e) => setValue(e.target.value)} />
        <Button disabled={!(parseAmount(value) > 0)} onClick={() => save(parseAmount(value))}>
          Anotar
        </Button>
      </div>
    </div>
  )
}
