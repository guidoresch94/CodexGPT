import { createContext, useContext } from 'react'
import type { Habit, Transaction } from '../types'

export type TxDraft = Partial<Transaction> & { linkLogId?: string }

export interface Actions {
  /** Abre el formulario de movimiento (vacío o para editar). `linkLogId`: registro de hábito ya hecho al que se asocia el gasto */
  openTx: (initial?: TxDraft) => void
  /** Abre el registro de cantidad de un hábito (min, km, páginas…) */
  openHabitLog: (h: Habit) => void
  /** Abre la revisión semanal guiada */
  openReview: () => void
}

export const ActionsCtx = createContext<Actions>({ openTx: () => {}, openHabitLog: () => {}, openReview: () => {} })
export const useActions = () => useContext(ActionsCtx)
