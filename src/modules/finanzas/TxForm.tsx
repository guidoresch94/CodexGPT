import { Plus, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { db } from '../../db/schema'
import type { AppData } from '../../db/hooks'
import { usageRank } from '../../lib/calc'
import { toISO, today } from '../../lib/dates'
import { money, parseAmount, round2, uid } from '../../lib/format'
import type { Transaction, TxKind } from '../../types'
import { applyKey, NumPad } from '../../components/NumPad'
import { useToast } from '../../components/Toast'
import { Button, CatIcon, cx, Input, Segmented, Sheet, Toggle } from '../../components/ui'
import { CategoryEditor } from './CategoryEditor'

const fmtInput = (n?: number) => (n ? String(round2(n)).replace('.', ',') : '')

interface Props {
  data: AppData
  initial?: Partial<Transaction>
  onClose: () => void
}

export function TxForm({ data, initial, onClose }: Props) {
  const toast = useToast()
  const editing = !!initial?.id
  const [kind, setKind] = useState<TxKind>(initial?.kind ?? 'gasto')
  const [amount, setAmount] = useState(fmtInput(initial?.amount))
  const [categoryId, setCategoryId] = useState<string | undefined>(initial?.categoryId)
  const [fundId, setFundId] = useState<string | undefined>(initial?.fundId)
  const [date, setDate] = useState(initial?.date ?? today())
  const [note, setNote] = useState(initial?.note ?? '')
  const [method, setMethod] = useState(initial?.paymentMethod ?? '')
  const [shared, setShared] = useState(!!initial?.shared)
  const [myShare, setMyShare] = useState(fmtInput(initial?.shared?.myShare))
  const [more, setMore] = useState(editing && !!(initial?.note || initial?.shared || initial?.fundId || initial?.paymentMethod))
  const [newCat, setNewCat] = useState(false)

  const value = parseAmount(amount)
  const usage = useMemo(() => usageRank(data.transactions), [data.transactions])

  const options = useMemo(() => {
    const want = kind === 'ingreso' ? ['ingreso'] : ['fijo', 'variable']
    return data.categories
      .filter((c) => !c.archived && want.includes(c.type))
      .sort((a, b) => (usage.get(b.id) ?? 0) - (usage.get(a.id) ?? 0) || a.order - b.order)
  }, [data.categories, kind, usage])

  const funds = data.funds.filter((f) => !f.archived)

  const changeKind = (k: TxKind) => {
    setKind(k)
    setCategoryId(undefined)
    setFundId(undefined)
  }

  const canSave = value > 0 && (kind === 'transferencia' ? !!fundId : !!categoryId)

  const save = async () => {
    if (!canSave) return
    const share = parseAmount(myShare)
    const tx: Transaction = {
      id: initial?.id ?? uid(),
      createdAt: initial?.createdAt ?? Date.now(),
      date,
      amount: round2(value),
      kind,
      categoryId: kind === 'transferencia' ? data.categories.find((c) => c.fundId === fundId)?.id : categoryId,
      fundId: kind === 'ingreso' ? undefined : fundId,
      note: note.trim() || undefined,
      paymentMethod: method || undefined,
      shared: kind === 'gasto' && shared && share >= 0 && share < value ? { total: round2(value), myShare: round2(share) } : undefined,
      recurringId: initial?.recurringId,
    }
    await db.transactions.put(tx)
    onClose()
    if (!editing) {
      const label = kind === 'gasto' ? 'Gasto' : kind === 'ingreso' ? 'Ingreso' : 'Aportación'
      toast({ text: `${label} de ${money(tx.amount)} guardado`, action: { label: 'Deshacer', run: () => db.transactions.delete(tx.id) } })
    }
  }

  const remove = async () => {
    if (!initial?.id) return
    const old = await db.transactions.get(initial.id)
    await db.transactions.delete(initial.id)
    onClose()
    if (old) toast({ text: 'Movimiento borrado', action: { label: 'Deshacer', run: () => db.transactions.put(old) } })
  }

  const yesterday = toISO(new Date(Date.now() - 864e5))

  return (
    <div className="flex h-full flex-col gap-3">
      <Segmented
        value={kind}
        onChange={changeKind}
        options={[
          { value: 'gasto', label: 'Gasto' },
          { value: 'ingreso', label: 'Ingreso' },
          { value: 'transferencia', label: 'A hucha' },
        ]}
      />

      <div className="text-center">
        <div className={cx('text-5xl font-bold tabular-nums tracking-tight', value ? 'text-slate-900 dark:text-white' : 'text-slate-300 dark:text-slate-600')}>
          {amount || '0'} €
        </div>
        {shared && kind === 'gasto' && value > 0 && (
          <div className="mt-1 text-xs text-emerald-600 dark:text-emerald-400">Mi parte: {money(parseAmount(myShare))}</div>
        )}
      </div>

      <div className="-mx-1 min-h-0 flex-1 overflow-y-auto px-1">
        {kind === 'transferencia' ? (
          <div className="grid grid-cols-2 gap-2">
            {funds.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFundId(f.id)}
                className={cx('flex items-center gap-2 rounded-2xl p-2 text-left text-sm ring-2 transition', fundId === f.id ? 'ring-emerald-500 bg-emerald-500/10' : 'ring-transparent bg-slate-100 dark:bg-white/5')}
              >
                <CatIcon icon={f.icon} color={f.color} size="sm" />
                <span className="line-clamp-2 text-slate-800 dark:text-slate-100">{f.name}</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-2">
            {options.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCategoryId(c.id)}
                className={cx(
                  'flex flex-col items-center gap-1 rounded-2xl px-1 py-2 ring-2 transition active:scale-95',
                  categoryId === c.id ? 'ring-emerald-500 bg-emerald-500/10' : 'ring-transparent',
                )}
              >
                <CatIcon icon={c.icon} color={c.color} />
                <span className="line-clamp-2 text-center text-[11px] leading-tight text-slate-700 dark:text-slate-300">{c.name}</span>
              </button>
            ))}
            <button type="button" onClick={() => setNewCat(true)} className="flex flex-col items-center gap-1 rounded-2xl px-1 py-2">
              <span className="grid h-10 w-10 place-items-center rounded-2xl border-2 border-dashed border-slate-300 text-slate-400 dark:border-white/15">
                <Plus size={18} />
              </span>
              <span className="text-[11px] text-slate-500">Nueva</span>
            </button>
          </div>
        )}

        <button type="button" onClick={() => setMore(!more)} className="mt-3 w-full py-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
          {more ? 'Menos opciones' : 'Fecha, nota, método, compartido…'}
        </button>

        {more && (
          <div className="mt-2 space-y-3 rounded-2xl bg-slate-50 p-3 dark:bg-white/[0.03]">
            <div className="flex flex-wrap items-center gap-2">
              {[
                { d: today(), l: 'Hoy' },
                { d: yesterday, l: 'Ayer' },
              ].map((o) => (
                <button key={o.l} type="button" onClick={() => setDate(o.d)} className={cx('rounded-full px-3 py-1 text-xs', date === o.d ? 'bg-emerald-500 text-slate-950' : 'bg-slate-200 dark:bg-white/10')}>
                  {o.l}
                </button>
              ))}
              <input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} className="rounded-lg bg-slate-200 px-2 py-1 text-xs dark:bg-white/10 dark:[color-scheme:dark]" />
            </div>
            <Input placeholder="Nota (opcional)" value={note} onChange={(e) => setNote(e.target.value)} />
            <div className="flex flex-wrap gap-2">
              {data.settings.paymentMethods.map((m) => (
                <button key={m} type="button" onClick={() => setMethod(method === m ? '' : m)} className={cx('rounded-full px-3 py-1 text-xs', method === m ? 'bg-emerald-500 text-slate-950' : 'bg-slate-200 dark:bg-white/10')}>
                  {m}
                </button>
              ))}
            </div>
            {kind === 'gasto' && (
              <>
                <Toggle checked={shared} onChange={setShared} label="Gasto compartido" hint="Pagaste tú y te devuelven (Bizum). Solo cuenta tu parte." />
                {shared && (
                  <div className="flex items-center gap-2">
                    <Input inputMode="decimal" placeholder="Mi parte €" value={myShare} onChange={(e) => setMyShare(e.target.value)} />
                    {[2, 3, 4].map((n) => (
                      <button key={n} type="button" onClick={() => setMyShare(fmtInput(value / n))} className="rounded-lg bg-slate-200 px-2.5 py-2 text-xs dark:bg-white/10">
                        ÷{n}
                      </button>
                    ))}
                  </div>
                )}
                <label className="block text-sm">
                  <span className="mb-1 block text-xs text-slate-500 dark:text-slate-400">Pagar desde una hucha (no cuenta en el presupuesto del mes)</span>
                  <select value={fundId ?? ''} onChange={(e) => setFundId(e.target.value || undefined)} className="w-full rounded-xl bg-slate-200 px-3 py-2 text-sm dark:bg-white/10">
                    <option value="">No, del presupuesto mensual</option>
                    {funds.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.icon} {f.name}
                      </option>
                    ))}
                  </select>
                </label>
              </>
            )}
          </div>
        )}
      </div>

      <NumPad onKey={(k) => setAmount((v) => applyKey(v, k))} />
      <div className="flex gap-2">
        {editing && (
          <Button variant="danger" onClick={remove} aria-label="Borrar">
            <Trash2 size={18} />
          </Button>
        )}
        <Button className="flex-1 py-3.5 text-base" disabled={!canSave} onClick={save}>
          {!value ? 'Escribe el importe' : !canSave ? (kind === 'transferencia' ? 'Elige una hucha' : 'Elige una categoría') : editing ? 'Guardar cambios' : 'Guardar'}
        </Button>
      </div>

      <Sheet open={newCat} onClose={() => setNewCat(false)} title="Nueva categoría">
        <CategoryEditor
          data={data}
          initial={{ type: kind === 'ingreso' ? 'ingreso' : 'variable' }}
          onSaved={(id) => {
            setCategoryId(id)
            setNewCat(false)
          }}
        />
      </Sheet>
    </div>
  )
}
