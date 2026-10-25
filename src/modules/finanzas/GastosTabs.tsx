import { go, type Route } from '../../app/router'
import { Segmented } from '../../components/ui'

/** Cambia entre Movimientos y Presupuesto dentro de la pestaña Gastos */
export function GastosTabs({ value }: { value: 'movimientos' | 'presupuesto' }) {
  return (
    <div className="mb-3">
      <Segmented<Route>
        value={value}
        onChange={(r) => go(r)}
        options={[
          { value: 'movimientos', label: 'Movimientos' },
          { value: 'presupuesto', label: 'Presupuesto' },
        ]}
      />
    </div>
  )
}
