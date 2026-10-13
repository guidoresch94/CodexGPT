import { useState } from 'react'
import type { AppData } from '../../db/hooks'
import { db } from '../../db/schema'
import { parseAmount, uid } from '../../lib/format'
import { AREAS, type Area, type Habit, type HabitUnit } from '../../types'
import { ColorPicker, EmojiPicker } from '../../components/Pickers'
import { useToast } from '../../components/Toast'
import { Button, cx, Field, Input, Toggle } from '../../components/ui'

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
  const [linked, setLinked] = useState(initial.linkedCategoryId ?? '')
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
            <button key={u.value} type="button" onClick={() => setUnit(u.value)} className={cx('rounded-full px-3 py-1.5 text-xs', unit === u.value ? 'bg-emerald-500 text-slate-950' : 'bg-slate-100 dark:bg-white/10')}>
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
            <button key={a} type="button" onClick={() => setArea(a)} className={cx('rounded-full px-3 py-1.5 text-xs', area === a ? 'bg-emerald-500 text-slate-950' : 'bg-slate-100 dark:bg-white/10')}>
              {a}
            </button>
          ))}
        </div>
      </Field>

      <Field label="Coste por uso (opcional)" hint="Enlázalo a una categoría de gasto para ver cuánto te cuesta cada sesión.">
        <select value={linked} onChange={(e) => setLinked(e.target.value)} className="w-full rounded-xl bg-slate-100 px-3 py-2.5 text-sm dark:bg-white/5">
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

      <Field label="Icono">
        <EmojiPicker value={icon} onChange={setIcon} />
      </Field>
      <Field label="Color">
        <ColorPicker value={color} onChange={setColor} />
      </Field>
      <Toggle checked={active} onChange={setActive} label="Activo" hint="Ponlo en pausa sin perder el historial." />

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
