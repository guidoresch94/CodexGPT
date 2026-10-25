import { Home, Plus, Repeat, Target, Wallet } from 'lucide-react'
import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { useData } from '../db/hooks'
import { ensureUpgrades, seedIfEmpty } from '../db/seed'
import { connectCloud, pullFromCloud, startAutoSave } from '../db/cloud'
import type { Habit } from '../types'
import { ToastProvider } from '../components/Toast'
import { cx, Sheet } from '../components/ui'
import { Dashboard } from '../modules/dashboard/Dashboard'
import { Movimientos } from '../modules/finanzas/Movimientos'
import { Presupuesto } from '../modules/finanzas/Presupuesto'
import { Categorias } from '../modules/finanzas/Categorias'
import { Fijos } from '../modules/finanzas/Fijos'
import { TxForm } from '../modules/finanzas/TxForm'
import { Metas } from '../modules/objetivos/Metas'
import { Habitos } from '../modules/habitos/Habitos'
import { HabitLogForm } from '../modules/habitos/HabitLogForm'
import { Review } from '../modules/dashboard/Review'
import { Importar } from '../modules/finanzas/Importar'
import { Asistente } from '../modules/finanzas/Asistente'
import { Celebrate, useGame } from '../modules/dashboard/Game'
import { Ajustes } from '../modules/ajustes/Ajustes'
import { ActionsCtx, type TxDraft } from './actions'
import { go, useRoute, type Route } from './router'

export function App() {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    ;(async () => {
      // Como artefacto de Claude: la copia de tu cuenta manda; si está vacía, se sube la local
      const cloud = await connectCloud()
      if (!cloud || !(await pullFromCloud())) await seedIfEmpty()
      else await ensureUpgrades()
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
      const dark = theme === 'oscuro' || (theme === 'sistema' && mq.matches)
      document.documentElement.classList.toggle('dark', dark)
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#000000' : '#f2f2f7')
    }
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [theme])
}

function Shell() {
  const data = useData()
  const { route, param } = useRoute()
  const [tx, setTx] = useState<TxDraft | null>(null)
  const [habitLog, setHabitLog] = useState<Habit | null>(null)
  const [review, setReview] = useState(false)
  const openTx = useCallback((initial?: TxDraft) => setTx(initial ?? {}), [])
  const closeTx = useCallback(() => setTx(null), [])
  const openHabitLog = useCallback((h: Habit) => setHabitLog(h), [])
  const openReview = useCallback(() => setReview(true), [])
  useTheme(data?.settings.theme)

  if (!data) return <Splash />

  const pages: Record<Route, ReactNode> = {
    inicio: <Dashboard data={data} />,
    movimientos: <Movimientos data={data} filter={param} />,
    presupuesto: <Presupuesto data={data} />,
    habitos: <Habitos data={data} />,
    metas: <Metas key={param} data={data} tab={param} />,
    ajustes: <Ajustes data={data} />,
    categorias: <Categorias data={data} />,
    fijos: <Fijos data={data} />,
    importar: <Importar data={data} />,
    asistente: <Asistente data={data} />,
  }

  return (
    <ActionsCtx.Provider value={{ openTx, openHabitLog, openReview }}>
      <main className="mx-auto min-h-dvh max-w-lg px-4 pb-28 pt-[max(env(safe-area-inset-top),8px)]"><div key={route + (param ?? '')} className="animate-page">{pages[route]}</div></main>
      <BottomNav route={route} onAdd={() => openTx()} />
      <GameLayer data={data} />
      <Sheet open={!!tx} onClose={closeTx} title={tx?.id ? 'Editar movimiento' : 'Nuevo movimiento'} full>
        {tx && <TxForm key={tx.id ?? 'new'} data={data} initial={tx} onClose={closeTx} />}
      </Sheet>
      <Sheet open={!!habitLog} onClose={() => setHabitLog(null)} title={habitLog ? `${habitLog.icon} ${habitLog.name}` : ''}>
        {habitLog && <HabitLogForm habit={habitLog} data={data} onDone={() => setHabitLog(null)} />}
      </Sheet>
      <Sheet open={review} onClose={() => setReview(false)} title="Revisión semanal" full>
        {review && <Review data={data} onDone={() => setReview(false)} />}
      </Sheet>
    </ActionsCtx.Provider>
  )
}

const NAV: { route: Route; label: string; icon: typeof Home }[] = [
  { route: 'inicio', label: 'Inicio', icon: Home },
  { route: 'movimientos', label: 'Gastos', icon: Wallet },
  { route: 'habitos', label: 'Hábitos', icon: Repeat },
  { route: 'metas', label: 'Metas', icon: Target },
]

function BottomNav({ route, onAdd }: { route: Route; onAdd: () => void }) {
  const active = (r: Route) =>
    route === r ||
    (r === 'movimientos' && (route === 'presupuesto' || route === 'categorias' || route === 'fijos' || route === 'importar' || route === 'asistente')) ||
    (r === 'inicio' && route === 'ajustes')
  const item = (n: (typeof NAV)[number]) => (
    <button
      key={n.route}
      onClick={() => go(n.route)}
      className={cx('press flex flex-1 flex-col items-center gap-[3px] pb-1 pt-1.5 text-[10px] font-medium', active(n.route) ? 'text-accent' : 'text-slate-500')}
    >
      <span className={cx('grid h-8 w-12 place-items-center rounded-full transition-colors duration-300', active(n.route) && 'bg-accent/12')}>
        <n.icon size={23} strokeWidth={active(n.route) ? 2.3 : 1.7} />
      </span>
      {n.label}
    </button>
  )
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-ios-sep bg-ios-bg/80 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl backdrop-saturate-150">
      <div className="mx-auto flex max-w-lg items-center px-2">
        {NAV.slice(0, 2).map(item)}
        <div className="flex flex-1 justify-center">
          <button
            onClick={onAdd}
            aria-label="Añadir movimiento"
            className="grid h-[50px] w-[50px] place-items-center rounded-full bg-accent text-white shadow-[0_6px_16px_rgba(0,122,255,0.35)] transition active:scale-90"
          >
            <Plus size={28} strokeWidth={2.5} />
          </button>
        </div>
        {NAV.slice(2).map(item)}
      </div>
    </nav>
  )
}

function GameLayer({ data }: { data: NonNullable<ReturnType<typeof useData>> }) {
  const g = useGame(data)
  return <Celebrate g={g} />
}
