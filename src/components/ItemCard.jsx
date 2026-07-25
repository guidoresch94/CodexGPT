import { Pencil, Trash2, Circle, CheckCircle, Clock } from 'lucide-react'
import { SECTIONS } from '../App'

const PRIORITY_STYLES = {
  alta: { label: 'Alta', color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
  media: { label: 'Media', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  baja: { label: 'Baja', color: '#22c55e', bg: 'rgba(34,197,94,0.12)' },
}

const STATUS_ICON = {
  pendiente: <Circle size={18} style={{ color: '#4b5280' }} />,
  'en-progreso': <Clock size={18} style={{ color: '#06b6d4' }} />,
  completado: <CheckCircle size={18} style={{ color: '#22c55e' }} />,
}

function formatDate(d) {
  if (!d) return null
  const date = new Date(d)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  date.setHours(0, 0, 0, 0)
  const diff = Math.round((date - today) / 86400000)
  if (diff < 0) return { text: `Hace ${Math.abs(diff)}d`, overdue: true }
  if (diff === 0) return { text: 'Hoy', today: true }
  if (diff === 1) return { text: 'Mañana' }
  if (diff < 7) return { text: `En ${diff} días` }
  return {
    text: date.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' }),
  }
}

const FREQ_LABEL = {
  diaria: '· Diaria',
  semanal: '· Semanal',
  mensual: '· Mensual',
  personalizada: '',
}

export default function ItemCard({ item, onToggle, onEdit, onDelete, compact }) {
  const section = SECTIONS.find((s) => s.id === item.section)
  const prio = PRIORITY_STYLES[item.priority] || PRIORITY_STYLES.media
  const dateInfo = formatDate(item.dueDate)
  const isCompleted = item.status === 'completado'

  return (
    <div
      className="group flex items-start gap-3 p-4 rounded-xl border transition-all hover:border-opacity-60"
      style={{
        background: isCompleted ? 'rgba(255,255,255,0.02)' : 'var(--bg-card)',
        borderColor: isCompleted ? 'var(--border)' : 'var(--border)',
        opacity: isCompleted ? 0.6 : 1,
      }}
    >
      {/* Status toggle */}
      <button
        onClick={() => onToggle(item.id)}
        className="mt-0.5 flex-shrink-0 transition-transform hover:scale-110 active:scale-95"
        title="Cambiar estado"
      >
        {STATUS_ICON[item.status]}
      </button>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className="text-sm font-medium truncate"
            style={{
              color: isCompleted ? '#4b5280' : '#e2e4f0',
              textDecoration: isCompleted ? 'line-through' : 'none',
            }}
          >
            {item.title}
          </span>

          {/* Priority badge */}
          <span
            className="text-xs px-1.5 py-0.5 rounded-full font-medium flex-shrink-0"
            style={{ background: prio.bg, color: prio.color }}
          >
            {prio.label}
          </span>
        </div>

        {/* Description */}
        {!compact && item.description && (
          <p className="text-xs mt-1 leading-relaxed line-clamp-2" style={{ color: '#6b7280' }}>
            {item.description}
          </p>
        )}

        {/* Meta row */}
        <div className="flex items-center gap-3 mt-2 flex-wrap">
          {/* Section badge (only on dashboard) */}
          {compact && section && (
            <span
              className="text-xs px-1.5 py-0.5 rounded-md font-medium"
              style={{ background: section.bg, color: section.color }}
            >
              {section.emoji} {section.label}
            </span>
          )}

          {/* Due date */}
          {dateInfo && (
            <span
              className="text-xs"
              style={{
                color: dateInfo.overdue ? '#ef4444' : dateInfo.today ? '#c9a84c' : '#6b7280',
              }}
            >
              {dateInfo.overdue ? '⚠ ' : '📅 '}
              {dateInfo.text}
            </span>
          )}

          {/* Frequency for routines */}
          {item.frequency && (
            <span className="text-xs" style={{ color: '#4b5280' }}>
              🔄 {FREQ_LABEL[item.frequency] || item.frequency}
            </span>
          )}

          {/* Institution for burocracia */}
          {item.institution && (
            <span className="text-xs" style={{ color: '#4b5280' }}>
              🏛 {item.institution}
            </span>
          )}

          {/* Amount for obligaciones */}
          {item.amount && (
            <span className="text-xs" style={{ color: '#4b5280' }}>
              💰 {item.amount}
            </span>
          )}

          {/* Deseo type */}
          {item.deseoType && (
            <span className="text-xs" style={{ color: '#ec4899' }}>
              {item.deseoType === 'quiero' ? '🌟 Quiero' : '❤️ Me gusta'}
            </span>
          )}

          {/* Tags */}
          {item.tags?.length > 0 &&
            item.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="text-xs px-1.5 py-0.5 rounded"
                style={{ background: 'rgba(255,255,255,0.05)', color: '#6b7280' }}
              >
                #{tag}
              </span>
            ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
        <button
          onClick={() => onEdit(item)}
          className="p-1.5 rounded-lg transition-colors hover:bg-white hover:bg-opacity-5"
          title="Editar"
        >
          <Pencil size={13} style={{ color: '#6b7280' }} />
        </button>
        <button
          onClick={() => onDelete(item.id)}
          className="p-1.5 rounded-lg transition-colors hover:bg-red-500 hover:bg-opacity-10"
          title="Eliminar"
        >
          <Trash2 size={13} style={{ color: '#6b7280' }} />
        </button>
      </div>
    </div>
  )
}
