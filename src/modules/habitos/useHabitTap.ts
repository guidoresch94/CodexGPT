import { useActions } from '../../app/actions'
import type { AppData } from '../../db/hooks'
import { db } from '../../db/schema'
import { today } from '../../lib/dates'
import { uid } from '../../lib/format'
import { brokenDates, linkModeOf } from '../../lib/habits'
import type { Habit } from '../../types'
import { useToast } from '../../components/Toast'
import { addLog, toggleDay } from './actions'

/**
 * Un toque:
 * - veces → suma 1 (y si está enlazado a una categoría, ofrece cargar lo que pagaste)
 * - sí/no → marca o desmarca el día
 * - automático ("sin tabaco") → registra o quita una recaída de hoy
 * - min/km/páginas → pide la cantidad
 */
export function useHabitTap(data: AppData) {
  const toast = useToast()
  const { openHabitLog, openTx } = useActions()
  return async (h: Habit) => {
    if (navigator.vibrate) navigator.vibrate(10)
    const now = today()
    if (h.auto) {
      const raw = data.habitLogs.filter((l) => l.habitId === h.id)
      const manual = raw.filter((l) => l.date === now && l.value < 0)
      if (manual.length) {
        await db.habitLogs.bulkDelete(manual.map((l) => l.id))
        toast({ text: `${h.icon} Recaída de hoy quitada` })
        return
      }
      if (brokenDates(h, raw, data).has(now)) {
        toast({ text: `Hoy tenés un gasto en ${data.catMap.get(h.linkedCategoryId ?? '')?.name ?? 'esa categoría'}: el día ya cuenta como recaída.` })
        return
      }
      const id = uid()
      await db.habitLogs.put({ id, habitId: h.id, date: now, value: -1 })
      toast({ text: `${h.icon} Recaída anotada. Mañana arrancás de nuevo 💪`, action: { label: 'Deshacer', run: () => db.habitLogs.delete(id) } })
      return
    }
    if (h.unit === 'si_no') {
      const on = await toggleDay(h, data.habitLogs)
      toast({ text: on ? `${h.icon} ${h.name}: hecho hoy ✓` : `${h.icon} ${h.name}: desmarcado` })
    } else if (h.unit === 'veces') {
      const log = await addLog(h, 1)
      const canPay = h.linkedCategoryId && linkModeOf(h) === 'suma'
      toast({
        text: `${h.icon} ${h.name} +1 ✓`,
        action: canPay
          ? { label: '¿Pagaste? +€', run: () => openTx({ kind: 'gasto', categoryId: h.linkedCategoryId, note: h.name, linkLogId: log.id }) }
          : { label: 'Deshacer', run: () => db.habitLogs.delete(log.id) },
      })
    } else openHabitLog(h)
  }
}
