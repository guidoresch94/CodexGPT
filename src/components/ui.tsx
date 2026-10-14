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
        'rounded-[22px] bg-ios-card p-4',
        onClick && 'cursor-pointer transition active:scale-[0.985] active:opacity-90',
        className,
      )}
    >
      {children}
    </div>
  )
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-1.5 mt-7 flex items-end justify-between px-4">
      <h2 className="text-[13px] font-normal uppercase tracking-wide text-slate-500">{children}</h2>
      {action}
    </div>
  )
}

type BtnVariant = 'primary' | 'ghost' | 'soft' | 'danger'
export function Button({ variant = 'primary', className, ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant }) {
  const styles: Record<BtnVariant, string> = {
    primary: 'bg-accent text-white font-semibold hover:brightness-110',
    soft: 'bg-ios-fill text-accent font-medium',
    ghost: 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/5',
    danger: 'bg-red-500/10 text-red-600 hover:bg-red-500/20 dark:text-red-400',
  }
  return (
    <button
      {...p}
      className={cx('rounded-[14px] px-4 py-3 text-[15px] transition active:opacity-70 disabled:opacity-40', styles[variant], className)}
    />
  )
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block px-1 text-[13px] text-slate-500">{label}</span>
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
        'w-full rounded-[12px] bg-ios-fill px-3.5 py-3 text-[15px] text-slate-950 outline-none placeholder:text-slate-400 ring-accent focus:ring-2 dark:text-white',
        className,
      )}
    />
  )
}

export function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <button type="button" onClick={() => onChange(!checked)} className="flex w-full items-center justify-between gap-3 py-2 text-left">
      <span>
        <span className="block text-[15px]">{label}</span>
        {hint && <span className="block text-xs text-slate-500 dark:text-slate-400">{hint}</span>}
      </span>
      <span className={cx('relative h-[31px] w-[51px] shrink-0 rounded-full transition-colors', checked ? 'bg-emerald-500' : 'bg-ios-fill')}>
        <span className={cx('absolute top-[2px] h-[27px] w-[27px] rounded-full bg-white shadow-[0_3px_8px_rgba(0,0,0,0.15)] transition-all', checked ? 'left-[22px]' : 'left-[2px]')} />
      </span>
    </button>
  )
}

export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="flex rounded-[10px] bg-ios-fill p-[2px]">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cx(
            'flex-1 rounded-[8px] px-2 py-1.5 text-[13px] font-medium transition',
            value === o.value ? 'bg-white text-slate-950 shadow-[0_3px_8px_rgba(0,0,0,0.12),0_3px_1px_rgba(0,0,0,0.04)] dark:bg-slate-600 dark:text-white' : 'text-slate-950 dark:text-white',
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
    <div className={cx('w-full overflow-hidden rounded-full bg-ios-fill', thin ? 'h-1.5' : 'h-2.5')}>
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
      <div className="absolute inset-0 bg-black/40 animate-fade" onClick={onClose} />
      <div
        className={cx(
          'relative flex w-full max-w-lg flex-col rounded-t-[14px] bg-ios-bg pb-[env(safe-area-inset-bottom)] shadow-2xl animate-up sm:rounded-[14px]',
          full ? 'h-[94dvh]' : 'max-h-[94dvh]',
        )}
      >
        <div className="mx-auto mt-1.5 h-[5px] w-9 rounded-full bg-slate-300 dark:bg-slate-600" />
        <div className="relative flex items-center justify-center px-14 pb-3 pt-2.5">
          <h3 className="truncate text-[17px] font-semibold">{title}</h3>
          <button onClick={onClose} className="absolute right-4 grid h-[30px] w-[30px] place-items-center rounded-full bg-ios-fill text-slate-500" aria-label="Cerrar">
            <X size={16} strokeWidth={2.5} />
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
    <div className="flex items-center justify-between px-1">
      <button onClick={() => shift(-1)} className="grid h-9 w-9 place-items-center rounded-full text-accent active:bg-ios-fill" aria-label="Mes anterior">
        <ChevronLeft size={22} />
      </button>
      <span className="text-[17px] font-semibold first-letter:uppercase">{fmtMonth(value)}</span>
      <button onClick={() => shift(1)} className="grid h-9 w-9 place-items-center rounded-full text-accent active:bg-ios-fill" aria-label="Mes siguiente">
        <ChevronRight size={22} />
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
  const s = { sm: 'h-[30px] w-[30px] text-[15px] rounded-[8px]', md: 'h-9 w-9 text-lg rounded-[10px]', lg: 'h-12 w-12 text-2xl rounded-[13px]' }[size]
  return (
    <span className={cx('grid shrink-0 place-items-center', s)} style={{ background: `${color}2e` }}>
      {icon}
    </span>
  )
}

export function PageHeader({ title, subtitle, right }: { title: string; subtitle?: string; right?: ReactNode }) {
  return (
    <header className="flex items-end justify-between gap-3 px-1 pb-3 pt-3">
      <div className="min-w-0">
        {subtitle && <p className="text-[13px] font-semibold uppercase tracking-wide text-slate-500 first-letter:uppercase">{subtitle}</p>}
        <h1 className="text-[34px] font-bold leading-tight tracking-[-0.02em]">{title}</h1>
      </div>
      {right}
    </header>
  )
}

/** Lista agrupada estilo iOS: filas con separadores con sangría */
export function List({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx('overflow-hidden rounded-[22px] bg-ios-card [&>*+*]:border-t [&>*+*]:border-ios-sep', className)}>{children}</div>
}
