import { useState, useEffect } from 'react'
import { X } from 'lucide-react'

const PRIORITY_OPTIONS = [
  { value: 'alta', label: '🔴 Alta', color: '#ef4444' },
  { value: 'media', label: '🟡 Media', color: '#f59e0b' },
  { value: 'baja', label: '🟢 Baja', color: '#22c55e' },
]

const FREQUENCY_OPTIONS = [
  { value: 'diaria', label: 'Diaria' },
  { value: 'semanal', label: 'Semanal' },
  { value: 'mensual', label: 'Mensual' },
  { value: 'personalizada', label: 'Personalizada' },
]

const DESEO_TYPES = [
  { value: 'quiero', label: '🌟 Quiero' },
  { value: 'me-gusta', label: '❤️ Me gusta' },
]

const DESEO_CATEGORIES = [
  'viaje', 'libro', 'película', 'serie', 'comida', 'música', 'deporte', 'hobby', 'aprender', 'otro'
]

function Field({ label, children, required }) {
  return (
    <div>
      <label className="block text-xs font-medium mb-1.5" style={{ color: '#9ca3af' }}>
        {label} {required && <span style={{ color: '#ef4444' }}>*</span>}
      </label>
      {children}
    </div>
  )
}

const inputCls = 'w-full px-3 py-2 text-sm rounded-lg border transition-all'

