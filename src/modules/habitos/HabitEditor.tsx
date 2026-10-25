import { useState } from 'react'
import type { AppData } from '../../db/hooks'
import { db } from '../../db/schema'
import { parseAmount, uid } from '../../lib/format'
import { AREAS, type Area, type Habit, type HabitUnit } from '../../types'
import { ColorPicker, EmojiPicker } from '../../components/Pickers'
import { useToast } from '../../components/Toast'
import { Button, cx, Field, Input, Segmented, Toggle } from '../../components/ui'
import { today } from '../../lib/dates'

const UNITS: { value: HabitUnit; label: string; hint: string }[] = [
  { value: 'veces', label: 'Veces', hint: 'veces por semana' },
  { value: 'si_no', label: 'Sí / No', hint: 'días por semana' },
  { value: 'min', label: 'Minutos', hint: 'minutos por semana' },
  { value: 'km', label: 'Km', hint: 'km por semana' },
  { value: 'paginas', label: 'Páginas', hint: 'páginas por semana' },
]

export function HabitEditor({ data, initial, onDone }: { data: AppData; initial: Partial<Habit>; onDone: (deleted?: boolean) => void }) {
  const toast = useToast()
  const [name, setName] = useState(initial.name ?? '')
  const [icon, setIcon] = useState(initial.icon ?? '⭐')
  const [color, setColor] = useState(initial.color ?? '#34d399')
  const [area, setArea] = useState<Area>(initial.area ?? 'Deporte')
  const [unit, setUnit] = useState<HabitUnit>(initial.unit ?? 'veces')
  const [target, setTarget] = useState(String(initial.weeklyTarget ?? 3))
  const [linked, setLinked] = useState(initial.linkedCategoryId && data.catMap.has(initial.linkedCategoryId) ? initial.linkedCategoryId : '')
  const [mode, setMode] = useState<'suma' | 'rompe'>(initial.linkMode ?? (initial.unit === 'si_no' ? 'rompe' : 'suma'))
  const [active, setActive] = useState(initial.active ?? true)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const valid = name.trim() && parseAmount(target) > 0

  const save = async () => {
    if (!valid) return
    await db.habits.put({
      id: initial.id ?? uid(),
      name: name.trim(),
      icon,
      color,
      area,
      unit,
      weeklyTarget: unit === 'si_no' ? Math.min(7, parseAmount(target)) : parseAmount(target),
      linkedCategoryId: linked || undefined,
      linkMode: linked ? mode : undefined,
      // "Sin X" con gasto que lo rompe: cada día cuenta solo, no hace falta marcarlo
      auto: unit === 'si_no' && !!linked && mode === 'rompe',
      since: unit === 'si_no' && !!linked && mode === 'rompe' ? (initial.since ?? today()) : initial.since,
      active,
      order: initial.order ?? data.habits.length,
    })
    toast({ text: initial.id ? 'Hábito actualizado' : `Hábito «${name.trim()}» creado` })
    onDone()
  }

  const remove = async () => {
    if (!initial.id) return
    const logIds = data.habitLogs.filter((l) => l.habitId === initial.id).map((l) => l.id)
    await db.habitLogs.bulkDelete(logIds)
    await db.habits.delete(initial.id)
    toast({ text: 'Hábito borrado' })
    onDone(true)
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-2xl" style={{ background: `${color}26` }}>
          {icon}
        </span>
        <Input placeholder="Nombre (ej. Meditar)" value={name} onChange={(e) => setName(e.target.value)} className="text-base" />
      </div>

      <Field label="Cómo lo mides">
        <div className="flex flex-wrap gap-2">
          {UNITS.map((u) => (
            <button key={u.value} type="button" onClick={() => setUnit(u.value)} className={cx('rounded-full px-3 py-1.5 text-xs', unit === u.value ? 'bg-accent text-white' : 'bg-ios-fill')}>
              {u.label}
            </button>
          ))}
        </div>
      </Field>
      <Field label={`Objetivo: ${UNITS.find((u) => u.value === unit)!.hint}`}>
        <Input inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value)} />
      </Field>

      <Field label="Área">
        <div className="flex flex-wrap gap-2">
          {AREAS.map((a) => (
            <button key={a} type="button" onClick={() => setArea(a)} className={cx('rounded-full px-3 py-1.5 text-xs', area === a ? 'bg-accent text-white' : 'bg-ios-fill')}>
              {a}
            </button>
          ))}
        </div>
      </Field>

      <Field label="Enlazar con gastos (opcional)" hint="Así no cargás dos veces lo mismo.">
        <select value={linked} onChange={(e) => setLinked(e.target.value)} className="w-full rounded-xl bg-ios-fill px-3 py-2.5 text-sm">
          <option value="">Sin enlazar</option>
          {data.categories
            .filter((c) => !c.archived && (c.type === 'fijo' || c.type === 'variable'))
            .map((c) => (
              <option key={c.id} value={c.id}>
                {c.icon} {c.name}
              </option>
            ))}
        </select>
      </Field>
      {linked && (
        <Segmented
          value={mode}
          onChange={setMode}
          options={[
            { value: 'suma', label: 'Quiero hacerlo más' },
            { value: 'rompe', label: 'Quiero dejarlo' },
          ]}
        />
      )}
      {linked && mode === 'suma' && <p className="px-1 text-[13px] text-slate-500">Cada gasto en esa categoría (un pádel, una clase…) cuenta como una vez. Las cuotas domiciliadas no.</p>}
      {linked && mode === 'rompe' && unit !== 'si_no' && <p className="px-1 text-[13px] text-slate-500">Para dejar algo, elegí «Sí / No» arriba: cada día cuenta solo y un gasto lo corta.</p>}
      {linked && mode === 'rompe' && unit === 'si_no' && (
        <p className="px-1 text-[13px] text-slate-500">Cada día cuenta solo como cumplido. Si gastás en esa categoría o anotás una recaída, la racha vuelve a cero.</p>
      )}

      <Field label="Icono">
        <EmojiPicker value={icon} onChange={setIcon} />
      </Field>
      <Field label="Color">
        <ColorPicker value={color} onChange={setColor} />
      </Field>
      <Toggle checked={active} onChange={setActive} label="Activo" hint="Pausalo sin perder el historial." />

      <Button className="w-full" disabled={!valid} onClick={save}>
        {initial.id ? 'Guardar' : 'Crear hábito'}
      </Button>
      {initial.id &&
        (confirmDelete ? (
          <div className="flex gap-2">
            <Button variant="soft" className="flex-1" onClick={() => setConfirmDelete(false)}>Cancelar</Button>
            <Button variant="danger" className="flex-1 font-semibold" onClick={remove}>Borrar con su historial</Button>
          </div>
        ) : (
          <Button variant="danger" className="w-full" onClick={() => setConfirmDelete(true)}>Borrar hábito</Button>
        ))}
    </div>
  )
}
