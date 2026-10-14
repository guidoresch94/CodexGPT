# PRD — App personal "Mi Vida / Mi Wallet 2.0"

> Idioma de la app: **español (es-ES)**, moneda **EUR**, formato de fecha DD/MM/AAAA, semana empieza el **lunes**.

## 1. Quién soy y para qué es la app
- Guido, consultor funcional D365 SCM, vive en Barcelona.
- El **30/10/2026** se muda a su primer piso solo (alquiler, 1.250 €/mes).
- Una sola app para: controlar todos los gastos con presupuesto mensual y semanal; objetivos de ahorro (huchas) y gastos únicos (fianza, mudanza, muebles); medir crecimiento personal (gimnasio, deporte, cultura, instrumento…); guardar ideas y convertirlas en objetivos; ver todo de forma intuitiva y que la app ayude a mejorar (alertas, rachas, revisión semanal).
- Versión 2.0 de "Mi Wallet" (estética fintech oscura, Recharts).

**Principio clave:** registrar algo debe llevar **menos de 5 segundos** desde el móvil.

## 2. Stack técnico
Vite + React + TypeScript + Tailwind · Recharts · local-first con IndexedDB (Dexie) · PWA instalable offline · exportar/importar JSON y CSV · mobile-first, tema oscuro por defecto · módulos `finanzas`, `hogar`, `objetivos`, `habitos`, `ideas`, `dashboard`.

## 3. Datos reales (seed)
### Ingresos
- Nómina neta 2.717 €/mes (12 pagas). Bonus anual variable → 100 % a ahorro.

### Presupuesto mensual
| Categoría | €/mes | Tipo |
|---|---|---|
| Alquiler | 1.250 | Fijo (día 1–7) |
| Suministros (luz, agua, internet) | 155 | Fijo variable |
| Supermercado | 300 | Variable (semanal) |
| Restaurantes, bares y ocio (incl. Bizum) | 300 | Variable (semanal) |
| Delivery y cafés | 35 | Variable (semanal) |
| Transporte (Bicing + T-10/T-Usual) | 30 | Variable |
| Deporte (gimnasio, pádel, basket) | 75 | Semi-fijo |
| Compras (ropa, tech, casa) | 60 | Variable |
| Tabaco | 48 (objetivo 0) | Hábito a reducir |
| Seguro salud, móvil, suscripciones, farmacia | 55 | Fijo |
| Imprevistos | 50 | Colchón |
| Ahorro (hucha) | 300 | Día de cobro |
| Viajes (hucha) | 100 | Día de cobro |

Categorías editables (crear, renombrar, archivar, color/icono, subcategorías). Histórico ene–sep 2026: ~1.850 €/mes (ocio+Bizum ~434, súper ~282, transporte ~75, delivery+cafés ~73).

### Sistema de dinero
1. Día de cobro: alquiler → ahorro (300) → viajes (100). "Págate primero".
2. Fijos domiciliados.
3. Tarjeta de gasto semanal ≈ 165 €/semana (súper + ocio + cafés + transporte).
4. Domingo: revisión semanal de 5 min.
5. Mensual: comparar con el presupuesto y ajustar UNA categoría.

### Gastos únicos "Mudanza" (de ahorros)
Fianza 1.250 € · Prorrata octubre ~80 € · Noviembre 1.250 € · Mudanza + casa 500–1.000 €.

### Contrato de alquiler
Inicio 30/10/2026 · 1 año (prórrogas hasta 5) · 1.250 €, pago día 1–7 · IPC cada 30/10 con aviso · fianza 1.250 € · desistimiento tras 6 meses con 30 días de aviso (desde 30/04/2027) · suministros a mi cargo; IBI y comunidad del propietario.

## 4. Módulos
### 4.1 Finanzas (prioridad máxima)
Alta rápida (botón flotante → importe → categoría → guardar; nota, fecha, método opcionales) · gasto/ingreso/transferencia a hucha · recurrentes mensuales marcables como pagados · presupuesto por categoría (verde < 80 %, ámbar 80–100 %, rojo > 100 %) · tarjeta semanal (queda / por día hasta el domingo) · proyección de fin de mes · gastos compartidos/Bizum (solo cuenta mi parte) · importar extracto BBVA con reglas editables sin duplicados · informes (donut, barras mensuales, mes vs anterior vs presupuesto, tasa de ahorro) · % del sueldo en vivienda (objetivo ≤ 52 %).

