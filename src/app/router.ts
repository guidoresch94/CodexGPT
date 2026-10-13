import { useEffect, useState } from 'react'

export type Route = 'inicio' | 'movimientos' | 'presupuesto' | 'huchas' | 'ajustes' | 'categorias' | 'fijos'

const ROUTES: Route[] = ['inicio', 'movimientos', 'presupuesto', 'huchas', 'ajustes', 'categorias', 'fijos']

const parse = (): { route: Route; param?: string } => {
  const [r, param] = window.location.hash.replace(/^#\/?/, '').split('/')
  return { route: ROUTES.includes(r as Route) ? (r as Route) : 'inicio', param }
}

/** Router mínimo por hash (#/movimientos/super) — funciona offline y en cualquier subruta */
export function useRoute() {
  const [state, setState] = useState(parse)
  useEffect(() => {
    const on = () => {
      setState(parse())
      window.scrollTo(0, 0)
    }
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  return state
}

export const go = (route: Route, param?: string) => {
  window.location.hash = `/${route}${param ? `/${param}` : ''}`
}
