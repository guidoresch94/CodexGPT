import { Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useActions } from '../../app/actions'
import { db } from '../../db/schema'
import type { AppData } from '../../db/hooks'
import { fundBalance, fundEta, monthlyNeeded, savingsPlan } from '../../lib/calc'
import { fmtDate } from '../../lib/dates'
import { money, money0, parseAmount, pct, round2, uid } from '../../lib/format'
import type { Fund } from '../../types'
import { ColorPicker, EmojiPicker } from '../../components/Pickers'
import { useToast } from '../../components/Toast'
import { Button, Card, CatIcon, cx, Empty, Field, Input, List, ProgressBar, SectionTitle, Sheet } from '../../components/ui'
import { TxRow } from '../finanzas/Movimientos'

export function Ahorros({ data }: { data: AppData }) {
  const { openTx } = useActions()
  const [detail, setDetail] = useState<string | null>(null)
  const [edit, setEdit] = useState<Partial<Fund> | null>(null)
  const active = data.funds.filter((f) => !f.archived)
  const archived = data.funds.filter((f) => f.archived)
  const total = active.reduce((s, f) => s + fundBalance(f, data.transactions), 0)
  const plan = useMemo(() => savingsPlan(data.categories, data.funds, data.transactions, data.settings.monthlyIncome), [data])
  const fund = detail ? data.fundMap.get(detail) : undefined
  const enough = plan.free >= plan.needed

  return (
    <div>
      <Card>
        <p className="text-[13px] text-slate-500">Total ahorrado</p>
        <p className="text-[34px] font-bold leading-tight tracking-tight tabular-nums">{money(total)}</p>
        <div className="mt-3 flex gap-2">
          <Button className="flex-1" onClick={() => openTx({ kind: 'transferencia' })}>
            Ahorrar
          </Button>
          <Button variant="soft" className="flex items-center gap-1" onClick={() => setEdit({})}>
            <Plus size={16} /> Nuevo
          </Button>
        </div>
      </Card>

      {plan.needed > 0 && (
        <>
          <SectionTitle>Plan del mes</SectionTitle>
          <List>
            <PlanRow label="Tu presupuesto te deja libre" value={money0(plan.free)} />
            <PlanRow label="Para llegar a tiempo a tus metas" value={money0(plan.needed)} />
            <div className={cx('px-4 py-3 text-[13px]', enough ? 'text-emerald-700 dark:text-emerald-300' : 'text-amber-700 dark:text-amber-300')}>
              {enough
                ? `Te sobran ${money0(plan.free - plan.needed)} al mes. Llegás a todo si ahorrás lo que planeaste.`
                : `Te faltan ${money0(plan.needed - plan.free)} al mes: bajá algún presupuesto o mové la fecha de alguna meta.`}
            </div>
          </List>
        </>
      )}

      <SectionTitle>Tus ahorros</SectionTitle>
      <div className="space-y-2.5">
        {active.length === 0 && <Empty icon="🐷" text="Creá tu primer ahorro: viaje, colchón, moto…" />}
        {active.map((f) => (
          <FundCard key={f.id} fund={f} data={data} onClick={() => setDetail(f.id)} />
        ))}
      </div>

      {archived.length > 0 && (
        <>
          <SectionTitle>Archivados</SectionTitle>
          <div className="space-y-2.5 opacity-70">
            {archived.map((f) => (
              <FundCard key={f.id} fund={f} data={data} onClick={() => setDetail(f.id)} />
            ))}
          </div>
        </>
      )}

      <Sheet open={!!fund} onClose={() => setDetail(null)} title={fund ? `${fund.icon} ${fund.name}` : ''}>
        {fund && <FundDetail fund={fund} data={data} onEdit={() => setEdit(fund)} />}
      </Sheet>
      <Sheet open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? 'Editar ahorro' : 'Nuevo ahorro'}>
        {edit && (
          <FundEditor
            key={edit.id ?? 'new'}
            data={data}
            initial={edit}
            onDone={(deleted) => {
              setEdit(null)
              if (deleted) setDetail(null)
            }}
          />
        )}
      </Sheet>
    </div>
  )
}

function PlanRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between px-4 py-3 text-[15px]">
      <span>{label}</span>
      <span className="font-semibold tabular-nums">{value}</span>
    </div>
  )
}

/** "en 14 meses (dic 2027)" */
function etaText(months: number) {
  const d = new Date()
  d.setMonth(d.getMonth() + months)
  const label = d.toLocaleDateString('es-AR', { month: 'short', year: 'numeric' })
  return `${months} ${months === 1 ? 'mes' : 'meses'} (${label})`
}

function FundCard({ fund: f, data, onClick }: { fund: Fund; data: AppData; onClick: () => void }) {
  const b = fundBalance(f, data.transactions)
  const need = monthlyNeeded(f, b)
  const eta = fundEta(f, b, data.transactions)
  return (
    <Card onClick={onClick}>
      <div className="flex items-center gap-3">
        <CatIcon icon={f.icon} color={f.color} size="lg" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[17px] font-semibold">{f.name}</p>
          <p className="text-[13px] text-slate-500">{f.target ? `${pct((b / f.target) * 100)} de ${money0(f.target)}` : 'Sin meta'}</p>
        </div>
        <p className="text-[20px] font-semibold tabular-nums">{money0(b)}</p>
      </div>
      {f.target ? (
        <div className="mt-3">
          <ProgressBar value={b} max={f.target} color={f.color} />
          <p className="mt-1.5 text-[13px] text-slate-500">
            {need === 0
              ? '🎉 ¡Meta lograda!'
              : need !== undefined
                ? `Necesitás ${money0(need)}/mes para llegar el ${fmtDate(f.deadline!)}`
                : 'Poné una fecha para saber cuánto aportar por mes'}
          </p>
          {eta && (
            <p className="text-[13px] text-slate-500">
              {eta.months ? `Al ritmo de tus aportes (${money0(eta.perMonth)}/mes) llegás en ${etaText(eta.months)}` : 'Sin aportes en los últimos 3 meses'}
            </p>
          )}
        </div>
      ) : null}
    </Card>
  )
}

