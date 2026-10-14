import { cx } from './ui'

const EMOJIS = [
  '🏠', '💡', '⚡', '💧', '🌐', '🔥', '🛒', '🍻', '🍕', '🍔', '☕', '🥐', '🚲', '🚇', '🚕', '🛵', '⛽', '🏋️', '🎾', '🏀', '🏃', '🧘',
  '🛍️', '👕', '💻', '📱', '🎧', '🎮', '📚', '🎬', '🎸', '🎨', '🎟️', '🚬', '💊', '🩺', '🧯', '🐷', '✈️', '🏖️', '🎁', '💼', '💶',
  '🤝', '🐶', '👶', '💇', '🧺', '🛋️', '📦', '🛟', '🎓', '🏍️', '🚗', '🧾', '💳', '🏦', '❤️', '⭐',
]

const COLORS = ['#34d399', '#22c55e', '#10b981', '#14b8a6', '#06b6d4', '#38bdf8', '#60a5fa', '#6366f1', '#a78bfa', '#ec4899', '#ef4444', '#f97316', '#f59e0b', '#facc15', '#a3e635', '#94a3b8']

export function EmojiPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-11 w-14 rounded-xl bg-ios-fill text-center text-2xl outline-none"
          aria-label="Emoji personalizado"
        />
        <span className="text-xs text-slate-500 dark:text-slate-400">Elegí uno o escribí cualquier emoji</span>
      </div>
      <div className="grid grid-cols-10 gap-1">
        {EMOJIS.map((e) => (
          <button
            key={e}
            type="button"
            onClick={() => onChange(e)}
            className={cx('grid h-8 place-items-center rounded-lg text-lg', value === e ? 'bg-emerald-500/25' : 'hover:bg-slate-100 dark:hover:bg-white/5')}
          >
            {e}
          </button>
        ))}
      </div>
    </div>
  )
}

export function ColorPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {COLORS.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          className={cx('h-7 w-7 rounded-full ring-offset-2 ring-offset-white dark:ring-offset-slate-900', value === c && 'ring-2 ring-slate-900 dark:ring-white')}
          style={{ background: c }}
          aria-label={c}
        />
      ))}
      <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="h-7 w-9 cursor-pointer rounded bg-transparent" aria-label="Color personalizado" />
    </div>
  )
}