### 4.2 Hogar / Piso
Suministros (factura, periodo, consumo, evolución) · recordatorios (alquiler día 1, IPC 30/10, fin primer año, desistimiento 30/04/2027) · inventario de entrada con fotos (MVP+) · congelador/batch cooking con caducidades (MVP+).

### 4.3 Objetivos y huchas
Huchas con meta y fecha (emergencia, viajes, mudanza, bonus), progreso, aportación mensual necesaria, historial. Objetivos no monetarios (dejar el tabaco, carnet A2, 3 canciones de guitarra).

### 4.4 Crecimiento personal
Actividades: gimnasio, basket (1/sem), pádel, running; añadir cultura e instrumento. Hábito = nombre, icono, área, unidad (veces, min, km, páginas, sí/no), objetivo semanal. Check-in en 1 toque, rachas, mapa de calor, % mensual, coste por uso, puntuación semanal de bienestar (0–100, explicable), registro de cultura (libros, pelis, expos, conciertos con nota y coste).

### 4.5 Ideas
Bandeja rápida (texto + etiqueta) con estados nueva / evaluando / convertida / descartada; convertir en objetivo o hucha.

### 4.6 Dashboard
Esta semana (tarjeta, gasto por día, hábitos de hoy) · este mes (ingreso vs gasto vs ahorro, top 3, alertas) · huchas · revisión semanal guiada (4 pasos, histórico) · insights por reglas.

## 5. Modelo de datos (orientativo)
Category, Transaction, Recurring, Fund, FundMovement, Goal, Habit, HabitLog, CultureItem, UtilityBill, FreezerItem, Idea, WeeklyReview, Settings, CategorizationRule.

## 6. Fases
- **Fase 1 (MVP):** alta rápida, categorías con presupuesto, recurrentes, presupuesto semanal, huchas, dashboard básico, export/import JSON, PWA. ✅
- **Fase 2:** hábitos (check-in, rachas, mapa de calor, coste por uso), revisión semanal guiada, insights.
- **Fase 3:** extracto BBVA con reglas, suministros con gráficos, cultura, ideas → objetivos, congelador, inventario.

## 7. Forma de trabajar
Resumir antes de programar cada fase · código limpio y tipado, componentes pequeños · datos de ejemplo realistas con botón para borrarlos · nada de login, nube ni IA en el MVP · al terminar cada fase: cómo arrancar, cómo instalar como PWA y qué queda pendiente.

## Anexo A — Reglas de autocategorización BBVA (regex, minúsculas)
| Categoría | Patrón |
|---|---|
| Supermercado | `lidl\|mercadona\|alcampo\|consum\|caprabo\|condis\|coviran\|ametller\|bonpreu\|carrefour\|aldi\|spar` |
| Transporte | `bicing\|renfe\|mobilitat\|tmb\|taxi\|free-now\|uber \*trip\|cabify\|bolt` |
| Delivery y cafés | `uber \*eats\|glovo\|just eat\|mc ?donald\|burger king\|telepizza\|granier\|starbucks\|forn\|cafe` |
| Deporte | `basic.?fit\|padel\|decathlon` |
| Viajes | `booking\|ryanair\|vueling\|airbnb\|hotel\|gotogate\|kayak` |
| Compras | `amazon\|zara\|primark\|ikea\|leroy\|pccomponentes\|h&m\|mango` |
| Suscripciones y móvil | `spotify\|netflix\|google\|apple\|hbo\|disney\|vodafone` |
| Seguro y salud | `sanitas\|farmacia\|clinic` |
| Tabaco | `estanc\|tabac` |
| Bizum / amigos | `bizum\|transferencia realizada` |
| (por defecto) | Restaurantes, bares y ocio |

Reglas editables; al recategorizar a mano, ofrecer "crear regla a partir de esto".
