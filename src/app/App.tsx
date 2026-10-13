import { Home, List, PiggyBank, Plus, Wallet } from 'lucide-react'
import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { useData } from '../db/hooks'
import { seedIfEmpty } from '../db/seed'
import { connectCloud, pullFromCloud, startAutoSave } from '../db/cloud'
import type { Transaction } from '../types'
import { ToastProvider } from '../components/Toast'
import { cx, Sheet } from '../components/ui'
import { Dashboard } from '../modules/dashboard/Dashboard'
import { Movimientos } from '../modules/finanzas/Movimientos'
import { Presupuesto } from '../modules/finanzas/Presupuesto'
import { Categorias } from '../modules/finanzas/Categorias'
import { Fijos } from '../modules/finanzas/Fijos'
import { TxForm } from '../modules/finanzas/TxForm'
import { Huchas } from '../modules/objetivos/Huchas'
import { Ajustes } from '../modules/ajustes/Ajustes'
import { ActionsCtx } from './actions'
import { go, useRoute, type Route } from './router'

export function App() {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    ;(async () => {
      // Como artefacto de Claude: la copia de tu cuenta manda; si está vacía, se sube la local
      const cloud = await connectCloud()
      if (!cloud || !(await pullFromCloud())) await seedIfEmpty()
      setReady(true)
      if (cloud) startAutoSave()
    })()
  }, [])
  return <ToastProvider>{ready ? <Shell /> : <Splash />}</ToastProvider>
}

function Splash() {
  return <div className="grid min-h-dvh place-items-center text-4xl">💶</div>
}

function useTheme(theme: string | undefined) {
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = () => {
      const dark = theme === 'oscuro' || (theme === 'sistema' && mq.matches) || !theme
      document.documentElement.classList.toggle('dark', dark)
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0b0f17' : '#f8fafc')
    }
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [theme])
}

function Shell() {
  const data = useData()
  const { route, param } = useRoute()
  const [tx, setTx] = useState<Partial<Transaction> | null>(null)
  const openTx = useCallback((initial?: Partial<Transaction>) => setTx(initial ?? {}), [])
  const closeTx = useCallback(() => setTx(null), [])
  useTheme(data?.settings.theme)

  if (!data) return <Splash />

  const pages: Record<Route, ReactNode> = {
    inicio: <Dashboard data={data} />,
    movimientos: <Movimientos data={data} filter={param} />,
    presupuesto: <Presupuesto data={data} />,
    huchas: <Huchas data={data} />,
    ajustes: <Ajustes data={data} />,
    categorias: <Categorias data={data} />,
    fijos: <Fijos data={data} />,
  }

  return (
    <ActionsCtx.Provider value={{ openTx }}>
      <main className="mx-auto min-h-dvh max-w-lg px-4 pb-32 pt-[max(env(safe-area-inset-top),12px)]">{pages[route]}</main>
      <BottomNav route={route} onAdd={() => openTx()} />
      <Sheet open={!!tx} onClose={closeTx} title={tx?.id ? 'Editar movimiento' : 'Nuevo movimiento'} full>
        {tx && <TxForm key={tx.id ?? 'new'} data={data} initial={tx} onClose={closeTx} />}
      </Sheet>
    </ActionsCtx.Provider>
  )
}

const NAV: { route: Route; label: string; icon: typeof Home }[] = [
  { route: 'inicio', label: 'Inicio', icon: Home },
  { route: 'movimientos', label: 'Movimientos', icon: List },
  { route: 'presupuesto', label: 'Presupuesto', icon: Wallet },
  { route: 'huchas', label: 'Huchas', icon: PiggyBank },
]

function BottomNav({ route, onAdd }: { route: Route; onAdd: () => void }) {
  const active = (r: Route) => route === r || (r === 'presupuesto' && route === 'categorias') || (r === 'inicio' && (route === 'ajustes' || route === 'fijos'))
  const item = (n: (typeof NAV)[number]) => (
    <button
      key={n.route}
      onClick={() => go(n.route)}
      className={cx('flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px]', active(n.route) ? 'text-emerald-500' : 'text-slate-500 dark:text-slate-400')}
    >
      <n.icon size={22} strokeWidth={active(n.route) ? 2.4 : 1.8} />
      {n.label}
    </button>
  )
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/90 pb-[env(safe-area-inset-bottom)] backdrop-blur dark:border-white/5 dark:bg-[#0b0f17]/90">
      <div className="mx-auto flex max-w-lg items-center px-2">
        {NAV.slice(0, 2).map(item)}
        <div className="flex flex-1 justify-center">
          <button
            onClick={onAdd}
            aria-label="Añadir movimiento"
            className="-mt-7 grid h-16 w-16 place-items-center rounded-full bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/30 transition active:scale-90"
          >
            <Plus size={30} strokeWidth={2.6} />
          </button>
        </div>
        {NAV.slice(2).map(item)}
      </div>
    </nav>
  )
}
