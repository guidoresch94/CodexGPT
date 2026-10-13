# Mi Vida / Mi Wallet 2.0 — contexto para Claude

App personal de Guido (Barcelona). Requisitos completos en [`docs/PRD.md`](docs/PRD.md).

- Idioma **es-ES**, moneda **EUR**, fechas DD/MM/AAAA, semana empieza en **lunes**.
- Stack: Vite + React + TypeScript + Tailwind v4 + Recharts + Dexie (IndexedDB) + vite-plugin-pwa.
- Local-first: sin backend, login, nube ni IA (salvo que se pida).
- Principio clave: registrar un gasto en **< 5 segundos** desde el móvil.

## Estructura
```
src/app/        App, router por hash, navegación, contexto de acciones (openTx)
src/db/         schema Dexie, seed (datos reales + ejemplo), hooks (useData), backup JSON/CSV
src/lib/        dates (lunes), format (€), calc (presupuesto, semana, proyección, huchas, avisos)
src/components/ UI común: Card, Sheet, ProgressBar, NumPad, Pickers, Toast
src/modules/    dashboard (+ revisión semanal), finanzas, habitos, objetivos (metas: objetivos, huchas, ideas), ajustes
```

## Reglas del dominio
- Gasto compartido: cuenta solo `shared.myShare` (`net()` en `lib/calc.ts`).
- Gasto con `fundId` = pagado desde una hucha: NO cuenta en el presupuesto mensual, resta de la hucha.
- `transferencia` + `fundId` = aportación a hucha (ahorro).
- Subcategorías suman en su categoría raíz.
- Datos de ejemplo marcados con `sample: true` (borrables desde Ajustes).
- "Para el día a día" = presupuesto de categorías raíz `variable` − gasto; ritmo ideal lineal en el mes (`monthPace`).
- Puntuación semanal = 70 % hábitos (progreso medio vs objetivo semanal) + 30 % dinero (`moneyScore`).
- Se publica como artefacto de Claude: `npm run build:artifact` → `dist-artifact/mi-vida.html`; datos en `db` privado (`data/users/<id>`), ver `src/db/cloud.ts`.

## Comandos
- `npm run dev` · `npm run build` · `npm run typecheck`
