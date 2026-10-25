/** Anillo de puntuación 0–100 */
export function ScoreRing({ value, size = 72 }: { value: number; size?: number }) {
  const r = 30
  const c = 2 * Math.PI * r
  const color = value >= 70 ? '#10b981' : value >= 40 ? '#f59e0b' : '#ef4444'
  return (
    <svg width={size} height={size} viewBox="0 0 72 72" role="img" aria-label={`Puntuación ${value} de 100`} className="shrink-0">
      <circle cx="36" cy="36" r={r} fill="none" stroke="currentColor" strokeWidth="7" className="text-slate-200 dark:text-white/10" />
      <circle
        cx="36"
        cy="36"
        r={r}
        fill="none"
        stroke={color}
        strokeWidth="7"
        strokeLinecap="round"
        strokeDasharray={`${(c * Math.min(100, value)) / 100} ${c}`}
        transform="rotate(-90 36 36)"
      />
      <text x="36" y="41" textAnchor="middle" fontSize="18" fontWeight="700" fill="currentColor">
        {value}
      </text>
    </svg>
  )
}
