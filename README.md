# Mi Vida 💶

App personal (PWA, local-first) para controlar gastos, presupuesto semanal y mensual, fijos y huchas. Fase 1 del [PRD](docs/PRD.md).

## Arrancar
```bash
npm install
npm run dev        # http://localhost:5173 (y en tu red local: http://<IP-del-PC>:5173)
npm run build      # versión de producción en dist/
npm run preview    # sirve dist/ (aquí funciona el modo offline)
```

## Instalar en el móvil (Android)
La instalación como app y el modo offline necesitan **HTTPS** (o `localhost`).
1. **Recomendado – GitHub Pages:** en GitHub → *Settings → Pages → Source: GitHub Actions*. Cada push a `main` publica la app en `https://<usuario>.github.io/CodexGPT/`. Ábrela en Chrome → menú ⋮ → **Instalar aplicación**.
2. **Rápido para probar:** `npm run dev` y abre `http://<IP-del-PC>:5173` desde el móvil (misma wifi). Funciona, pero sin instalación ni offline.

Los datos se guardan **solo en el dispositivo** (IndexedDB). Haz copias desde *Ajustes → Copia de seguridad*.

## Qué incluye (fase 1)
- Alta rápida con teclado numérico y categorías ordenadas por uso (+ deshacer).
- Tarjeta de gasto semanal (165 €): lo que queda y cuánto puedes gastar por día.
- Presupuesto por categoría con colores, subcategorías, plan mensual y gráficos.
- Fijos/recurrentes que se marcan con un toque cada mes.
- Huchas con meta, fecha, aportación necesaria e historial; pagar gastos desde una hucha.
- Gastos compartidos (solo cuenta tu parte), proyección de ahorro, % del sueldo en vivienda, avisos.
- Todo personalizable: categorías, iconos, colores, presupuestos, fijos, huchas, métodos de pago, tema.
- Exportar/importar JSON, exportar CSV. Datos de ejemplo borrables.
