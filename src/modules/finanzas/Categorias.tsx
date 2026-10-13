import { ArrowDown, ArrowLeft, ArrowUp, Plus } from 'lucide-react'
import { useState } from 'react'
import { go } from '../../app/router'
import { db } from '../../db/schema'
import type { AppData } from '../../db/hooks'
import { money0 } from '../../lib/format'
import type { Category, CategoryType } from '../../types'
import { Button, Card, CatIcon, PageHeader, SectionTitle, Sheet } from '../../components/ui'
import { CategoryEditor } from './CategoryEditor'

const GROUPS: { type: CategoryType; label: string }[] = [
  { type: 'fijo', label: 'Gastos fijos' },
  { type: 'variable', label: 'Gastos variables' },
  { type: 'ahorro', label: 'Ahorro' },
  { type: 'ingreso', label: 'Ingresos' },
]

export function Categorias({ data }: { data: AppData }) {
  const [edit, setEdit] = useState<Partial<Category> | null>(null)
  const active = data.categories.filter((c) => !c.archived)
  const archived = data.categories.filter((c) => c.archived)

  /** Intercambia el orden con la categoría hermana anterior/siguiente */
  const move = async (c: Category, dir: -1 | 1) => {
    const siblings = active.filter((x) => x.type === c.type && x.parentId === c.parentId).sort((a, b) => a.order - b.order)
    const i = siblings.findIndex((x) => x.id === c.id)
    const other = siblings[i + dir]
    if (!other) return
    // Normalizamos el orden para evitar empates
    const all = [...data.categories].sort((a, b) => a.order - b.order)
    const ia = all.findIndex((x) => x.id === c.id)
    const ib = all.findIndex((x) => x.id === other.id)
    ;[all[ia], all[ib]] = [all[ib], all[ia]]
    await db.categories.bulkPut(all.map((x, order) => ({ ...x, order })))
  }

  const item = (c: Category, child = false) => (
    <div key={c.id} className={child ? 'ml-10' : ''}>
      <div className="flex items-center gap-3 py-2">
        <button onClick={() => setEdit(c)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
          <CatIcon icon={c.icon} color={c.color} size={child ? 'sm' : 'md'} />
          <div className="min-w-0">
            <p className="truncate text-sm">{c.name}</p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {c.monthlyBudget > 0 ? `${money0(c.monthlyBudget)}/mes` : 'Sin límite'}
              {c.housing ? ' · vivienda' : ''}
              {c.reduce ? ' · a reducir' : ''}
            </p>
          </div>
        </button>
        {!c.archived && (
          <div className="flex text-slate-400">
            <button onClick={() => move(c, -1)} className="p-1.5" aria-label="Subir">
              <ArrowUp size={15} />
            </button>
            <button onClick={() => move(c, 1)} className="p-1.5" aria-label="Bajar">
              <ArrowDown size={15} />
            </button>
          </div>
        )}
      </div>
      {!child && active.filter((x) => x.parentId === c.id).map((x) => item(x, true))}
    </div>
  )

  return (
    <div>
      <button onClick={() => go('presupuesto')} className="flex items-center gap-1 pt-2 text-sm text-slate-500">
        <ArrowLeft size={16} /> Presupuesto
      </button>
      <PageHeader title="Categorías" right={<Button className="flex items-center gap-1 py-2" onClick={() => setEdit({})}><Plus size={16} /> Nueva</Button>} />
      <p className="px-1 text-xs text-slate-500 dark:text-slate-400">Toca una categoría para cambiar nombre, icono, color, presupuesto o convertirla en subcategoría.</p>

      {GROUPS.map((g) => {
        const roots = active.filter((c) => c.type === g.type && !c.parentId)
        if (!roots.length) return null
        return (
          <div key={g.type}>
            <SectionTitle action={<button className="text-xs text-emerald-600 dark:text-emerald-400" onClick={() => setEdit({ type: g.type })}>+ Añadir</button>}>
              {g.label}
            </SectionTitle>
            <Card className="py-1">{roots.map((c) => item(c))}</Card>
          </div>
        )
      })}

      {archived.length > 0 && (
        <>
          <SectionTitle>Archivadas</SectionTitle>
          <Card className="py-1 opacity-70">{archived.map((c) => item(c, false))}</Card>
        </>
      )}

      <Sheet open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? 'Editar categoría' : 'Nueva categoría'}>
        {edit && <CategoryEditor key={edit.id ?? 'new'} data={data} initial={edit} onSaved={() => setEdit(null)} />}
      </Sheet>
    </div>
  )
}
