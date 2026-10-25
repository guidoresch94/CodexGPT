import { useEffect, useRef, useState, type ReactNode } from 'react'

const reduced = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/** Número que cuenta hasta su valor (como en Apple Wallet) */
export function CountUp({ value, format, duration = 700 }: { value: number; format: (n: number) => string; duration?: number }) {
  const [shown, setShown] = useState(value)
  const from = useRef(value)
  useEffect(() => {
    if (reduced()) return setShown(value)
    const start = performance.now()
    const a = from.current
    let raf = 0
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration)
      const e = 1 - Math.pow(1 - p, 3)
      setShown(a + (value - a) * e)
      if (p < 1) raf = requestAnimationFrame(tick)
      else from.current = value
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value, duration])
  return <>{format(shown)}</>
}

/** Anillo de progreso alrededor de un contenido (emoji, número…) */
export function Ring({ value, size = 56, stroke = 5, color, track, children }: { value: number; size?: number; stroke?: number; color: string; track?: string; children?: ReactNode }) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const v = Math.max(0, Math.min(1, value))
  return (
    <span className="relative inline-grid shrink-0 place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="absolute inset-0 -rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track ?? color} strokeOpacity={track ? 1 : 0.18} strokeWidth={stroke} />
        {v > 0 && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${c * v} ${c}`}
            style={{ transition: 'stroke-dasharray .9s cubic-bezier(.32,.72,0,1)' }}
          />
        )}
      </svg>
      <span className="relative">{children}</span>
    </span>
  )
}

/** Explosión de partículas en la posición de un toque (para celebrar un check-in) */
export function burst(x: number, y: number, color = '#34c759') {
  if (reduced()) return
  const host = document.createElement('div')
  host.style.cssText = `position:fixed;left:${x}px;top:${y}px;pointer-events:none;z-index:80`
  for (let i = 0; i < 14; i++) {
    const p = document.createElement('span')
    const ang = (Math.PI * 2 * i) / 14 + Math.random() * 0.4
    const dist = 28 + Math.random() * 30
    const colors = [color, '#ff9500', '#0a84ff', '#ff2d55', '#ffcc00']
    p.style.cssText = `position:absolute;width:7px;height:7px;border-radius:${i % 2 ? '2px' : '50%'};background:${colors[i % colors.length]};left:-3px;top:-3px;transition:transform .6s cubic-bezier(.2,.8,.2,1),opacity .6s ease-out`
    host.appendChild(p)
    requestAnimationFrame(() => {
      p.style.transform = `translate(${Math.cos(ang) * dist}px,${Math.sin(ang) * dist}px) scale(.6)`
      p.style.opacity = '0'
    })
  }
  document.body.appendChild(host)
  setTimeout(() => host.remove(), 700)
}

/** Aparición suave al cambiar de pantalla */
export function Page({ id, children }: { id: string; children: ReactNode }) {
  return (
    <div key={id} className="animate-page">
      {children}
    </div>
  )
}

/** Degradado del momento del día para la tarjeta principal */
export function skyGradient(d = new Date()) {
  const h = d.getHours()
  if (h < 7) return 'linear-gradient(135deg,#1e1b4b 0%,#4338ca 55%,#7c3aed 100%)'
  if (h < 12) return 'linear-gradient(135deg,#ff9a62 0%,#ff5e8a 50%,#a855f7 100%)'
  if (h < 18) return 'linear-gradient(135deg,#0ea5e9 0%,#3b82f6 50%,#6366f1 100%)'
  if (h < 21) return 'linear-gradient(135deg,#f97316 0%,#db2777 50%,#7c3aed 100%)'
  return 'linear-gradient(135deg,#0f172a 0%,#312e81 55%,#6d28d9 100%)'
}
