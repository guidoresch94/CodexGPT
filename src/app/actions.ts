import { createContext, useContext } from 'react'
import type { Transaction } from '../types'

export interface Actions {
  /** Abre el formulario de movimiento (vacío o para editar) */
  openTx: (initial?: Partial<Transaction>) => void
}

export const ActionsCtx = createContext<Actions>({ openTx: () => {} })
export const useActions = () => useContext(ActionsCtx)
