import { ArrowLeft, ChevronRight, Download, Upload, X } from 'lucide-react'
import { useRef, useState } from 'react'
import { go } from '../../app/router'
import { db } from '../../db/schema'
import type { AppData } from '../../db/hooks'
import { download, exportBackup, importBackup, transactionsCsv } from '../../db/backup'
import { clearSamples, seedAll } from '../../db/seed'
import { today } from '../../lib/dates'
import { parseAmount } from '../../lib/format'
import type { Settings, Theme } from '../../types'
import { useToast } from '../../components/Toast'
import { Button, Card, Field, Input, PageHeader, Segmented, SectionTitle } from '../../components/ui'

export function Ajustes({ data }: { data: AppData }) {
  const toast = useToast()
  const { settings } = data
  const fileRef = useRef<HTMLInputElement>(null)
  const [method, setMethod] = useState('')
  const samples = data.transactions.filter((t) => t.sample).length

  const set = (patch: Partial<Settings>) => db.settings.put({ ...settings, ...patch })

  const exportJson = async () => {
    const b = await exportBackup()
    download(`mi-vida-${today()}.json`, JSON.stringify(b, null, 2), 'application/json')
    toast({ text: 'Copia descargada' })
  }

  const importJson = async (file?: File) => {
    if (!file) return
    try {
      const parsed = JSON.parse(await file.text())
      if (!confirm('Esto reemplaza TODOS los datos actuales por los de la copia. ¿Continuar?')) return
      await importBackup(parsed)
      toast({ text: 'Copia restaurada ✓' })
    } catch (e) {
      alert(e instanceof Error ? e.message : 'No se pudo leer el archivo.')
    } finally {
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const exportCsv = () =>
    download(`movimientos-${today()}.csv`, transactionsCsv(data.transactions, data.catMap, (id) => data.fundMap.get(id ?? '')?.name ?? ''), 'text/csv;charset=utf-8')

  const removeSamples = async () => {
    if (!confirm(`Se borrarán ${samples} movimientos de ejemplo. Tus categorías, presupuestos, fijos y huchas se quedan. ¿Continuar?`)) return
    const n = await clearSamples()
    toast({ text: `${n} movimientos de ejemplo borrados` })
  }

  const reset = async () => {
    if (!confirm('Se borra TODO (movimientos, cambios en categorías y huchas) y vuelve a la configuración inicial sin datos de ejemplo. ¿Seguro? Haz antes una copia.')) return
    await seedAll(false)
    toast({ text: 'App reiniciada' })
  }

  const addMethod = () => {
    const m = method.trim()
    if (!m || settings.paymentMethods.includes(m)) return
    set({ paymentMethods: [...settings.paymentMethods, m] })
    setMethod('')
  }

  return (
    <div>
      <button onClick={() => go('inicio')} className="flex items-center gap-1 pt-2 text-sm text-slate-500">
        <ArrowLeft size={16} /> Inicio
      </button>
      <PageHeader title="Ajustes" />

      <SectionTitle>Tú</SectionTitle>
      <Card className="space-y-4">
        <Field label="Nombre">
          <Input defaultValue={settings.name} onBlur={(e) => set({ name: e.target.value.trim() || 'tú' })} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Ingreso mensual neto (€)">
            <Input inputMode="decimal" defaultValue={String(settings.monthlyIncome)} onBlur={(e) => set({ monthlyIncome: parseAmount(e.target.value) })} />
          </Field>
          <Field label="Tarjeta semanal (€)" hint="Súper, ocio, cafés, transporte">
            <Input inputMode="decimal" defaultValue={String(settings.weeklyAllowance)} onBlur={(e) => set({ weeklyAllowance: parseAmount(e.target.value) })} />
          </Field>
        </div>
        <Field label="Objetivo máx. de sueldo en vivienda (%)">
          <Input inputMode="numeric" defaultValue={String(settings.housingTarget)} onBlur={(e) => set({ housingTarget: parseAmount(e.target.value) || 52 })} />
        </Field>
      </Card>

      <SectionTitle>Apariencia</SectionTitle>
      <Card>
        <Segmented<Theme>
          value={settings.theme}
          onChange={(theme) => set({ theme })}
          options={[
            { value: 'oscuro', label: '🌙 Oscuro' },
            { value: 'claro', label: '☀️ Claro' },
            { value: 'sistema', label: '📱 Sistema' },
          ]}
        />
      </Card>

      <SectionTitle>Personalizar</SectionTitle>
      <Card className="divide-y divide-slate-100 p-0 dark:divide-white/5">
        <LinkRow label="Categorías y presupuestos" onClick={() => go('categorias')} />
        <LinkRow label="Fijos y recurrentes" onClick={() => go('fijos')} />
        <LinkRow label="Huchas" onClick={() => go('huchas')} />
      </Card>

      <SectionTitle>Métodos de pago</SectionTitle>
      <Card>
        <div className="flex flex-wrap gap-2">
          {settings.paymentMethods.map((m) => (
            <span key={m} className="flex items-center gap-1 rounded-full bg-slate-100 py-1 pl-3 pr-1.5 text-xs dark:bg-white/10">
              {m}
              <button onClick={() => set({ paymentMethods: settings.paymentMethods.filter((x) => x !== m) })} aria-label={`Quitar ${m}`} className="rounded-full p-0.5 hover:bg-slate-200 dark:hover:bg-white/10">
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
        <div className="mt-3 flex gap-2">
          <Input value={method} onChange={(e) => setMethod(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addMethod()} placeholder="Ej. Revolut" />
          <Button variant="soft" onClick={addMethod}>Añadir</Button>
        </div>
      </Card>

      <SectionTitle>Copia de seguridad</SectionTitle>
      <Card className="space-y-2">
        <p className="text-xs text-slate-500 dark:text-slate-400">Tus datos viven solo en este dispositivo. Descarga una copia de vez en cuando (por ejemplo, a Google Drive).</p>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="soft" className="flex items-center justify-center gap-2" onClick={exportJson}><Download size={16} /> Exportar</Button>
          <Button variant="soft" className="flex items-center justify-center gap-2" onClick={() => fileRef.current?.click()}><Upload size={16} /> Importar</Button>
        </div>
        <Button variant="ghost" className="w-full" onClick={exportCsv}>Exportar movimientos a CSV (Excel)</Button>
        <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => importJson(e.target.files?.[0])} />
      </Card>

      <SectionTitle>Datos</SectionTitle>
      <Card className="space-y-2">
        {samples > 0 && (
          <Button variant="soft" className="w-full" onClick={removeSamples}>
            Borrar datos de ejemplo ({samples} movimientos)
          </Button>
        )}
        <Button variant="danger" className="w-full" onClick={reset}>Empezar de cero</Button>
      </Card>

      <p className="mt-8 text-center text-[11px] text-slate-400">Mi Vida · v0.1 (fase 1) · datos guardados en el dispositivo</p>
    </div>
  )
}

function LinkRow({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex w-full items-center justify-between px-4 py-3.5 text-left text-sm">
      {label}
      <ChevronRight size={16} className="text-slate-400" />
    </button>
  )
}