function FundDetail({ fund, data, onEdit }: { fund: Fund; data: AppData; onEdit: () => void }) {
  const { openTx } = useActions()
  const b = fundBalance(fund, data.transactions)
  const history = useMemo(() => data.transactions.filter((t) => t.fundId === fund.id), [data.transactions, fund.id])
  const need = monthlyNeeded(fund, b)

  return (
    <div className="space-y-4">
      <div className="text-center">
        <p className="text-4xl font-bold tabular-nums">{money(b)}</p>
        {fund.target ? <p className="text-sm text-slate-500">de {money(fund.target)} · faltan {money(Math.max(0, fund.target - b))}</p> : null}
        {fund.target ? (
          <div className="mt-3">
            <ProgressBar value={b} max={fund.target} color={fund.color} />
          </div>
        ) : null}
        {need ? <p className="mt-2 text-xs text-slate-500">Aportá ~{money0(need)}/mes para llegar a tiempo ({fmtDate(fund.deadline!)})</p> : null}
        {fund.note && <p className="mt-2 rounded-xl bg-ios-fill p-2 text-xs text-slate-600 dark:text-slate-300">{fund.note}</p>}
      </div>
      <div className="grid grid-cols-3 gap-2">
        <Button onClick={() => openTx({ kind: 'transferencia', fundId: fund.id })}>Aportar</Button>
        <Button variant="soft" onClick={() => openTx({ kind: 'gasto', fundId: fund.id })}>Pagar algo</Button>
        <Button variant="soft" onClick={onEdit}>Editar</Button>
      </div>
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Historial</p>
        {history.length === 0 ? (
          <p className="py-4 text-center text-sm text-slate-500">Aún no hay movimientos. Saldo inicial: {money(fund.initialBalance)}</p>
        ) : (
          <div className="divide-y divide-slate-100 overflow-hidden rounded-2xl dark:divide-white/5">
            {history.map((t) => (
              <TxRow key={t.id} t={t} data={data} onClick={() => openTx(t)} />
            ))}
            <div className="flex justify-between px-4 py-3 text-xs text-slate-500">
              <span>Saldo inicial</span>
              <span className="tabular-nums">{money(fund.initialBalance)}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function FundEditor({ data, initial, onDone }: { data: AppData; initial: Partial<Fund>; onDone: (deleted?: boolean) => void }) {
  const toast = useToast()
  const [name, setName] = useState(initial.name ?? '')
  const [icon, setIcon] = useState(initial.icon ?? '🐷')
  const [color, setColor] = useState(initial.color ?? '#38bdf8')
  const [target, setTarget] = useState(initial.target ? String(initial.target) : '')
  const [deadline, setDeadline] = useState(initial.deadline ?? '')
  const [initialBalance, setInitialBalance] = useState(initial.initialBalance ? String(initial.initialBalance).replace('.', ',') : '')
  const [note, setNote] = useState(initial.note ?? '')
  const used = !!initial.id && data.transactions.some((t) => t.fundId === initial.id)

  const save = async () => {
    if (!name.trim()) return
    await db.funds.put({
      id: initial.id ?? uid(),
      name: name.trim(),
      icon,
      color,
      target: parseAmount(target) || undefined,
      deadline: deadline || undefined,
      initialBalance: round2(parseAmount(initialBalance)),
      note: note.trim() || undefined,
      archived: initial.archived ?? false,
      order: initial.order ?? data.funds.length,
    })
    toast({ text: 'Ahorro guardado' })
    onDone()
  }

  const archive = async () => {
    if (!initial.id) return
    await db.funds.update(initial.id, { archived: !initial.archived })
    onDone()
  }

  const remove = async () => {
    if (!initial.id || used) return
    await db.funds.delete(initial.id)
    toast({ text: 'Ahorro borrado' })
    onDone(true)
  }

  return (
    <div className="space-y-4">
      <Field label="Nombre">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. Viaje a Japón" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Meta (€)" hint="Opcional">
          <Input inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value)} placeholder="0" />
        </Field>
        <Field label="Fecha objetivo" hint="Opcional">
          <Input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} className="dark:[color-scheme:dark]" />
        </Field>
      </div>
      <Field label="Saldo inicial (€)" hint="Lo que ya tenías ahorrado acá antes de usar la app">
        <Input inputMode="decimal" value={initialBalance} onChange={(e) => setInitialBalance(e.target.value)} placeholder="0" />
      </Field>
      <Field label="Nota">
        <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ej. fianza + muebles" />
      </Field>
      <Field label="Icono">
        <EmojiPicker value={icon} onChange={setIcon} />
      </Field>
      <Field label="Color">
        <ColorPicker value={color} onChange={setColor} />
      </Field>
      <Button className="w-full" disabled={!name.trim()} onClick={save}>Guardar</Button>
      {initial.id && (
        <div className="flex gap-2">
          <Button variant="soft" className="flex-1" onClick={archive}>{initial.archived ? 'Recuperar' : 'Archivar'}</Button>
          <Button variant="danger" className="flex-1" disabled={used} onClick={remove}>Borrar</Button>
        </div>
      )}
    </div>
  )
}
