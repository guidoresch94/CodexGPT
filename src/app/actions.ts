import { createContext, useContext } from 'react'
import type { Habit, Transaction } from '../types'

export interface Actions {
  /** Abre el formulario de movimiento (vacío o para editar) */
  openTx: (initial?: Partial<Transaction>) => void
  /** Abre el registro de cantidad de un hábito (min, km, páginas…) */
  openHabitLog: (h: Habit) => void
  /** Abre la revisión semanal guiada */
  openReview: () => void
}

export const ActionsCtx = createContext<Actions>({ openTx: () => {}, openHabitLog: () => {}, openReview: () => {} })
export const useActions = () => useContext(ActionsCtx)
