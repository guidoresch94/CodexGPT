import {
  addDays,
  differenceInCalendarDays,
  endOfMonth,
  endOfWeek,
  format,
  getDaysInMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
} from 'date-fns'
import { es } from 'date-fns/locale'
import type { DateStr } from '../types'

const WEEK = { weekStartsOn: 1 as const }

export const toISO = (d: Date): DateStr => format(d, 'yyyy-MM-dd')
export const today = (): DateStr => toISO(new Date())
export const fromISO = (s: DateStr) => parseISO(s)

/** Mes en formato AAAA-MM */
export const monthKey = (d: Date | DateStr) => (typeof d === 'string' ? d.slice(0, 7) : format(d, 'yyyy-MM'))

export const monthRange = (key: string) => {
  const d = parseISO(`${key}-01`)
  return { start: toISO(startOfMonth(d)), end: toISO(endOfMonth(d)), days: getDaysInMonth(d) }
}

export const shiftMonth = (key: string, delta: number) => {
  const d = parseISO(`${key}-01`)
  return format(new Date(d.getFullYear(), d.getMonth() + delta, 1), 'yyyy-MM')
}

export const weekRange = (ref: Date = new Date()) => ({
  start: toISO(startOfWeek(ref, WEEK)),
  end: toISO(endOfWeek(ref, WEEK)),
})

/** Días que quedan en la semana contando hoy (lunes = 7, domingo = 1) */
export const daysLeftInWeek = (ref: Date = new Date()) => differenceInCalendarDays(endOfWeek(ref, WEEK), ref) + 1

/** Los 7 días (ISO) de la semana de ref */
export const weekDays = (ref: Date = new Date()) => {
  const start = startOfWeek(ref, WEEK)
  return Array.from({ length: 7 }, (_, i) => toISO(addDays(start, i)))
}

export const fmtDate = (s: DateStr) => format(parseISO(s), 'dd/MM/yyyy')
export const fmtDayShort = (s: DateStr) => format(parseISO(s), 'EEE d', { locale: es })
export const fmtDayLong = (s: DateStr) => format(parseISO(s), "EEEE d 'de' MMMM", { locale: es })
export const fmtMonth = (key: string) => format(parseISO(`${key}-01`), 'MMMM yyyy', { locale: es })
export const fmtMonthShort = (key: string) => format(parseISO(`${key}-01`), 'MMM', { locale: es })
export const weekdayInitial = (s: DateStr) => format(parseISO(s), 'EEEEE', { locale: es }).toUpperCase()

export const daysBetween = (a: DateStr, b: DateStr) => differenceInCalendarDays(parseISO(b), parseISO(a))

/** Fecha de un día concreto del mes (ajustado al último día si no existe) */
export const dayInMonth = (key: string, day: number): DateStr => {
  const { days } = monthRange(key)
  return `${key}-${String(Math.min(day, days)).padStart(2, '0')}`
}
