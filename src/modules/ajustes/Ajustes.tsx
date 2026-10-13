import { ArrowLeft, ChevronRight, Download, Upload, X } from 'lucide-react'
import { useRef, useState } from 'react'
import { go } from '../../app/router'
import { db } from '../../db/schema'
import type { AppData } from '../../db/hooks'
import { download, exportBackup, importBackup, transactionsCsv } from '../../db/backup'
import { clearSamples, seedAll } from '../../db/seed'
import { today } from '../../lib/dates'
import { parseAmount } from '../../lib/format'
import type { Backup, Settings, Theme } from '../../types'
import { useSyncStatus } from '../../db/cloud'
import { useToast } from '../../components/Toast'
import { Button, Card, Field, Input, PageHeader, Segmented, SectionTitle, Sheet } from '../../components/ui'

export function Ajustes({ data }: { data: AppData }) {
  const toast = useToast()
  const { settings } = data
  const fileRef = useRef<HTMLInputElement>(null)
  const [method, setMethod] = useState('')
  const samples = data.transactions.filter((t) => t.sample).length
  const sync = useSyncStatus()
  /** Confirmación dentro de la app (el visor de Claude no muestra confirm()) */
  const [ask, setAsk] = useState<{ text: string; ok: string; run: () => Promise<void> } | null>(null)

  const set = (patch: Partial<Settings>) => db.settings.put({ ...settings, ...patch })

  const exportJson = async () => {
    const b = await exportBackup()
    download(`mi-vida-${today()}.json`, JSON.stringify(b, null, 2), 'application/json')
    toast({ text: 'Copia descargada' })
  }

  const importJson = async (file?: File) => {
    if (!file) return
    try {
      const parsed = JSON.parse(await file.text()) as Backup
      if (parsed?.app !== 'mi-vida') throw new Error()
      setAsk({
        text: `Esto reemplaza TODOS tus datos actuales por los de la copia (${parsed.transactions?.length ?? 0} movimientos).`,
        ok: 'Restaurar copia',
        run: async () => {
          await importBackup(parsed)
          toast({ text: 'Copia restaurada ✓' })
        },
      })
    } catch {
      toast({ text: 'Ese archivo no es una copia de Mi Vida.' })
    } finally {
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const exportCsv = () =>
    download(`movimientos-${today()}.csv`, transactionsCsv(data.transactions, data.catMap, (id) => data.fundMap.get(id ?? '')?.name ?? ''), 'text/csv;charset=utf-8')

  const removeSamples = () =>
    setAsk({
      text: `Se borrarán ${samples} movimientos de ejemplo. Tus categorías, presupuestos, fijos y huchas se quedan.`,
      ok: 'Borrar ejemplos',
      run: async () => {
        const n = await clearSamples()
        toast({ text: `${n} movimientos de ejemplo borrados` })
      },
    })

  const reset = () =>
    setAsk({
      text: 'Se borra TODO (movimientos y cambios en categorías y huchas) y vuelve a la configuración inicial, sin datos de ejemplo.',
      ok: 'Borrar todo',
      run: async () => {
        await seedAll(false)
        toast({ text: 'App reiniciada' })
      },
    })

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
        <SyncLine status={sync} />
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

      <p className="mt-8 text-center text-[11px] text-slate-400">Mi Vida · v0.1 (fase 1)</p>

      <Sheet open={!!ask} onClose={() => setAsk(null)} title="¿Seguro?">
        {ask && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600 dark:text-slate-300">{ask.text}</p>
            <div className="flex gap-2">
              <Button variant="soft" className="flex-1" onClick={() => setAsk(null)}>Cancelar</Button>
              <Button
                variant="danger"
                className="flex-1 font-semibold"
                onClick={async () => {
                  const a = ask
                  setAsk(null)
                  await a.run()
                }}
              >
                {ask.ok}
              </Button>
            </div>
          </div>
        )}
      </Sheet>
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

function SyncLine({ status }: { status: ReturnType<typeof useSyncStatus> }) {
  const text: Record<typeof status, string> = {
    local: 'Tus datos se guardan en este dispositivo. Descarga una copia de vez en cuando.',
    conectando: 'Conectando con tu cuenta de Claude…',
    guardando: 'Guardando en tu cuenta de Claude…',
    guardado: '✓ Guardado en tu cuenta de Claude: lo verás igual en el móvil y en el ordenador.',
    error: 'No se pudo guardar en tu cuenta ahora mismo. Tus datos siguen en este dispositivo; se reintentará con el próximo cambio.',
  }
  const tone = status === 'guardado' ? 'text-emerald-600 dark:text-emerald-400' : status === 'error' ? 'text-amber-600 dark:text-amber-400' : 'text-slate-500 dark:text-slate-400'
  return <p className={`text-xs ${tone}`}>{text[status]}</p>
}
