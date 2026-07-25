import { Search, Plus } from 'lucide-react'

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Buenos días'
  if (h < 19) return 'Buenas tardes'
  return 'Buenas noches'
}

export default function Header({ activeSection, searchQuery, onSearch, onAdd }) {
  const isDashboard = !activeSection

  return (
    <header
      className="flex-shrink-0 flex items-center justify-between px-6 py-4 border-b"
      style={{ borderColor: 'var(--border)', background: 'var(--bg-surface)' }}
    >
      <div>
        {isDashboard ? (
          <>
            <h1 className="text-lg font-semibold" style={{ color: '#e2e4f0' }}>
              {getGreeting()}, Guido
            </h1>
            <p className="text-xs mt-0.5" style={{ color: '#4b5280' }}>
              {new Date().toLocaleDateString('es-AR', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </p>
          </>
        ) : (
          <>
            <h1 className="text-lg font-semibold flex items-center gap-2" style={{ color: '#e2e4f0' }}>
              <span>{activeSection.emoji}</span>
              {activeSection.label}
            </h1>
            <p className="text-xs mt-0.5" style={{ color: '#4b5280' }}>
              {activeSection.description}
            </p>
          </>
        )}
      </div>

      <div className="flex items-center gap-3">
        {/* Search */}
        {!isDashboard && (
          <div className="relative">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2"
              style={{ color: '#4b5280' }}
            />
            <input
              type="text"
              placeholder="Buscar..."
              value={searchQuery}
              onChange={(e) => onSearch(e.target.value)}
              className="pl-8 pr-3 py-2 text-sm rounded-lg border w-48 transition-all"
              style={{ borderColor: 'var(--border-light)' }}
            />
          </div>
        )}

        {/* Add button */}
        <button
          onClick={onAdd}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all hover:opacity-90 active:scale-95"
          style={{ background: 'rgba(201,168,76,0.15)', color: 'var(--gold)' }}
        >
          <Plus size={15} />
          Nuevo
        </button>
      </div>
    </header>
  )
}
