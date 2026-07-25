import { useState, useEffect, useCallback } from 'react'
import Sidebar from './components/Sidebar'
import Header from './components/Header'
import Dashboard from './components/Dashboard'
import ItemList from './components/ItemList'
import AddModal from './components/AddModal'

export const SECTIONS = [
  {
    id: 'burocracia',
    label: 'Burocracia',
    emoji: '📋',
    color: '#6366f1',
    bg: 'rgba(99,102,241,0.12)',
    border: 'rgba(99,102,241,0.3)',
    description: 'Trámites, documentos y gestiones',
  },
  {
    id: 'rutinas',
    label: 'Rutinas',
    emoji: '🔄',
    color: '#06b6d4',
    bg: 'rgba(6,182,212,0.12)',
    border: 'rgba(6,182,212,0.3)',
    description: 'Hábitos y rutinas diarias',
  },
  {
    id: 'obligaciones',
    label: 'Obligaciones',
    emoji: '⚡',
    color: '#f97316',
    bg: 'rgba(249,115,22,0.12)',
    border: 'rgba(249,115,22,0.3)',
    description: 'Compromisos y pagos fijos',
  },
  {
    id: 'por-hacer',
    label: 'Por Hacer',
    emoji: '✅',
    color: '#22c55e',
    bg: 'rgba(34,197,94,0.12)',
    border: 'rgba(34,197,94,0.3)',
    description: 'Lista de tareas pendientes',
  },
  {
    id: 'deseos',
    label: 'Deseos & Gustos',
    emoji: '⭐',
    color: '#ec4899',
    bg: 'rgba(236,72,153,0.12)',
    border: 'rgba(236,72,153,0.3)',
    description: 'Lo que quiero y disfruto',
  },
]

const STORAGE_KEY = 'codexgpt_items'

function loadItems() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveItems(items) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
}

export default function App() {
  const [items, setItems] = useState(loadItems)
  const [activeSection, setActiveSection] = useState('dashboard')
  const [showModal, setShowModal] = useState(false)
  const [editingItem, setEditingItem] = useState(null)
  const [defaultSection, setDefaultSection] = useState('por-hacer')
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    saveItems(items)
  }, [items])

  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        openAdd(activeSection !== 'dashboard' ? activeSection : 'por-hacer')
      }
      if (e.key === 'Escape') setShowModal(false)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [activeSection])

  const openAdd = useCallback((section = 'por-hacer') => {
    setDefaultSection(section)
    setEditingItem(null)
    setShowModal(true)
  }, [])

  const openEdit = useCallback((item) => {
    setEditingItem(item)
    setShowModal(true)
  }, [])

  const saveItem = useCallback((data) => {
    if (editingItem) {
      setItems((prev) =>
        prev.map((it) =>
          it.id === editingItem.id ? { ...it, ...data, updatedAt: new Date().toISOString() } : it
        )
      )
    } else {
      setItems((prev) => [
        ...prev,
        {
          ...data,
          id: crypto.randomUUID(),
          status: 'pendiente',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ])
    }
    setShowModal(false)
    setEditingItem(null)
  }, [editingItem])

  const deleteItem = useCallback((id) => {
    setItems((prev) => prev.filter((it) => it.id !== id))
  }, [])

  const toggleStatus = useCallback((id) => {
    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== id) return it
        const next =
          it.status === 'pendiente'
            ? 'en-progreso'
            : it.status === 'en-progreso'
            ? 'completado'
            : 'pendiente'
        return { ...it, status: next, updatedAt: new Date().toISOString() }
      })
    )
  }, [])

  const sectionItems = SECTIONS.map((s) => ({
    ...s,
    count: items.filter((i) => i.section === s.id && i.status !== 'completado').length,
    total: items.filter((i) => i.section === s.id).length,
  }))

  const visibleItems =
    activeSection === 'dashboard'
      ? []
      : items.filter(
          (i) =>
            i.section === activeSection &&
            (!searchQuery ||
              i.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
              (i.description || '').toLowerCase().includes(searchQuery.toLowerCase()))
        )

  const currentSection = SECTIONS.find((s) => s.id === activeSection)

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--bg-main)' }}>
      <Sidebar
        sections={sectionItems}
        activeSection={activeSection}
        onSelect={setActiveSection}
        onAdd={openAdd}
      />

      <div className="flex-1 flex flex-col overflow-hidden">
        <Header
          activeSection={currentSection}
          searchQuery={searchQuery}
          onSearch={setSearchQuery}
          onAdd={() => openAdd(activeSection !== 'dashboard' ? activeSection : 'por-hacer')}
        />

        <main className="flex-1 overflow-y-auto p-6">
          {activeSection === 'dashboard' ? (
            <Dashboard
              items={items}
              sections={sectionItems}
              onNavigate={setActiveSection}
              onAdd={openAdd}
              onToggle={toggleStatus}
              onEdit={openEdit}
              onDelete={deleteItem}
            />
          ) : (
            <ItemList
              items={visibleItems}
              section={currentSection}
              onAdd={() => openAdd(activeSection)}
              onToggle={toggleStatus}
              onEdit={openEdit}
              onDelete={deleteItem}
            />
          )}
        </main>
      </div>

      {showModal && (
        <AddModal
          item={editingItem}
          defaultSection={defaultSection}
          sections={SECTIONS}
          onSave={saveItem}
          onClose={() => { setShowModal(false); setEditingItem(null) }}
        />
      )}
    </div>
  )
}
