/** Número al estilo argentino: 1.234,56 (punto de miles, coma decimal) */
export function num(n: number, decimals = 0) {
  const fixed = Math.abs(n).toFixed(decimals)
  const [int, dec] = fixed.split('.')
  const withDots = int.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return `${n < 0 ? '−' : ''}${withDots}${dec ? `,${dec}` : ''}`
}

/** € 1.234,56 (formato argentino, en euros) */
export const money = (n: number) => `${n < 0 ? '−' : ''}€ ${num(Math.abs(n), 2)}`
/** € 1.235 (sin decimales, para resúmenes) */
export const money0 = (n: number) => `${Math.round(n) < 0 ? '−' : ''}€ ${num(Math.abs(Math.round(n)))}`

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
