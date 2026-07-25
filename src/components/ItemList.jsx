import { Plus } from 'lucide-react'
import ItemCard from './ItemCard'

const STATUS_FILTERS = [
  { value: 'all', label: 'Todas' },
  { value: 'pendiente', label: 'Pendientes' },
  { value: 'en-progreso', label: 'En progreso' },
  { value: 'completado', label: 'Completados' },
]

const PRIORITY_FILTERS = [
  { value: 'all', label: 'Prioridad' },
  { value: 'alta', label: '🔴 Alta' },
  { value: 'media', label: '🟡 Media' },
  { value: 'baja', label: '🟢 Baja' },
]

import { useState } from 'react'

export default function ItemList({ items, section, onAdd, onToggle, onEdit, onDelete }) {
  const [statusFilter, setStatusFilter] = useState('all')
  const [priorityFilter, setPriorityFilter] = useState('all')

  const filtered = items.filter((i) => {
    if (statusFilter !== 'all' && i.status !== statusFilter) return false
    if (priorityFilter !== 'all' && i.priority !== priorityFilter) return false
    return true
  })

  const grouped = {
    alta: filtered.filter((i) => i.priority === 'alta' && i.status !== 'completado'),
    media: filtered.filter((i) => i.priority === 'media' && i.status !== 'completado'),
    baja: filtered.filter((i) => i.priority === 'baja' && i.status !== 'completado'),
    completado: filtered.filter((i) => i.status === 'completado'),
  }

  const showGrouped = statusFilter === 'all' && priorityFilter === 'all'

  return (
    <div className="max-w-3xl mx-auto animate-fade-in">
      {/* Filter bar */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <div className="flex gap-1 p-1 rounded-lg" style={{ background: 'var(--bg-card)' }}>
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setStatusFilter(f.value)}
              className="px-3 py-1.5 rounded-md text-xs font-medium transition-all"
              style={{
                background: statusFilter === f.value ? 'rgba(201,168,76,0.15)' : 'transparent',
                color: statusFilter === f.value ? 'var(--gold)' : '#6b7280',
              }}
            >
              {f.label}
            </button>
          ))}
        </div>

        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
          className="px-3 py-1.5 rounded-lg text-xs font-medium border"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
        >
          {PRIORITY_FILTERS.map((f) => (
            <option key={f.value} value={f.value}>{f.label}</option>
          ))}
        </select>

        <span className="text-xs ml-auto" style={{ color: '#4b5280' }}>
          {filtered.length} elemento{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Items */}
      {showGrouped ? (
        <div className="space-y-6">
          {grouped.alta.length > 0 && (
            <Group label="🔴 ALTA PRIORIDAD" items={grouped.alta} color="#ef4444"
              onToggle={onToggle} onEdit={onEdit} onDelete={onDelete} />
          )}
          {grouped.media.length > 0 && (
            <Group label="🟡 MEDIA PRIORIDAD" items={grouped.media} color="#f59e0b"
              onToggle={onToggle} onEdit={onEdit} onDelete={onDelete} />
          )}
          {grouped.baja.length > 0 && (
            <Group label="🟢 BAJA PRIORIDAD" items={grouped.baja} color="#22c55e"
              onToggle={onToggle} onEdit={onEdit} onDelete={onDelete} />
          )}
          {grouped.completado.length > 0 && (
            <Group label="✅ COMPLETADOS" items={grouped.completado} color="#4b5280"
              onToggle={onToggle} onEdit={onEdit} onDelete={onDelete} />
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((item) => (
            <ItemCard key={item.id} item={item} onToggle={onToggle} onEdit={onEdit} onDelete={onDelete} />
          ))}
        </div>
      )}

      {filtered.length === 0 && (
        <div className="text-center py-20">
          <span className="text-4xl">{section?.emoji}</span>
          <p className="mt-3 text-sm font-medium" style={{ color: '#6b7280' }}>
            {items.length === 0 ? 'Todavía no hay nada aquí' : 'Sin resultados para ese filtro'}
          </p>
          {items.length === 0 && (
            <button
              onClick={onAdd}
              className="mt-4 flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium mx-auto transition-all hover:opacity-90"
              style={{ background: 'rgba(201,168,76,0.15)', color: 'var(--gold)' }}
            >
              <Plus size={14} />
              Agregar primero
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function Group({ label, items, color, onToggle, onEdit, onDelete }) {
  return (
    <div>
      <p className="text-xs font-semibold mb-2 tracking-wide" style={{ color }}>
        {label}
      </p>
      <div className="space-y-2">
        {items.map((item) => (
          <ItemCard key={item.id} item={item} onToggle={onToggle} onEdit={onEdit} onDelete={onDelete} />
        ))}
      </div>
    </div>
  )
}
