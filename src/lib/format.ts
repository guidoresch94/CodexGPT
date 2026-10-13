const eur = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' })
const eur0 = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })

/** 1.234,56 € */
export const money = (n: number) => eur.format(n)
/** 1.235 € (sin decimales, para resúmenes) */
export const money0 = (n: number) => eur0.format(Math.round(n))

export const pct = (n: number) => `${Math.round(n)} %`

export const round2 = (n: number) => Math.round(n * 100) / 100

let counter = 0
/** Id único sin depender de crypto.randomUUID (no disponible en http por IP local) */
export const uid = () => `${Date.now().toString(36)}${(counter++).toString(36)}${Math.random().toString(36).slice(2, 8)}`

/** Convierte "12,5" o "12.5" en número */
export const parseAmount = (s: string) => {
  const clean = s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s
  const n = parseFloat(clean)
  return Number.isFinite(n) ? n : 0
}
