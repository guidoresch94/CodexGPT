import { Calendar, CheckCircle2, Clock, AlertCircle } from 'lucide-react'
import ItemCard from './ItemCard'

function StatCard({ section, onNavigate }) {
  const done = section.total - section.count
  const pct = section.total > 0 ? Math.round((done / section.total) * 100) : 0

  return (
    <button
      onClick={() => onNavigate(section.id)}
      className="text-left p-4 rounded-xl border transition-all hover:scale-[1.02] active:scale-[0.98]"
      style={{
        background: section.bg,
        borderColor: section.border,
      }}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-2xl">{section.emoji}</span>
        <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
          style={{ background: section.color, color: '#000' }}>
          {section.count} pend.
        </span>
      </div>
      <p className="font-semibold text-sm mb-1" style={{ color: '#e2e4f0' }}>{section.label}</p>
      <div className="flex items-center gap-2 mt-3">
        <div className="flex-1 h-1 rounded-full" style={{ background: 'rgba(255,255,255,0.1)' }}>
          <div
            className="h-1 rounded-full transition-all"
            style={{ width: `${pct}%`, background: section.color }}
          />
        </div>
        <span className="text-xs" style={{ color: '#6b7280' }}>{pct}%</span>
      </div>
    </button>
  )
}

function groupByDate(items) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today)
  tomorrow.setDate(today.getDate() + 1)
  const nextWeek = new Date(today)
  nextWeek.setDate(today.getDate() + 7)

  const overdue = []
  const todayItems = []
  const upcomingItems = []
  const noDueDate = []

  items
    .filter((i) => i.status !== 'completado')
    .forEach((i) => {
      if (!i.dueDate) {
        noDueDate.push(i)
        return
      }
      const d = new Date(i.dueDate)
      d.setHours(0, 0, 0, 0)
      if (d < today) overdue.push(i)
      else if (d.getTime() === today.getTime()) todayItems.push(i)
      else if (d < nextWeek) upcomingItems.push(i)
      else noDueDate.push(i)
    })

  return { overdue, todayItems, upcomingItems, noDueDate }
}

export default function Dashboard({ items, sections, onNavigate, onAdd, onToggle, onEdit, onDelete }) {
  const total = items.length
  const done = items.filter((i) => i.status === 'completado').length
  const pending = items.filter((i) => i.status === 'pendiente').length
  const inProgress = items.filter((i) => i.status === 'en-progreso').length

  const { overdue, todayItems, upcomingItems } = groupByDate(items)

  const recentDone = items
    .filter((i) => i.status === 'completado')
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
    .slice(0, 3)

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-fade-in">
      {/* Stats row */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total', value: total, icon: Calendar, color: '#c9a84c' },
          { label: 'Pendientes', value: pending, icon: Clock, color: '#f97316' },
          { label: 'En progreso', value: inProgress, icon: AlertCircle, color: '#06b6d4' },
          { label: 'Completados', value: done, icon: CheckCircle2, color: '#22c55e' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div
            key={label}
            className="p-4 rounded-xl border"
            style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
          >
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium" style={{ color: '#6b7280' }}>{label}</p>
              <Icon size={14} style={{ color }} />
            </div>
            <p className="text-2xl font-bold" style={{ color }}>{value}</p>
          </div>
        ))}
      </div>

      {/* Sections grid */}
      <div>
        <h2 className="text-sm font-semibold mb-3" style={{ color: '#6b7280' }}>
          SECCIONES
        </h2>
        <div className="grid grid-cols-5 gap-3">
          {sections.map((s) => (
            <StatCard key={s.id} section={s} onNavigate={onNavigate} />
          ))}
        </div>
      </div>

      {/* Overdue */}
      {overdue.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: '#ef4444' }}>
            <AlertCircle size={14} />
            VENCIDOS ({overdue.length})
          </h2>
          <div className="space-y-2">
            {overdue.map((item) => (
              <ItemCard
                key={item.id}
                item={item}
                onToggle={onToggle}
                onEdit={onEdit}
                onDelete={onDelete}
                compact
              />
            ))}
          </div>
        </div>
      )}

      {/* Today */}
      {todayItems.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: '#c9a84c' }}>
            <Calendar size={14} />
            HOY ({todayItems.length})
          </h2>
          <div className="space-y-2">
            {todayItems.map((item) => (
              <ItemCard
                key={item.id}
                item={item}
                onToggle={onToggle}
                onEdit={onEdit}
                onDelete={onDelete}
                compact
              />
            ))}
          </div>
        </div>
      )}

      {/* Upcoming */}
      {upcomingItems.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: '#6b7280' }}>
            <Clock size={14} />
            PRÓXIMOS 7 DÍAS ({upcomingItems.length})
          </h2>
          <div className="space-y-2">
            {upcomingItems.map((item) => (
              <ItemCard
                key={item.id}
                item={item}
                onToggle={onToggle}
                onEdit={onEdit}
                onDelete={onDelete}
                compact
              />
            ))}
          </div>
        </div>
      )}

      {/* Recently completed */}
      {recentDone.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: '#22c55e' }}>
            <CheckCircle2 size={14} />
            COMPLETADOS RECIENTEMENTE
          </h2>
          <div className="space-y-2">
            {recentDone.map((item) => (
              <ItemCard
                key={item.id}
                item={item}
                onToggle={onToggle}
                onEdit={onEdit}
                onDelete={onDelete}
                compact
              />
            ))}
          </div>
        </div>
      )}

      {total === 0 && (
        <div className="text-center py-20">
          <p className="text-5xl mb-4">◈</p>
          <p className="text-lg font-semibold mb-2" style={{ color: '#e2e4f0' }}>
            Todo en orden, Guido
          </p>
          <p className="text-sm mb-6" style={{ color: '#4b5280' }}>
            Comencemos a organizar tu vida. Agregá tu primera tarea.
          </p>
          <button
            onClick={() => onAdd('por-hacer')}
            className="px-5 py-2.5 rounded-lg text-sm font-semibold transition-all hover:opacity-90"
            style={{ background: 'var(--gold)', color: '#0d0f1a' }}
          >
            + Agregar primera tarea
          </button>
        </div>
      )}
    </div>
  )
}
