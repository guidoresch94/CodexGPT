import { useMemo, useState } from 'react'
import type { AppData } from '../../db/hooks'
import { db } from '../../db/schema'
import { byId, isBudgetExpense, monthPace, net, rootId, inRange } from '../../lib/calc'
import { fmtDate, monthKey, weekRange } from '../../lib/dates'
import { money, money0 } from '../../lib/format'
import { logsByHabit, moneyScore, UNIT_LABEL, weekProgress, weekScore } from '../../lib/habits'
import { useToast } from '../../components/Toast'
import { Button, cx } from '../../components/ui'
import { ScoreRing } from '../habitos/ScoreRing'

/** Semana a revisar: de viernes a domingo, la actual; de lunes a jueves, la anterior */
export function reviewWeek(now = new Date()) {
  const dow = (now.getDay() + 6) % 7 // 0 = lunes
  const ref = dow >= 4 ? now : new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7)
  return { ...weekRange(ref), ref }
}

const MOODS = ['😩', '😕', '😐', '🙂', '🤩']

export function Review({ data, onDone }: { data: AppData; onDone: () => void }) {
  const toast = useToast()
  const week = useMemo(() => reviewWeek(), [])
  const existing = data.reviews.find((r) => r.id === week.start)
  const [step, setStep] = useState(0)
  const [wins, setWins] = useState(existing?.wins ?? '')
  const [improve, setImprove] = useState(existing?.improve ?? '')
  const [focus, setFocus] = useState(existing?.focus ?? '')
  const [mood, setMood] = useState(existing?.mood ?? 4)

  const catMap = useMemo(() => byId(data.categories), [data.categories])
  const money_ = useMemo(() => {
    const txs = data.transactions.filter((t) => isBudgetExpense(t) && inRange(t, week.start, week.end))
    const byRoot = new Map<string, number>()
    for (const t of txs) {
      const r = rootId(t.categoryId, catMap) ?? '?'
      byRoot.set(r, (byRoot.get(r) ?? 0) + net(t))
    }
    const total = txs.reduce((s, t) => s + net(t), 0)
    return { total, top: [...byRoot].sort((a, b) => b[1] - a[1]).slice(0, 4), count: txs.length }
  }, [data.transactions, week, catMap])

  const byH = useMemo(() => logsByHabit(data.habitLogs), [data.habitLogs])
  const habits = data.habits.filter((h) => h.active).map((h) => ({ h, p: weekProgress(h, byH.get(h.id) ?? [], week.ref) }))
  const pace = monthPace(data.transactions, data.categories, monthKey(week.ref))
  const score = weekScore(data.habits, data.habitLogs, moneyScore(pace), week.ref)

  const worst = habits.filter((x) => !x.p.met).sort((a, b) => a.p.pct - b.p.pct)[0]
  const topCat = money_.top[0] ? catMap.get(money_.top[0][0]) : undefined
  const suggestions = [
    worst && `${worst.h.icon} ${worst.h.name}: llegar a ${worst.h.weeklyTarget} ${UNIT_LABEL[worst.h.unit]}`,
    topCat && topCat.type === 'variable' && `${topCat.icon} Gastar menos en ${topCat.name}`,
    '📵 Una noche sin pantallas',
    '🥗 Cocinar en casa 4 días',
  ].filter(Boolean) as string[]

  const save = async () => {
    await db.reviews.put({ id: week.start, wins: wins.trim(), improve: improve.trim(), focus: focus.trim(), mood, score: score.score, createdAt: Date.now() })
    toast({ text: '✅ Revisión guardada. ¡A por la semana!' })
    onDone()
  }

  const steps = ['Dinero', 'Hábitos', 'Reflexión', 'Foco']

  return (
    <div className="flex min-h-full flex-col">
      <p className="text-xs text-slate-500 dark:text-slate-400">
        Semana del {fmtDate(week.start)} al {fmtDate(week.end)}
      </p>
      <div className="mt-2 flex gap-1.5">
        {steps.map((s, i) => (
          <button key={s} onClick={() => setStep(i)} className="flex-1">
            <span className={cx('block h-1.5 rounded-full', i <= step ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-white/10')} />
            <span className={cx('mt-1 block text-[10px]', i === step ? 'font-semibold' : 'text-slate-400')}>{s}</span>
          </button>
        ))}
      </div>

      <div className="mt-5 flex-1">
        {step === 0 && (
          <div className="space-y-4">
            <h4 className="text-lg font-semibold">💸 ¿Qué gastaste?</h4>
            <div className="rounded-2xl bg-slate-100 p-4 dark:bg-white/5">
              <p className="text-3xl font-bold tabular-nums">{money(money_.total)}</p>
              <p className="text-xs text-slate-500">en {money_.count} gastos esta semana (sin fijos pagados desde huchas)</p>
            </div>
            <div className="space-y-2">
              {money_.top.map(([id, v]) => {
                const c = catMap.get(id)
                return (
                  <div key={id} className="flex justify-between text-sm">
                    <span>
                      {c?.icon} {c?.name ?? 'Sin categoría'}
                    </span>
                    <span className="tabular-nums">{money(v)}</span>
                  </div>
                )
              })}
            </div>
            <p className={cx('rounded-xl p-3 text-sm', pace.vsPace >= 0 ? 'bg-emerald-500/10 text-emerald-800 dark:text-emerald-300' : 'bg-amber-500/10 text-amber-800 dark:text-amber-300')}>
              {pace.vsPace >= 0
                ? `En el mes vas ${money0(pace.vsPace)} por debajo del ritmo de tu presupuesto variable. 👏`
                : `En el mes vas ${money0(-pace.vsPace)} por encima del ritmo de tu presupuesto variable.`}
            </p>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-3">
            <h4 className="text-lg font-semibold">💪 ¿Qué hábitos cumpliste?</h4>
            <p className="text-sm text-slate-500">
              {habits.filter((x) => x.p.met).length} de {habits.length} objetivos semanales cumplidos.
            </p>
            {habits.map(({ h, p }) => (
              <div key={h.id} className="flex items-center gap-3 text-sm">
                <span className="text-xl">{h.icon}</span>
                <span className="flex-1">{h.name}</span>
                <span className={cx('tabular-nums', p.met ? 'font-semibold text-emerald-600 dark:text-emerald-400' : 'text-slate-500')}>
                  {Math.round(p.done * 10) / 10}/{p.target} {p.met ? '✓' : ''}
                </span>
              </div>
            ))}
            <div className="flex items-center gap-4 rounded-2xl bg-slate-100 p-3 dark:bg-white/5">
              <ScoreRing value={score.score} size={60} />
              <p className="text-xs text-slate-500">Tu puntuación de la semana: 70 % hábitos + 30 % dinero.</p>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <h4 className="text-lg font-semibold">🪞 ¿Cómo fue la semana?</h4>
            <div className="flex justify-between">
              {MOODS.map((m, i) => (
                <button key={m} onClick={() => setMood(i + 1)} className={cx('grid h-12 w-12 place-items-center rounded-2xl text-2xl transition', mood === i + 1 ? 'scale-110 bg-emerald-500/20' : 'opacity-50')}>
                  {m}
                </button>
              ))}
            </div>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-500">✨ Qué salió bien</span>
              <textarea value={wins} onChange={(e) => setWins(e.target.value)} rows={3} placeholder="Fui 3 veces al gym, cené en casa…" className="w-full rounded-xl bg-slate-100 p-3 text-sm outline-none ring-emerald-500 focus:ring-2 dark:bg-white/5" />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-500">🔧 Qué mejorar</span>
              <textarea value={improve} onChange={(e) => setImprove(e.target.value)} rows={3} placeholder="Demasiado delivery, poca guitarra…" className="w-full rounded-xl bg-slate-100 p-3 text-sm outline-none ring-emerald-500 focus:ring-2 dark:bg-white/5" />
            </label>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <h4 className="text-lg font-semibold">🎯 Tu foco para la próxima semana</h4>
            <p className="text-sm text-slate-500">Solo una cosa. La verás cada día en Inicio.</p>
            <textarea value={focus} onChange={(e) => setFocus(e.target.value)} rows={2} placeholder="Ej. Ir 3 veces al gimnasio" className="w-full rounded-xl bg-slate-100 p-3 text-base outline-none ring-emerald-500 focus:ring-2 dark:bg-white/5" />
            <div className="flex flex-wrap gap-2">
              {suggestions.map((s) => (
                <button key={s} onClick={() => setFocus(s)} className="rounded-full bg-slate-100 px-3 py-1.5 text-xs dark:bg-white/10">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="mt-6 flex gap-2">
        {step > 0 && (
          <Button variant="soft" onClick={() => setStep(step - 1)}>
            Atrás
          </Button>
        )}
        {step < 3 ? (
          <Button className="flex-1" onClick={() => setStep(step + 1)}>
            Siguiente
          </Button>
        ) : (
          <Button className="flex-1" disabled={!focus.trim()} onClick={save}>
            Guardar revisión
          </Button>
        )}
      </div>
    </div>
  )
}

export const reviewDue = (data: AppData) => {
  const w = reviewWeek()
  const dow = (new Date().getDay() + 6) % 7
  return { due: !data.reviews.some((r) => r.id === w.start) && (dow >= 4 || dow <= 1), weekStart: w.start }
}

/** Foco vigente: el de la revisión más reciente */
export const currentFocus = (data: AppData) => [...data.reviews].sort((a, b) => b.id.localeCompare(a.id))[0]

