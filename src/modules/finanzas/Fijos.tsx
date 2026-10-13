import { ArrowLeft, Check, Plus } from 'lucide-react'
import { useState } from 'react'
import { go } from '../../app/router'
import { db } from '../../db/schema'
import type { AppData } from '../../db/hooks'
import { recurringStatus } from '../../lib/calc'
import { monthKey, today } from '../../lib/dates'
import { money, parseAmount, round2, uid } from '../../lib/format'
import type { Recurring, TxKind } from '../../types'
import { useToast } from '../../components/Toast'
import { Button, Card, CatIcon, cx, Field, Input, PageHeader, Segmented, SectionTitle, Sheet, Toggle } from '../../components/ui'

export function Fijos({ data }: { data: AppData }) {
  const [edit, setEdit] = useState<Partial<Recurring> | null>(null)
  const key = monthKey(today())
  const status = recurringStatus(data.recurrings, data.transactions, key)
  const inactive = data.recurrings.filter((r) => !r.active)
  const totalOut = data.recurrings.filter((r) => r.active && r.kind === 'gasto').reduce((s, r) => s + r.amount, 0)

  return (
    <div>
      <button onClick={() => go('inicio')} className="flex items-center gap-1 pt-2 text-sm text-slate-500">
        <ArrowLeft size={16} /> Inicio
      </button>
      <PageHeader title="Fijos y recurrentes" right={<Button className="flex items-center gap-1 py-2" onClick={() => setEdit({ kind: 'gasto', dayOfMonth: 1, active: true })}><Plus size={16} /> Nuevo</Button>} />
      <p className="px-1 text-xs text-slate-500 dark:text-slate-400">
        Cada mes aparecen en Inicio para marcarlos con un toque. Gastos fijos activos: <b>{money(totalOut)}/mes</b>.
      </p>

      <SectionTitle>Este mes</SectionTitle>
      <Card className="divide-y divide-slate-100 p-0 dark:divide-white/5">
        {status.map(({ recurring: r, paid, overdue }) => {
          const c = data.catMap.get(r.categoryId ?? '')
          return (
            <button key={r.id} onClick={() => setEdit(r)} className="flex w-full items-center gap-3 px-4 py-3 text-left">
              <CatIcon icon={c?.icon ?? '📌'} color={c?.color ?? '#94a3b8'} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">{r.name}</p>
                <p className="text-[11px] text-slate-500">
                  Día {r.dayOfMonth} · {r.kind === 'ingreso' ? 'ingreso' : r.kind === 'transferencia' ? 'a hucha' : 'gasto'}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold tabular-nums">{money(r.amount)}</p>
                <p className={cx('text-[11px]', paid ? 'text-emerald-600 dark:text-emerald-400' : overdue ? 'text-amber-500' : 'text-slate-400')}>
                  {paid ? (
                    <span className="inline-flex items-center gap-0.5">
                      <Check size={11} /> {money(paid.amount)}
                    </span>
                  ) : overdue ? 'Pendiente' : 'Próximo'}
                </p>
              </div>
            </button>
          )
        })}
      </Card>

      {inactive.length > 0 && (
        <>
          <SectionTitle>Pausados</SectionTitle>
          <Card className="divide-y divide-slate-100 p-0 opacity-70 dark:divide-white/5">
            {inactive.map((r) => (
              <button key={r.id} onClick={() => setEdit(r)} className="flex w-full justify-between px-4 py-3 text-left text-sm">
                <span>{r.name}</span>
                <span className="tabular-nums">{money(r.amount)}</span>
              </button>
            ))}
          </Card>
        </>
      )}

      <Sheet open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? 'Editar fijo' : 'Nuevo fijo'}>
        {edit && <RecurringEditor key={edit.id ?? 'new'} data={data} initial={edit} onDone={() => setEdit(null)} />}
      </Sheet>
    </div>
  )
}

function RecurringEditor({ data, initial, onDone }: { data: AppData; initial: Partial<Recurring>; onDone: () => void }) {
  const toast = useToast()
  const [name, setName] = useState(initial.name ?? '')
  const [amount, setAmount] = useState(initial.amount ? String(initial.amount).replace('.', ',') : '')
  const [kind, setKind] = useState<TxKind>(initial.kind ?? 'gasto')
  const [categoryId, setCategoryId] = useState(initial.categoryId ?? '')
  const [fundId, setFundId] = useState(initial.fundId ?? '')
  const [day, setDay] = useState(String(initial.dayOfMonth ?? 1))
  const [active, setActive] = useState(initial.active ?? true)

  const cats = data.categories.filter((c) => !c.archived && (kind === 'ingreso' ? c.type === 'ingreso' : kind === 'gasto' ? c.type === 'fijo' || c.type === 'variable' : false))
  const valid = name.trim() && parseAmount(amount) > 0 && (kind === 'transferencia' ? fundId : categoryId)

  const save = async () => {
    if (!valid) return
    await db.recurrings.put({
      id: initial.id ?? uid(),
      name: name.trim(),
      amount: round2(parseAmount(amount)),
      kind,
      categoryId: kind === 'transferencia' ? data.categories.find((c) => c.fundId === fundId)?.id : categoryId,
      fundId: kind === 'transferencia' ? fundId : undefined,
      dayOfMonth: Math.min(31, Math.max(1, Number(day) || 1)),
      active,
    })
    toast({ text: 'Guardado' })
    onDone()
  }

  const remove = async () => {
    if (!initial.id) return
    await db.recurrings.delete(initial.id)
    toast({ text: 'Fijo borrado (los movimientos pasados se mantienen)' })
    onDone()
  }

  return (
    <div className="space-y-4">
      <Segmented
        value={kind}
        onChange={(k) => {
          setKind(k)
          setCategoryId('')
        }}
        options={[
          { value: 'gasto', label: 'Gasto' },
          { value: 'ingreso', label: 'Ingreso' },
          { value: 'transferencia', label: 'A hucha' },
        ]}
      />
      <Field label="Nombre">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. Netflix" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Importe (€)" hint="Si varía, pon el habitual">
          <Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" />
        </Field>
        <Field label="Día del mes">
          <Input inputMode="numeric" value={day} onChange={(e) => setDay(e.target.value.replace(/\D/g, ''))} />
        </Field>
      </div>
      {kind === 'transferencia' ? (
        <Field label="Hucha">
          <select value={fundId} onChange={(e) => setFundId(e.target.value)} className="w-full rounded-xl bg-slate-100 px-3 py-2.5 text-sm dark:bg-white/5">
            <option value="">Elige…</option>
            {data.funds.filter((f) => !f.archived).map((f) => (
              <option key={f.id} value={f.id}>{f.icon} {f.name}</option>
            ))}
          </select>
        </Field>
      ) : (
        <Field label="Categoría">
          <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="w-full rounded-xl bg-slate-100 px-3 py-2.5 text-sm dark:bg-white/5">
            <option value="">Elige…</option>
            {cats.map((c) => (
              <option key={c.id} value={c.id}>{c.parentId ? '   ' : ''}{c.icon} {c.name}</option>
            ))}
          </select>
        </Field>
      )}
      <Toggle checked={active} onChange={setActive} label="Activo" hint="Desactívalo para pausarlo sin borrarlo." />
      <Button className="w-full" disabled={!valid} onClick={save}>Guardar</Button>
      {initial.id && <Button variant="danger" className="w-full" onClick={remove}>Borrar</Button>}
    </div>
  )
}
