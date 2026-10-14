/** Anillos concéntricos al estilo Apple Fitness. value: 0–1 (se dibuja hasta 1) */
export interface Ring {
  value: number
  color: string
  label: string
}

export function Rings({ rings, size = 120 }: { rings: Ring[]; size?: number }) {
  const stroke = size * 0.11
  const gap = stroke * 0.18
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={rings.map((r) => `${r.label} ${Math.round(r.value * 100)} %`).join(', ')} className="shrink-0">
      {rings.map((r, i) => {
        const radius = size / 2 - stroke / 2 - i * (stroke + gap)
        const c = 2 * Math.PI * radius
        const v = Math.max(0, Math.min(1, r.value))
        return (
          <g key={r.label} transform={`rotate(-90 ${size / 2} ${size / 2})`}>
            <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={r.color} strokeOpacity={0.2} strokeWidth={stroke} />
            {v > 0 && (
              <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={r.color}
                strokeWidth={stroke}
                strokeLinecap="round"
                strokeDasharray={`${Math.max(0.001, c * v)} ${c}`}
                style={{ transition: 'stroke-dasharray 0.8s cubic-bezier(0.32,0.72,0,1)' }}
              />
            )}
          </g>
        )
      })}
    </svg>
  )
}

export const RING_COLORS = { habitos: '#ff2d55', gasto: '#34c759', ahorro: '#0a84ff' }
