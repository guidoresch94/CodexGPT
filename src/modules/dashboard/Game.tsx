import { Check, ChevronRight, Flame, Trophy } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { go } from '../../app/router'
import { useActions } from '../../app/actions'
import type { AppData } from '../../db/hooks'
import { daysBetween, today } from '../../lib/dates'
import { num } from '../../lib/format'
import { gameState, XP, type GameState } from '../../lib/game'
import { dayTotal } from '../../lib/habits'
import { Card, cx, List, SectionTitle, Sheet } from '../../components/ui'
import { reviewDue } from './Review'

export function useGame(data: AppData) {
  return useMemo(() => gameState(data), [data])
}

/** Nivel, puntos, racha y desafío de la semana */
export function GameCard({ g }: { g: GameState }) {
  const [open, setOpen] = useState(false)
  const pct = (g.xp - g.from) / Math.max(1, g.to - g.from)
  return (
    <>
      <Card onClick={() => setOpen(true)} className="p-0">
        <div className="flex items-center gap-3 p-4">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-[14px] bg-gradient-to-br from-amber-400 to-amber-600 text-[20px] font-bold text-white shadow-[0_4px_12px_rgba(255,149,0,0.35)]">
            {g.level}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-2">
              <p className="truncate text-[17px] font-semibold">Nivel {g.level} · {g.name}</p>
              <span className={cx('flex shrink-0 items-center gap-0.5 text-[15px] font-semibold', g.streak > 0 ? 'text-amber-500' : 'text-slate-400')}>
                <Flame size={16} /> {g.streak}
              </span>
            </div>
            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-ios-fill">
              <div className="h-full rounded-full bg-gradient-to-r from-amber-400 to-amber-500 transition-all duration-700" style={{ width: `${pct * 100}%` }} />
            </div>
            <p className="mt-1 text-[12px] text-slate-500">
              {num(g.xp)} pts · faltan {num(g.to - g.xp)} para el nivel {g.level + 1}
              {!g.activeToday && g.streak > 0 && ' · cargá algo hoy para no perder la racha'}
            </p>
          </div>
        </div>
        {g.challenge && (
          <div className="flex items-center gap-3 border-t border-ios-sep px-4 py-3">
            <span className="text-[22px]">{g.challenge.icon}</span>
            <div className="min-w-0 flex-1">
              <p className="text-[12px] font-semibold uppercase tracking-wide text-violet-500">Desafío de la semana · +{XP.challenge}</p>
              <p className="truncate text-[15px] font-medium">{g.challenge.title}</p>
              <div className="mt-1 flex items-center gap-2">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-ios-fill">
                  <div
                    className={cx('h-full rounded-full', g.challenge.failed ? 'bg-red-500' : g.challenge.done ? 'bg-emerald-500' : 'bg-violet-500')}
                    style={{ width: `${g.challenge.progress * 100}%` }}
                  />
                </div>
                <span className="shrink-0 text-[12px] text-slate-500">{g.challenge.done ? '¡Logrado!' : g.challenge.failed ? 'Esta vez no' : g.challenge.detail}</span>
              </div>
            </div>
          </div>
        )}
      </Card>
      <Sheet open={open} onClose={() => setOpen(false)} title="Tus logros">
        <Logros g={g} />
      </Sheet>
    </>
  )
}

function Logros({ g }: { g: GameState }) {
  const earned = g.badges.filter((b) => b.earned).length
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-2">
        {g.badges.map((b) => (
          <div key={b.id} className={cx('flex flex-col items-center gap-1 rounded-[16px] bg-ios-card p-3 text-center', !b.earned && 'opacity-40 grayscale')}>
            <span className="text-[32px]">{b.icon}</span>
            <span className="text-[12px] font-semibold leading-tight">{b.title}</span>
            <span className="text-[10px] leading-tight text-slate-500">{b.detail}</span>
          </div>
        ))}
      </div>
      <p className="text-center text-[13px] text-slate-500">
        {earned} de {g.badges.length} logros
      </p>
      <div>
        <p className="mb-1.5 px-1 text-[13px] uppercase tracking-wide text-slate-500">De dónde salen tus {num(g.xp)} pts</p>
        <List>
          {g.breakdown.map((b) => (
            <div key={b.label} className="flex items-center justify-between px-4 py-2.5 text-[15px]">
              <span>
                {b.label} <span className="text-slate-400">· {b.count}</span>
              </span>
              <span className="font-semibold tabular-nums">{num(b.xp)}</span>
            </div>
          ))}
        </List>
      </div>
    </div>
  )
}

interface Task {
  id: string
  icon: string
  text: string
  xp: number
  done: boolean
  run: () => void
}

