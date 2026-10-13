import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { useEffect, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from 'react'
import { level, type Level } from '../lib/calc'
import { fmtMonth } from '../lib/dates'

export const cx = (...c: (string | false | undefined | null)[]) => c.filter(Boolean).join(' ')

export function Card({ children, className, onClick }: { children: ReactNode; className?: string; onClick?: () => void }) {
  return (
    <div
      onClick={onClick}
      className={cx(
        'rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-white/5 dark:shadow-none',
        onClick && 'cursor-pointer active:scale-[0.99] transition',
        className,
      )}
    >
      {children}
    </div>
  )
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-2 mt-6 flex items-center justify-between px-1">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">{children}</h2>
      {action}
    </div>
  )
}

type BtnVariant = 'primary' | 'ghost' | 'soft' | 'danger'
export function Button({ variant = 'primary', className, ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant }) {
  const styles: Record<BtnVariant, string> = {
    primary: 'bg-emerald-500 text-slate-950 hover:bg-emerald-400 font-semibold',
    soft: 'bg-slate-100 text-slate-800 hover:bg-slate-200 dark:bg-white/5 dark:text-slate-100 dark:hover:bg-white/10',
    ghost: 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/5',
    danger: 'bg-red-500/10 text-red-600 hover:bg-red-500/20 dark:text-red-400',
  }
  return (
    <button
      {...p}
      className={cx('rounded-2xl px-4 py-3 text-sm transition active:scale-[0.98] disabled:opacity-40', styles[variant], className)}
    />
  )
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-400 dark:text-slate-500">{hint}</span>}
    </label>
  )
}

export function Input({ className, ...p }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...p}
      className={cx(
        'w-full rounded-xl bg-slate-100 px-3 py-2.5 text-sm text-slate-900 outline-none ring-emerald-500 focus:ring-2 dark:bg-white/5 dark:text-slate-100',
        className,
      )}
    />
  )
}

export function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <button type="button" onClick={() => onChange(!checked)} className="flex w-full items-center justify-between gap-3 py-2 text-left">
      <span>
        <span className="block text-sm text-slate-800 dark:text-slate-100">{label}</span>
        {hint && <span className="block text-xs text-slate-500 dark:text-slate-400">{hint}</span>}
      </span>
      <span className={cx('relative h-6 w-11 shrink-0 rounded-full transition', checked ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-white/15')}>
        <span className={cx('absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition', checked ? 'left-5.5' : 'left-0.5')} />
      </span>
    </button>
  )
}

export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="flex rounded-2xl bg-slate-100 p-1 dark:bg-white/5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cx(
            'flex-1 rounded-xl px-3 py-2 text-sm transition',
            value === o.value ? 'bg-white font-semibold text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white' : 'text-slate-500 dark:text-slate-400',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

const barColor: Record<Level, string> = { ok: 'bg-emerald-500', warn: 'bg-amber-400', over: 'bg-red-500' }
export const levelText: Record<Level, string> = {
  ok: 'text-emerald-600 dark:text-emerald-400',
  warn: 'text-amber-600 dark:text-amber-400',
  over: 'text-red-600 dark:text-red-400',
}

/** fixed: para gastos fijos llegar al 100 % es lo normal (verde), solo pasarse es rojo */
export function ProgressBar({ value, max, color, thin, fixed }: { value: number; max: number; color?: string; thin?: boolean; fixed?: boolean }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : value > 0 ? 100 : 0
  const lvl = fixed && value <= max ? 'ok' : level(value, max)
  return (
    <div className={cx('w-full overflow-hidden rounded-full bg-slate-200 dark:bg-white/10', thin ? 'h-1.5' : 'h-2.5')}>
      <div className={cx('h-full rounded-full transition-all', !color && barColor[lvl])} style={{ width: `${pct}%`, background: color }} />
    </div>
  )
}

export function Sheet({ open, onClose, title, children, full }: { open: boolean; onClose: () => void; title?: ReactNode; children: ReactNode; full?: boolean }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px] animate-fade" onClick={onClose} />
      <div
        className={cx(
          'relative flex w-full max-w-lg flex-col rounded-t-3xl bg-white pb-[env(safe-area-inset-bottom)] shadow-2xl animate-up dark:bg-slate-900 sm:rounded-3xl',
          full ? 'h-[94dvh]' : 'max-h-[94dvh]',
        )}
      >
        <div className="flex items-center justify-between px-5 pb-2 pt-4">
          <h3 className="text-base font-semibold text-slate-900 dark:text-white">{title}</h3>
          <button onClick={onClose} className="rounded-full p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10" aria-label="Cerrar">
            <X size={20} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5">{children}</div>
      </div>
    </div>
  )
}

export function MonthSwitcher({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const shift = (d: number) => {
    const [y, m] = value.split('-').map(Number)
    const dt = new Date(y, m - 1 + d, 1)
    onChange(`${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`)
  }
  return (
    <div className="flex items-center justify-between rounded-2xl bg-white px-2 py-1.5 ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-white/5">
      <button onClick={() => shift(-1)} className="rounded-xl p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5" aria-label="Mes anterior">
        <ChevronLeft size={18} />
      </button>
      <span className="text-sm font-semibold capitalize text-slate-800 dark:text-slate-100">{fmtMonth(value)}</span>
      <button onClick={() => shift(1)} className="rounded-xl p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5" aria-label="Mes siguiente">
        <ChevronRight size={18} />
      </button>
    </div>
  )
}

export function Empty({ icon, text, children }: { icon: string; text: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 py-10 text-center text-sm text-slate-500 dark:text-slate-400">
      <span className="text-4xl">{icon}</span>
      <p>{text}</p>
      {children}
    </div>
  )
}

export function CatIcon({ icon, color, size = 'md' }: { icon: string; color: string; size?: 'sm' | 'md' | 'lg' }) {
  const s = { sm: 'h-8 w-8 text-base', md: 'h-10 w-10 text-lg', lg: 'h-12 w-12 text-2xl' }[size]
  return (
    <span className={cx('grid shrink-0 place-items-center rounded-2xl', s)} style={{ background: `${color}26` }}>
      {icon}
    </span>
  )
}

export function PageHeader({ title, subtitle, right }: { title: string; subtitle?: string; right?: ReactNode }) {
  return (
    <header className="flex items-end justify-between gap-3 pb-3 pt-2">
      <div>
        {subtitle && <p className="text-xs text-slate-500 first-letter:uppercase dark:text-slate-400">{subtitle}</p>}
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">{title}</h1>
      </div>
      {right}
    </header>
  )
}
