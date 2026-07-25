import { LayoutDashboard, Plus } from 'lucide-react'

export default function Sidebar({ sections, activeSection, onSelect, onAdd }) {
  return (
    <aside
      className="w-64 flex-shrink-0 flex flex-col py-6 border-r"
      style={{
        background: 'var(--bg-surface)',
        borderColor: 'var(--border)',
      }}
    >
      {/* Logo */}
      <div className="px-6 mb-8">
        <div className="flex items-center gap-2">
          <span className="text-xl font-bold" style={{ color: 'var(--gold)' }}>
            ◈ CodexGPT
          </span>
        </div>
        <p className="text-xs mt-1" style={{ color: '#4b5280' }}>
          Asistente personal
        </p>
      </div>

      {/* Dashboard link */}
      <div className="px-3 mb-2">
        <button
          onClick={() => onSelect('dashboard')}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all"
          style={{
            background: activeSection === 'dashboard' ? 'rgba(201,168,76,0.12)' : 'transparent',
            color: activeSection === 'dashboard' ? 'var(--gold)' : '#6b7280',
            borderLeft: activeSection === 'dashboard' ? '2px solid var(--gold)' : '2px solid transparent',
          }}
        >
          <LayoutDashboard size={16} />
          Panel General
        </button>
      </div>

      {/* Divider */}
      <div className="mx-6 my-3 border-t" style={{ borderColor: 'var(--border)' }} />

      {/* Sections */}
      <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
        {sections.map((s) => (
          <button
            key={s.id}
            onClick={() => onSelect(s.id)}
            className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-all group"
            style={{
              background: activeSection === s.id ? s.bg : 'transparent',
              color: activeSection === s.id ? s.color : '#6b7280',
              borderLeft: activeSection === s.id ? `2px solid ${s.color}` : '2px solid transparent',
            }}
          >
            <span className="flex items-center gap-2.5 font-medium">
              <span className="text-base">{s.emoji}</span>
              {s.label}
            </span>
            {s.count > 0 && (
              <span
                className="text-xs px-1.5 py-0.5 rounded-full font-semibold"
                style={{
                  background: activeSection === s.id ? s.color : 'rgba(255,255,255,0.08)',
                  color: activeSection === s.id ? '#000' : '#9ca3af',
                }}
              >
                {s.count}
              </span>
            )}
          </button>
        ))}
      </nav>

      {/* Add button */}
      <div className="px-4 mt-4">
        <button
          onClick={() => onAdd()}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all hover:opacity-90 active:scale-95"
          style={{ background: 'var(--gold)', color: '#0d0f1a' }}
        >
          <Plus size={16} />
          Agregar
        </button>
        <p className="text-center text-xs mt-2" style={{ color: '#3a3f60' }}>
          ⌘K acceso rápido
        </p>
      </div>
    </aside>
  )
}