/** Lo que conviene hacer hoy (los "avisos" de la app) */
export function TodayTasks({ data }: { data: AppData }) {
  const { openReview } = useActions()
  const now = today()
  const habits = data.habits.filter((h) => h.active && !h.auto)
  const habitsDone = habits.filter((h) => dayTotal(h, data.byHabit.get(h.id) ?? [], now) > 0).length
  const unclassified = data.transactions.filter((t) => t.kind === 'gasto' && !t.categoryId && !t.sample).length
  const lastImport = data.settings.lastImport
  const importDue = !lastImport || daysBetween(lastImport, now) >= 7
  const review = reviewDue(data)

  const tasks: Task[] = [
    ...(habits.length
      ? [{ id: 'habits', icon: '✅', text: habitsDone ? `Hábitos de hoy: ${habitsDone} de ${habits.length}` : 'Anotá tus hábitos de hoy', xp: XP.habitDay, done: habitsDone > 0, run: () => go('habitos') }]
      : []),
    ...(unclassified ? [{ id: 'classify', icon: '🏷️', text: `Clasificá ${unclassified} ${unclassified === 1 ? 'movimiento' : 'movimientos'}`, xp: XP.teach, done: false, run: () => go('movimientos', 'sin-clasificar') }] : []),
    {
      id: 'import',
      icon: '📥',
      text: importDue ? (lastImport ? `Importá el extracto (hace ${daysBetween(lastImport, now)} días)` : 'Importá tu extracto del banco') : 'Extracto al día',
      xp: XP.importDone,
      done: !importDue,
      run: () => go('importar'),
    },
    ...(review.due ? [{ id: 'review', icon: '🧭', text: 'Hacé la revisión de la semana', xp: XP.review, done: false, run: openReview }] : []),
  ]
  const pending = tasks.filter((t) => !t.done).length

  return (
    <>
      <SectionTitle>{pending ? `Para hoy · ${pending}` : 'Para hoy · todo listo'}</SectionTitle>
      <List>
        {tasks.map((t) => (
          <button key={t.id} onClick={t.run} className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-ios-fill">
            <span className={cx('grid h-[26px] w-[26px] shrink-0 place-items-center rounded-full', t.done ? 'bg-emerald-500 text-white' : 'border-[1.5px] border-slate-300 dark:border-slate-600')}>
              {t.done && <Check size={15} strokeWidth={3.5} />}
            </span>
            <span className={cx('flex-1 text-[15px]', t.done && 'text-slate-500')}>
              {t.icon} {t.text}
            </span>
            {!t.done && <span className="text-[13px] font-semibold text-amber-500">+{t.xp}</span>}
            <ChevronRight size={16} className="text-slate-400" />
          </button>
        ))}
      </List>
    </>
  )
}

const STORE = 'mv-game'

/** Celebra subidas de nivel y logros nuevos (recuerda lo ya visto en este dispositivo) */
export function Celebrate({ g }: { g: GameState }) {
  const [show, setShow] = useState<{ level?: number; badges: GameState['badges'] } | null>(null)
  useEffect(() => {
    let prev: { level: number; badges: string[] } | null = null
    try {
      prev = JSON.parse(localStorage.getItem(STORE) ?? 'null')
    } catch {
      prev = null
    }
    const earned = g.badges.filter((b) => b.earned)
    const save = () => {
      try {
        localStorage.setItem(STORE, JSON.stringify({ level: g.level, badges: earned.map((b) => b.id) }))
      } catch {
        /* sin almacenamiento: no pasa nada */
      }
    }
    if (!prev) return save()
    const newBadges = earned.filter((b) => !prev!.badges.includes(b.id))
    const levelUp = g.level > prev.level ? g.level : undefined
    if (levelUp || newBadges.length) setShow({ level: levelUp, badges: newBadges })
    save()
  }, [g.level, g.badges])

  if (!show) return null
  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-black/40 p-6 animate-fade" onClick={() => setShow(null)}>
      <Confetti />
      <div className="relative w-full max-w-xs rounded-[24px] bg-ios-card p-6 text-center shadow-2xl animate-pop">
        <Trophy className="mx-auto text-amber-500" size={44} />
        {show.level && (
          <>
            <p className="mt-2 text-[13px] font-semibold uppercase tracking-wide text-amber-500">¡Subiste de nivel!</p>
            <p className="text-[34px] font-bold">Nivel {show.level}</p>
            <p className="text-[15px] text-slate-500">{g.name}</p>
          </>
        )}
        {show.badges.length > 0 && (
          <div className="mt-4 space-y-2">
            {show.badges.map((b) => (
              <div key={b.id} className="flex items-center gap-3 rounded-[14px] bg-ios-fill p-2.5 text-left">
                <span className="text-[28px]">{b.icon}</span>
                <span>
                  <span className="block text-[15px] font-semibold">{b.title}</span>
                  <span className="block text-[12px] text-slate-500">{b.detail}</span>
                </span>
              </div>
            ))}
          </div>
        )}
        <button onClick={() => setShow(null)} className="mt-5 w-full rounded-[14px] bg-accent py-3 text-[17px] font-semibold text-white">
          ¡Vamos!
        </button>
      </div>
    </div>
  )
}

function Confetti() {
  const pieces = useMemo(
    () =>
      Array.from({ length: 40 }, (_, i) => ({
        left: Math.random() * 100,
        delay: Math.random() * 0.6,
        dur: 1.6 + Math.random() * 1.4,
        color: ['#ff2d55', '#34c759', '#0a84ff', '#ff9500', '#5856d6', '#ffcc00'][i % 6],
        rot: Math.random() * 360,
      })),
    [],
  )
  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden">
      {pieces.map((p, i) => (
        <span
          key={i}
          className="absolute top-[-10px] h-3 w-2 rounded-[2px]"
          style={{ left: `${p.left}%`, background: p.color, transform: `rotate(${p.rot}deg)`, animation: `confetti ${p.dur}s ${p.delay}s ease-in forwards` }}
        />
      ))}
    </div>
  )
}
