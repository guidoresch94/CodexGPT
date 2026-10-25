import type { AppData } from '../db/hooks'
import type { DateStr, ID } from '../types'
import { fmtDayLong, today } from './dates'
import { capability } from './platform'

/**
 * IA con Claude (capacidad `sample` del visor de artefactos): usa la cuenta
 * de Claude de quien mira la página. Fuera de Claude no está disponible.
 */

interface SampleOpts {
  signal?: AbortSignal
  modelTier?: 'quick' | 'default' | 'complex'
  images?: Blob | Blob[]
  cache?: boolean
}
export interface SampleFn {
  (input: string, opts?: SampleOpts): Promise<{ text: string }>
  json<T>(input: string, opts?: SampleOpts): Promise<T>
  limits(): Promise<{ images?: { maxCount: number; mediaTypes: string[] } }>
}

export const getAI = () => capability<SampleFn>('sample')

export function aiErrorText(e: unknown) {
  const code = (e as { code?: string })?.code
  switch (code) {
    case 'cancelled':
      return ''
    case 'not_granted':
    case 'sampling_disabled':
    case 'not_declared':
      return 'Para usar la IA tenés que permitir que la app use Claude.'
    case 'rate_limited':
      return 'Demasiadas consultas seguidas. Probá de nuevo en un rato.'
    case 'invalid_json':
    case 'empty_completion':
      return 'No entendí bien la respuesta. Probá de nuevo o escribilo de otra forma.'
    case 'prompt_too_large':
      return 'Es demasiado texto de una vez. Pegá menos filas.'
    case 'image_rejected':
      return 'No pude leer esa imagen. Probá con otra foto.'
    case 'refused':
      return 'La IA no quiso procesar eso. Probá con otro texto.'
    default:
      return 'No se pudo ahora. Probá de nuevo.'
  }
}

const catalog = (data: AppData) =>
  data.categories
    .filter((c) => !c.archived)
    .map((c) => `${c.id}: ${c.name} (${c.type === 'ingreso' ? 'ingreso' : 'gasto'})`)
    .join('\n')

export interface Draft {
  date: DateStr
  amount: number
  kind: 'gasto' | 'ingreso'
  categoryId?: ID
  note: string
  refund: boolean
  confidence: number
}

/** Texto libre, filas pegadas de un Excel o la foto de un ticket → movimientos */
export async function aiParseMovements(ai: SampleFn, text: string, images: Blob[], data: AppData, signal?: AbortSignal): Promise<Draft[]> {
  const prompt = `Sos el asistente de una app personal de gastos (España, euros). Hoy es ${fmtDayLong(today())} (${today()}).
Convertí lo que manda el usuario en movimientos de dinero.

Categorías disponibles (id: nombre):
${catalog(data)}

Reglas:
- Un elemento por cada gasto o ingreso. Si es una tabla pegada (Excel, CSV, extracto), cada fila con importe es un movimiento; ignorá saldos, totales y cabeceras.
- "amount": número positivo en euros. "kind": "gasto" o "ingreso".
- "refund": true si es plata que le devolvieron por un gasto compartido (ej. "me pasaron 8 € de las birras", "Bizum recibido"); en ese caso kind = "gasto" y la categoría es la del gasto original.
- "date": AAAA-MM-DD. Resolvé "ayer", "el sábado", "el 3". Si no hay fecha, usá hoy.
- "categoryId": el id exacto de la lista que mejor encaje, o null si no hay forma de saberlo.
- "note": descripción corta y clara en español (ej. "Pádel con Tomás", "Súper Lidl"). Si hay un comercio, nombralo.
- "confidence": 0 a 1, qué tan seguro estás de la categoría.
${images.length ? '- La imagen es un ticket, factura o captura del banco: extraé de ahí los movimientos (un ticket es un solo gasto con su total).\n' : ''}
Respondé solo con un array JSON, por ejemplo:
[{"date":"${today()}","amount":12,"kind":"gasto","categoryId":"id","note":"Pádel con Tomás","refund":false,"confidence":0.9}]

Lo que mandó el usuario:
"""
${text.slice(0, 30000) || '(solo la imagen)'}
"""`
  const raw = await ai.json<unknown>(prompt, { signal, images: images.length ? images : undefined, cache: false })
  const ids = new Set(data.categories.map((c) => c.id))
  const list = Array.isArray(raw) ? raw : []
  return list
    .map((r) => {
      const o = (r ?? {}) as Record<string, unknown>
      const amount = Math.abs(Number(o.amount))
      const date = /^\d{4}-\d{2}-\d{2}$/.test(String(o.date)) ? String(o.date) : today()
      const cat = typeof o.categoryId === 'string' && ids.has(o.categoryId) ? o.categoryId : undefined
      return {
        date,
        amount: Math.round(amount * 100) / 100,
        kind: o.kind === 'ingreso' ? 'ingreso' : 'gasto',
        categoryId: cat,
        note: String(o.note ?? '').slice(0, 80),
        refund: o.refund === true,
        confidence: Math.max(0, Math.min(1, Number(o.confidence) || 0)),
      } as Draft
    })
    .filter((d) => d.amount > 0 && Number.isFinite(d.amount))
}

export interface GroupHint {
  categoryId?: ID
  note?: string
  reason: string
}

/** Comercios raros del extracto → categoría sugerida y una nota que explique qué es */
export async function aiClassifyGroups(
  ai: SampleFn,
  groups: { key: string; label: string; examples: string[]; count: number; total: number; income: boolean }[],
  data: AppData,
  signal?: AbortSignal,
): Promise<Record<string, GroupHint>> {
  const prompt = `Sos el asistente de una app de gastos de una persona que vive en Barcelona. Clasificá estos comercios de su extracto bancario.

Categorías disponibles (id: nombre):
${catalog(data)}

Comercios (clave, texto del banco, ejemplos de detalle, veces, total en €):
${groups.map((g) => `- ${JSON.stringify(g.key)} | ${g.label} | ${g.examples.slice(0, 2).join(' / ')} | ${g.count} veces | ${g.total.toFixed(2)} €${g.income ? ' | es un ingreso' : ''}`).join('\n')}

Pistas: importes chicos (1–4 €) repetidos suelen ser café o panadería; "Ret. efectivo" es sacar efectivo (si no hay categoría clara, null); un Bizum enviado a un amigo suele ser salir a comer o un deporte según el concepto.
Para cada comercio devolvé la categoría (id exacto o null si no se puede saber), una nota corta de qué es (ej. "Cafetería", "Kiosco") y el motivo en pocas palabras.
Respondé solo con un array JSON: [{"key":"clave","categoryId":"id o null","note":"Cafetería","reason":"importes de café, nombre de bar"}]`
  const raw = await ai.json<unknown>(prompt, { signal, modelTier: 'quick' })
  const ids = new Set(data.categories.map((c) => c.id))
  const out: Record<string, GroupHint> = {}
  for (const r of Array.isArray(raw) ? raw : []) {
    const o = (r ?? {}) as Record<string, unknown>
    const key = String(o.key ?? '')
    if (!key) continue
    out[key] = {
      categoryId: typeof o.categoryId === 'string' && ids.has(o.categoryId) ? o.categoryId : undefined,
      note: o.note ? String(o.note).slice(0, 40) : undefined,
      reason: String(o.reason ?? '').slice(0, 120),
    }
  }
  return out
}