export default function AddModal({ item, defaultSection, sections, onSave, onClose }) {
  const [form, setForm] = useState({
    section: item?.section || defaultSection || 'por-hacer',
    title: '',
    description: '',
    priority: 'media',
    dueDate: '',
    // Burocracia
    institution: '',
    docType: '',
    // Rutinas
    frequency: 'diaria',
    scheduleTime: '',
    // Obligaciones
    amount: '',
    isRecurring: false,
    recurringDay: '',
    // Deseos
    deseoType: 'quiero',
    deseoCategory: 'otro',
    // Tags
    tagsInput: '',
    tags: [],
    ...item,
  })

  useEffect(() => {
    if (item) {
      setForm({
        section: item.section,
        title: item.title || '',
        description: item.description || '',
        priority: item.priority || 'media',
        dueDate: item.dueDate || '',
        institution: item.institution || '',
        docType: item.docType || '',
        frequency: item.frequency || 'diaria',
        scheduleTime: item.scheduleTime || '',
        amount: item.amount || '',
        isRecurring: item.isRecurring || false,
        recurringDay: item.recurringDay || '',
        deseoType: item.deseoType || 'quiero',
        deseoCategory: item.deseoCategory || 'otro',
        tagsInput: (item.tags || []).join(', '),
        tags: item.tags || [],
      })
    }
  }, [item])

  const set = (key, val) => setForm((f) => ({ ...f, [key]: val }))

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!form.title.trim()) return

    const tags = form.tagsInput
      .split(',')
      .map((t) => t.trim().replace(/^#/, ''))
      .filter(Boolean)

    const data = {
      section: form.section,
      title: form.title.trim(),
      description: form.description.trim(),
      priority: form.priority,
      dueDate: form.dueDate || null,
      tags,
    }

    if (form.section === 'burocracia') {
      data.institution = form.institution
      data.docType = form.docType
    }
    if (form.section === 'rutinas') {
      data.frequency = form.frequency
      data.scheduleTime = form.scheduleTime
    }
    if (form.section === 'obligaciones') {
      data.amount = form.amount
      data.isRecurring = form.isRecurring
      data.recurringDay = form.recurringDay
    }
    if (form.section === 'deseos') {
      data.deseoType = form.deseoType
      data.deseoCategory = form.deseoCategory
    }

    onSave(data)
  }

  const currentSection = sections.find((s) => s.id === form.section)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full max-w-lg rounded-2xl border shadow-2xl animate-slide-up overflow-hidden"
        style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-light)' }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4 border-b"
          style={{ borderColor: 'var(--border)' }}
        >
          <div>
            <h2 className="font-semibold" style={{ color: '#e2e4f0' }}>
              {item ? 'Editar elemento' : 'Nuevo elemento'}
            </h2>
            {currentSection && (
              <p className="text-xs mt-0.5" style={{ color: currentSection.color }}>
                {currentSection.emoji} {currentSection.label}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg transition-colors hover:bg-white hover:bg-opacity-5"
          >
            <X size={16} style={{ color: '#6b7280' }} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Section selector */}
          <Field label="Sección" required>
            <div className="grid grid-cols-5 gap-1.5">
              {sections.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => set('section', s.id)}
                  className="flex flex-col items-center gap-1 py-2 px-1 rounded-lg text-xs font-medium transition-all border"
                  style={{
                    background: form.section === s.id ? s.bg : 'transparent',
                    borderColor: form.section === s.id ? s.border : 'var(--border)',
                    color: form.section === s.id ? s.color : '#6b7280',
                  }}
                >
                  <span className="text-base">{s.emoji}</span>
                  <span className="text-center leading-tight" style={{ fontSize: '10px' }}>
                    {s.label.split(' ')[0]}
                  </span>
                </button>
              ))}
            </div>
          </Field>

          {/* Title */}
          <Field label="Título" required>
            <input
              type="text"
              value={form.title}
              onChange={(e) => set('title', e.target.value)}
              placeholder={
                form.section === 'burocracia' ? 'Ej: Renovar DNI'
                : form.section === 'rutinas' ? 'Ej: Meditación matutina'
                : form.section === 'obligaciones' ? 'Ej: Pago alquiler'
                : form.section === 'deseos' ? 'Ej: Viajar a Japón'
                : 'Ej: Comprar regalo de cumpleaños'
              }
              className={inputCls}
              autoFocus
              required
            />
          </Field>

          {/* Description */}
          <Field label="Descripción">
            <textarea
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              placeholder="Detalles adicionales..."
              rows={2}
              className={inputCls}
              style={{ resize: 'none' }}
            />
          </Field>

          {/* Priority + Due date row */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Prioridad">
              <div className="flex gap-1">
                {PRIORITY_OPTIONS.map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => set('priority', p.value)}
                    className="flex-1 py-2 rounded-lg text-xs font-medium border transition-all"
                    style={{
                      background: form.priority === p.value ? `${p.color}22` : 'transparent',
                      borderColor: form.priority === p.value ? p.color : 'var(--border)',
                      color: form.priority === p.value ? p.color : '#6b7280',
                    }}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </Field>

            <Field label="Vencimiento">
              <input
                type="date"
                value={form.dueDate}
                onChange={(e) => set('dueDate', e.target.value)}
                className={inputCls}
              />
            </Field>
          </div>

          {/* Section-specific fields */}
          {form.section === 'burocracia' && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Institución">
                <input
                  type="text"
                  value={form.institution}
                  onChange={(e) => set('institution', e.target.value)}
                  placeholder="Ej: RENAPER, AFIP..."
                  className={inputCls}
                />
              </Field>
              <Field label="Tipo de trámite">
                <input
                  type="text"
                  value={form.docType}
                  onChange={(e) => set('docType', e.target.value)}
                  placeholder="Ej: Documento, Turno..."
                  className={inputCls}
                />
              </Field>
            </div>
          )}

          {form.section === 'rutinas' && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Frecuencia">
                <select
                  value={form.frequency}
                  onChange={(e) => set('frequency', e.target.value)}
                  className={inputCls}
                >
                  {FREQUENCY_OPTIONS.map((f) => (
                    <option key={f.value} value={f.value}>{f.label}</option>
                  ))}
                </select>
              </Field>
              <Field label="Horario">
                <input
                  type="time"
                  value={form.scheduleTime}
                  onChange={(e) => set('scheduleTime', e.target.value)}
                  className={inputCls}
                />
              </Field>
            </div>
          )}

          {form.section === 'obligaciones' && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Monto / Detalle">
                <input
                  type="text"
                  value={form.amount}
                  onChange={(e) => set('amount', e.target.value)}
                  placeholder="Ej: $1.500, USD 80..."
                  className={inputCls}
                />
              </Field>
              <Field label="Día del mes (si es fijo)">
                <input
                  type="number"
                  min="1"
                  max="31"
                  value={form.recurringDay}
                  onChange={(e) => set('recurringDay', e.target.value)}
                  placeholder="Ej: 1, 15..."
                  className={inputCls}
                />
              </Field>
            </div>
          )}

          {form.section === 'deseos' && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Tipo">
                <div className="flex gap-1">
                  {DESEO_TYPES.map((t) => (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => set('deseoType', t.value)}
                      className="flex-1 py-2 rounded-lg text-xs font-medium border transition-all"
                      style={{
                        background: form.deseoType === t.value ? 'rgba(236,72,153,0.12)' : 'transparent',
                        borderColor: form.deseoType === t.value ? '#ec4899' : 'var(--border)',
                        color: form.deseoType === t.value ? '#ec4899' : '#6b7280',
                      }}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </Field>
              <Field label="Categoría">
                <select
                  value={form.deseoCategory}
                  onChange={(e) => set('deseoCategory', e.target.value)}
                  className={inputCls}
                >
                  {DESEO_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c.charAt(0).toUpperCase() + c.slice(1)}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          )}

          {/* Tags */}
          <Field label="Etiquetas (separadas por coma)">
            <input
              type="text"
              value={form.tagsInput}
              onChange={(e) => set('tagsInput', e.target.value)}
              placeholder="Ej: urgente, familia, trabajo"
              className={inputCls}
            />
          </Field>
        </form>

        {/* Footer */}
        <div
          className="flex items-center justify-end gap-3 px-6 py-4 border-t"
          style={{ borderColor: 'var(--border)' }}
        >
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-all hover:bg-white hover:bg-opacity-5"
            style={{ color: '#6b7280' }}
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            className="px-5 py-2 rounded-lg text-sm font-semibold transition-all hover:opacity-90 active:scale-95"
            style={{ background: 'var(--gold)', color: '#0d0f1a' }}
          >
            {item ? 'Guardar cambios' : 'Agregar'}
          </button>
        </div>
      </div>
    </div>
  )
}
