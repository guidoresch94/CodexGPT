# Mi Vida / Mi Wallet 2.0 — contexto para Claude

App personal de Guido (Barcelona). Requisitos completos en [`docs/PRD.md`](docs/PRD.md).

- Textos en **español rioplatense (voseo)**, moneda **EUR** con formato argentino (`€ 1.234,56`, ver `lib/format.ts`), fechas DD/MM/AAAA, semana empieza en **lunes**.
- Estilo visual Apple/iOS: grises agrupados, colores del sistema (paletas de Tailwind sobrescritas en `index.css`), anillos tipo Fitness. Se dice "ahorro", nunca "hucha".
- Stack: Vite + React + TypeScript + Tailwind v4 + Recharts + Dexie (IndexedDB) + vite-plugin-pwa.
- Local-first: sin backend, login, nube ni IA (salvo que se pida).
- Principio clave: registrar un gasto en **< 5 segundos** desde el móvil.

## Estructura
```
src/app/        App, router por hash, navegación, contexto de acciones (openTx)
src/db/         schema Dexie, seed (datos reales + ejemplo), hooks (useData), backup JSON/CSV
src/lib/        dates (lunes), format (€), calc (presupuesto, proyección, ahorros, avisos), habits, importer, xlsx, game
src/components/ UI común: Card, Sheet, ProgressBar, NumPad, Pickers, Toast
src/modules/    dashboard (+ revisión semanal), finanzas, habitos, objetivos (metas: objetivos, ahorros, ideas), ajustes
```

## Reglas del dominio
- Gasto compartido: cuenta solo `shared.myShare` (`net()` en `lib/calc.ts`).
- Gasto con `fundId` = pagado desde un ahorro: NO cuenta en el presupuesto mensual, resta de la hucha.
- `transferencia` + `fundId` = aportación a un ahorro.
- Subcategorías suman en su categoría raíz.
- Datos de ejemplo marcados con `sample: true` (borrables desde Ajustes).
- "Para el día a día" = presupuesto de categorías raíz `variable` − gasto; ritmo ideal lineal en el mes (`monthPace`).
- Puntuación semanal = 70 % hábitos (progreso prorrateado al día de la semana) + 30 % dinero (`moneyScore`). Anillos: hábitos, gasto al ritmo, ahorro del mes vs lo que el presupuesto deja libre.
- Unión gastos ↔ hábitos (`lib/habits.ts`): hábito con `linkedCategoryId` + `linkMode`:
  - `suma`: un gasto en esa categoría crea un `HabitLog` con `txId` (no se carga dos veces); al registrar el hábito se ofrece cargar el gasto.
  - `rompe` + `auto`: hábito "sin X" (tabaco); cada día desde `since` cuenta solo, salvo gasto en la categoría o recaída (`value: -1`). `quitSavings` calcula lo que no gastaste.
  - Usar siempre `data.byHabit` (registros efectivos), no `habitLogs` crudos, para progreso y rachas.
- Migraciones de datos en `seed.ts` (`ensureUpgrades`, `dataVersion`).
- Importar extractos (`lib/importer.ts`, `lib/xlsx.ts` lector/escritor .xlsx propio con fflate, `db/importTx.ts`):
  reglas aprendidas (`settings.merchantRules`, clave = `merchantKey`) > diccionario > pistas (concepto del Bizum).
  `importHash` evita duplicar; gastos cargados a mano parecidos se unen. Bizum recibido = `refund` (resta del gasto).
- IA (`lib/ai.ts`, capacidad `sample` del artefacto, con la cuenta de Claude de quien usa la app): «Cargar con IA» (texto libre, filas pegadas o foto de ticket → borradores que se revisan antes de guardar) y «Clasificar con IA» en la importación (sugerencia + motivo + nota por comercio). Fuera de Claude se oculta.
- Juego (`lib/game.ts`): puntos derivados de los datos (no se guardan), niveles, racha de días activos, desafío semanal y logros.
  Las celebraciones recuerdan lo visto en `localStorage` (solo comodidad).
- Se publica como artefacto de Claude: `npm run build:artifact` → `dist-artifact/mi-vida.html`; datos en `db` privado (`data/users/<id>`), ver `src/db/cloud.ts`.

## Comandos
- `npm run dev` · `npm run build` · `npm run typecheck`
