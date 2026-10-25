import { useSyncExternalStore } from 'react'

export type Route = 'inicio' | 'movimientos' | 'presupuesto' | 'habitos' | 'metas' | 'ajustes' | 'categorias' | 'fijos' | 'importar' | 'asistente'

interface State {
  route: Route
  param?: string
}

/** Router mínimo en memoria (los artefactos de Claude no permiten rutas en el hash) */
let state: State = { route: 'inicio' }
const listeners = new Set<() => void>()

export function useRoute() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => state,
  )
}

export const go = (route: Route, param?: string) => {
  state = { route, param }
  listeners.forEach((l) => l())
  window.scrollTo(0, 0)
}
