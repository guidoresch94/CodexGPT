import { useActions } from '../../app/actions'
import type { AppData } from '../../db/hooks'
import { db } from '../../db/schema'
import type { Habit } from '../../types'
import { useToast } from '../../components/Toast'
import { addLog, toggleDay } from './actions'

/** Un toque: suma 1 (veces), marca/desmarca el día (sí/no) o pide cantidad */
export function useHabitTap(data: AppData) {
  const toast = useToast()
  const { openHabitLog } = useActions()
  return async (h: Habit) => {
    if (navigator.vibrate) navigator.vibrate(10)
    if (h.unit === 'si_no') {
      const on = await toggleDay(h, data.habitLogs)
      toast({ text: on ? `${h.icon} ${h.name}: hecho hoy ✓` : `${h.icon} ${h.name}: desmarcado` })
    } else if (h.unit === 'veces') {
      const log = await addLog(h, 1)
      toast({ text: `${h.icon} ${h.name} +1 ✓`, action: { label: 'Deshacer', run: () => db.habitLogs.delete(log.id) } })
    } else openHabitLog(h)
  }
}
