import { Delete } from 'lucide-react'

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', ',', '0', 'del']

/** Aplica una tecla al importe en texto (máx. 2 decimales, máx. 7 cifras) */
export function applyKey(value: string, key: string) {
  if (key === 'del') return value.slice(0, -1)
  if (key === ',') return value.includes(',') ? value : (value || '0') + ','
  const [int, dec] = value.split(',')
  if (dec !== undefined && dec.length >= 2) return value
  if (dec === undefined && int.length >= 7) return value
  if (value === '0') return key
  return value + key
}

export function NumPad({ onKey }: { onKey: (k: string) => void }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {KEYS.map((k) => (
        <button
          key={k}
          type="button"
          onClick={() => onKey(k)}
          className="grid h-12 place-items-center rounded-[12px] bg-ios-card text-[22px] font-normal transition active:bg-slate-300 dark:active:bg-slate-700"
          aria-label={k === 'del' ? 'Borrar' : k}
        >
          {k === 'del' ? <Delete size={22} /> : k}
        </button>
      ))}
    </div>
  )
}
