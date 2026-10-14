import { useState } from 'react'
import { db } from '../../db/schema'
import type { AppData } from '../../db/hooks'
import { parseAmount, round2, uid } from '../../lib/format'
import type { Category, CategoryType } from '../../types'
import { ColorPicker, EmojiPicker } from '../../components/Pickers'
import { useToast } from '../../components/Toast'
import { Button, Field, Input, Segmented, Toggle } from '../../components/ui'

interface Props {
  data: AppData
  initial?: Partial<Category>
  onSaved: (id: string) => void
}

export function CategoryEditor({ data, initial, onSaved }: Props) {
  const toast = useToast()
  const editing = !!initial?.id
  const [name, setName] = useState(initial?.name ?? '')
  const [icon, setIcon] = useState(initial?.icon ?? '⭐')
  const [color, setColor] = useState(initial?.color ?? '#34d399')
  const [type, setType] = useState<CategoryType>(initial?.type ?? 'variable')
  const [budget, setBudget] = useState(initial?.monthlyBudget ? String(initial.monthlyBudget).replace('.', ',') : '')
  const [parentId, setParentId] = useState(initial?.parentId ?? '')
  const [housing, setHousing] = useState(initial?.housing ?? false)
  const [reduce, setReduce] = useState(initial?.reduce ?? false)
  const [fundId, setFundId] = useState(initial?.fundId ?? '')

  const parents = data.categories.filter((c) => !c.parentId && !c.archived && c.id !== initial?.id && c.type === type)
  const hasChildren = editing && data.categories.some((c) => c.parentId === initial?.id)
  const used = editing && data.transactions.some((t) => t.categoryId === initial?.id)

  const save = async () => {
    if (!name.trim()) return
    const id = initial?.id ?? uid()
    const prev = editing ? data.catMap.get(id) : undefined
    const cat: Category = {
      id,
      name: name.trim(),
      icon: icon || '⭐',
      color,
      type,
      monthlyBudget: round2(parseAmount(budget)),
      parentId: parentId || undefined,
      housing,
      reduce,
      fundId: type === 'ahorro' ? fundId || undefined : undefined,
      archived: prev?.archived ?? false,
      order: prev?.order ?? data.categories.length,
    }
    await db.categories.put(cat)
    toast({ text: editing ? 'Categoría actualizada' : `Categoría «${cat.name}» creada` })
    onSaved(id)
  }

  const toggleArchive = async () => {
    if (!initial?.id) return
    const archived = !data.catMap.get(initial.id)?.archived
    await db.categories.update(initial.id, { archived })
    toast({ text: archived ? 'Categoría archivada (sigue en el histórico)' : 'Categoría recuperada' })
    onSaved(initial.id)
  }

  const remove = async () => {
    if (!initial?.id || used || hasChildren) return
    await db.categories.delete(initial.id)
    // Los hábitos enlazados a esta categoría quedan sin enlace
    for (const h of data.habits.filter((x) => x.linkedCategoryId === initial.id))
      await db.habits.update(h.id, { linkedCategoryId: undefined, linkMode: undefined, auto: false })
    toast({ text: 'Categoría borrada' })
    onSaved(initial.id)
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-2xl" style={{ background: `${color}26` }}>
          {icon}
        </span>
        <Input autoFocus={!editing} placeholder="Nombre (ej. Mascota)" value={name} onChange={(e) => setName(e.target.value)} className="text-base" />
      </div>

      <Segmented
        value={type}
        onChange={(t) => {
          setType(t)
          setParentId('')
        }}
        options={[
          { value: 'variable', label: 'Variable' },
          { value: 'fijo', label: 'Fijo' },
          { value: 'ahorro', label: 'Ahorro' },
          { value: 'ingreso', label: 'Ingreso' },
        ]}
      />

      {type !== 'ingreso' && (
        <Field label={type === 'ahorro' ? 'Aportación mensual prevista (€)' : 'Presupuesto mensual (€)'} hint="Dejalo en 0 si no querés límite.">
          <Input inputMode="decimal" placeholder="0" value={budget} onChange={(e) => setBudget(e.target.value)} />
        </Field>
      )}

      {type === 'ahorro' && (
        <Field label="Ahorro asociado">
          <select value={fundId} onChange={(e) => setFundId(e.target.value)} className="w-full rounded-xl bg-ios-fill px-3 py-2.5 text-sm">
            <option value="">Ninguna</option>
            {data.funds.map((f) => (
              <option key={f.id} value={f.id}>
                {f.icon} {f.name}
              </option>
            ))}
          </select>
        </Field>
      )}

      {!hasChildren && parents.length > 0 && (
        <Field label="Subcategoría de" hint="Las subcategorías suman en el presupuesto de su categoría padre.">
          <select value={parentId} onChange={(e) => setParentId(e.target.value)} className="w-full rounded-xl bg-ios-fill px-3 py-2.5 text-sm">
            <option value="">— Es una categoría principal —</option>
            {parents.map((p) => (
              <option key={p.id} value={p.id}>
                {p.icon} {p.name}
              </option>
            ))}
          </select>
        </Field>
      )}

      <Field label="Icono">
        <EmojiPicker value={icon} onChange={setIcon} />
      </Field>
      <Field label="Color">
        <ColorPicker value={color} onChange={setColor} />
      </Field>

      {(type === 'variable' || type === 'fijo') && (
        <div className="divide-y divide-slate-100 dark:divide-white/5">
          <Toggle checked={housing} onChange={setHousing} label="Es gasto de vivienda" hint="Para el % del sueldo en vivienda." />
          <Toggle checked={reduce} onChange={setReduce} label="Hábito a reducir" hint="Se muestra aparte, con el objetivo de llegar a 0." />
        </div>
      )}

      <Button className="w-full" disabled={!name.trim()} onClick={save}>
        {editing ? 'Guardar' : 'Crear categoría'}
      </Button>
      {editing && (
        <div className="flex gap-2">
          <Button variant="soft" className="flex-1" onClick={toggleArchive}>
            {data.catMap.get(initial!.id!)?.archived ? 'Recuperar' : 'Archivar'}
          </Button>
          <Button variant="danger" className="flex-1" disabled={used || hasChildren} onClick={remove} title={used ? 'Tiene movimientos: mejor archivala' : undefined}>
            Borrar
          </Button>
        </div>
      )}
      {editing && (used || hasChildren) && (
        <p className="text-center text-xs text-slate-500">Tiene movimientos o subcategorías: archivala para ocultarla sin perder el histórico.</p>
      )}
    </div>
  )
}
