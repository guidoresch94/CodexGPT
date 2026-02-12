import React, { useMemo, useState, useEffect } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Planificador 24–72h de camiones para sal en pastillas (prioridad) y sal fina.
 * Selector ES/EN. En EN: Pastillas → TABLETS, Sal fina → FINE SALT.
 */

// ---------- I18N ----------
const I18N = {
  es: {
    title: "Planificador 24h · Camiones de Sal",
    mode: "Modo: Viajes manuales · Recursos: CARGA/DESCARGA",
    production: "Producción & Materia Prima",
    machinesRunning: (n) => `Máquinas en funcionamiento (${n})`,
    uniformSpeed: "Velocidad uniforme",
    uniform: "Uniforme",
    suggestedInbound: "Sugerida por inbound sostenible",
    activeMachines: "Máquinas activas (0–10)",
    gramsPerPill: "Gramos/pastilla",
    initialInventory: "Inventario inicial (t) – Pastillas",
    truckCapacity: "Capacidad camión (t)",
    productTimes: "Tiempos por producto",
    phases: ["Conducir→carga", "Carga", "Cargar→planta", "Descarga"],
    turnsAndTrips: "Turnos & Viajes",
    addTripsNote:
      "Añade VIAJES dentro de cada turno. El plan encadena viajes y calcula fin según el producto.",
    expand: "Expandir",
    collapse: "Comprimir",
    threeShifts: "3 turnos · 8 h",
    shiftStart: "Inicio turno",
    shiftEndAuto: "Fin turno (auto)",
    trips: "Viajes",
    product: "Producto",
    start: "Inicio",
    end: "Fin",
    doesntFit: "No cabe en el turno",
    delete: "Eliminar",
    addTrip: "Añadir viaje",
    clearTrips: "Vaciar viajes",
    gantt24: "Gantt 24 h",
    inv72: "Inventario (72 h)",
    kpis: "KPIs",
    kpiConsumption: "Consumo (t/h)",
    kpiPillsHour: "Pastillas/h",
    kpiTrucksPills: "# camiones pastillas",
    kpiTonsDay: "t/día útiles (pastillas)",
    kpiDowntime: "Downtime por falta (min)",
    kpiSustainable: "Velocidad sostenible (u/h·máquina)",
    noMissions: "Sin misiones todavía. Añade viajes en los turnos.",
    lang: "Idioma",
    pills: "Pastillas",
    fineSalt: "Fina",
    pillsShort: "P",
    fineSaltShort: "F",
  },
  en: {
    title: "24h Planner · Salt Trucks",
    mode: "Mode: Manual trips · Resources: LOAD/UNLOAD",
    production: "Production & Raw Material",
    machinesRunning: (n) => `Machines running (${n})`,
    uniformSpeed: "Uniform speed",
    uniform: "Uniform",
    suggestedInbound: "Suggested by sustainable inbound",
    activeMachines: "Active machines (0–10)",
    gramsPerPill: "Grams per tablet",
    initialInventory: "Initial inventory (t) – TABLETS",
    truckCapacity: "Truck capacity (t)",
    productTimes: "Times per product",
    phases: ["Drive→Load", "Load", "Drive→Plant", "Unload"],
    turnsAndTrips: "Shifts & Trips",
    addTripsNote:
      "Add TRIPS inside each shift. The plan chains trips and computes end by product.",
    expand: "Expand",
    collapse: "Collapse",
    threeShifts: "3 shifts · 8 h",
    shiftStart: "Shift start",
    shiftEndAuto: "Shift end (auto)",
    trips: "Trips",
    product: "Product",
    start: "Start",
    end: "End",
    doesntFit: "Doesn't fit in shift",
    delete: "Delete",
    addTrip: "Add trip",
    clearTrips: "Clear trips",
    gantt24: "Gantt 24 h",
    inv72: "Inventory (72 h)",
    kpis: "KPIs",
    kpiConsumption: "Consumption (t/h)",
    kpiPillsHour: "TABLETS/h",
    kpiTrucksPills: "# trucks TABLETS",
    kpiTonsDay: "t/day useful (TABLETS)",
    kpiDowntime: "Downtime due to lack (min)",
    kpiSustainable: "Sustainable speed (u/h·machine)",
    noMissions: "No missions yet. Add trips in shifts.",
    lang: "Language",
    pills: "TABLETS",
    fineSalt: "FINE SALT",
    pillsShort: "T",
    fineSaltShort: "F",
  },
};

// ---------- Utilidades de tiempo ----------
const MINUTES_DAY = 24 * 60;
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const mm = (h, m = 0) => h * 60 + m;
const fmtHM = (mins) => {
  const m = Math.floor(((mins % 60) + 60) % 60);
  const h = Math.floor((((mins / 60) % 24) + 24) % 24);
  return `${("0" + h).slice(-2)}:${("0" + m).slice(-2)}`;
};
const toMinutes = (hhmm) => {
  if (!hhmm || typeof hhmm !== "string" || !hhmm.includes(":")) return 0;
  const [h, m] = hhmm.split(":").map((x) => Number(x) || 0);
  return clamp(h, 0, 23) * 60 + clamp(m, 0, 59);
};
const toHHMM = (mins) => fmtHM(((mins % MINUTES_DAY) + MINUTES_DAY) % MINUTES_DAY);
const ROT_START = mm(6, 0);
const rot = (t) => (t - ROT_START + MINUTES_DAY) % MINUTES_DAY;
const invRot = (x) => (x + ROT_START) % MINUTES_DAY;

// ---------- Datos por defecto ----------
const DEFAULT_MACHINES = [
  { id: "KILIAN 1", speed: 120000 },
  { id: "KILIAN 2", speed: 120000 },
  { id: "KILIAN 3", speed: 120000 },
  { id: "KILIAN 4", speed: 120000 },
  { id: "KILIAN 5", speed: 120000 },
  { id: "KILIAN 6", speed: 0 },
  { id: "KORSCH", speed: 150000 },
];

function defaultMachineName(i) {
  if (i < 6) return `KILIAN ${i + 1}`;
  if (i === 6) return "KORSCH";
  return `KILIAN ${i + 1}`;
}

const DEFAULT_TURNS = [
  {
    truckId: "Camión 1",
    blocks: [
      { start: mm(6, 0), duration: 8 * 60, trips: [{ product: "fina" }] },
      { start: mm(14, 0), duration: 8 * 60, trips: [] },
      { start: mm(22, 0), duration: 8 * 60, trips: [] },
    ],
  },
  {
    truckId: "Camión 2",
    blocks: [
      { start: mm(7, 0), duration: 8 * 60, trips: [{ product: "pastillas" }] },
      { start: mm(14, 0), duration: 8 * 60, trips: [] },
      { start: mm(22, 0), duration: 8 * 60, trips: [] },
    ],
  },
  {
    truckId: "Camión 3",
    blocks: [
      { start: mm(6, 0), duration: 8 * 60, trips: [] },
      { start: mm(14, 0), duration: 8 * 60, trips: [] },
      { start: mm(22, 0), duration: 8 * 60, trips: [] },
    ],
  },
];

const DEFAULT_MISSIONS = {
  pastillas: {
    name: "Pastillas",
    segments: [30, 100, 30, 45],
    color: "bg-emerald-500",
  },
  fina: {
    name: "Fina",
    segments: [30, 60, 30, 30],
    color: "bg-zinc-400",
  },
};

function inventoryProjection({ initialTons, consumptionTph, unloads, step = 5 }) {
  const DAYS = 3;
  const H = DAYS * MINUTES_DAY;
  const consPerMin = consumptionTph / 60.0;
  const pts = [];

  const rotated1 = (unloads || [])
    .map((u) => ({ x: rot(u.time), tons: u.tons }))
    .sort((a, b) => a.x - b.x);

  let uIdx1 = 0;
  let inv1 = initialTons;
  for (let x = 0; x <= MINUTES_DAY; x += step) {
    while (uIdx1 < rotated1.length && rotated1[uIdx1].x <= x) {
      inv1 += rotated1[uIdx1].tons;
      uIdx1++;
    }
    if (x > 0) inv1 = Math.max(0, inv1 - consPerMin * step);
    const tReal = invRot(x);
    pts.push({ t: tReal, tons: inv1 });
  }

  const ptsX = [];
  const baseArrivals = (unloads || [])
    .map((u) => ({ x: rot(u.time), tons: u.tons }))
    .sort((a, b) => a.x - b.x);

  const arrivals72h = [];
  for (let d = 0; d < DAYS; d++) {
    for (const a of baseArrivals) arrivals72h.push({ x: a.x + d * MINUTES_DAY, tons: a.tons });
  }
  arrivals72h.sort((a, b) => a.x - b.x);

  let uIdx = 0;
  let inv = initialTons;
  for (let x = 0; x <= H; x += step) {
    while (uIdx < arrivals72h.length && arrivals72h[uIdx].x <= x) {
      inv += arrivals72h[uIdx].tons;
      uIdx++;
    }
    if (x > 0) inv = Math.max(0, inv - consPerMin * step);
    ptsX.push({ x, tons: inv });
  }

  return { pts, ptsX, horizon: H };
}

function sustainableSpeedPerMachine({ missionMins, trucks = 2, gramsPerUnit, machines }) {
  const inboundTph = (trucks * 25) / (missionMins / 60);
  const tphPerMachine = inboundTph / Math.max(1, machines.length);
  const unitsPerHourPerMachine = (tphPerMachine * 1_000_000) / gramsPerUnit;
  return Math.max(1000, Math.floor(unitsPerHourPerMachine));
}

function buildPlanFromTrips({
  turns,
  missionDefs,
  initialInventoryTons,
  truckCapacityTons,
  gramsPerUnit,
  machines,
}) {
  const tripsByTruck = {};
  for (const t of turns || []) {
    const truckId = t.truckId;
    for (const block of t.blocks || []) {
      const base = Number(block.start || 0);
      const trips = Array.isArray(block.trips) ? block.trips : [];
      for (let idx = 0; idx < trips.length; idx++) {
        const trip = trips[idx];
        const segs = missionDefs[trip.product]?.segments || [0, 0, 0, 0];

        let startTime;
        if (trip.customStart !== undefined) {
          startTime = trip.customStart;
        } else {
          const priorTrips = trips.slice(0, idx);
          const priorDur = priorTrips.reduce((acc, tr) => {
            const priorSegs = missionDefs[tr.product]?.segments || [0, 0, 0, 0];
            return acc + priorSegs.reduce((a, b) => a + b, 0);
          }, 0);
          startTime = base + priorDur;
        }

        tripsByTruck[truckId] = tripsByTruck[truckId] || [];
        tripsByTruck[truckId].push({
          product: trip.product,
          d1: segs[0] || 0,
          d2: segs[1] || 0,
          d3: segs[2] || 0,
          d4: segs[3] || 0,
          notBefore: startTime,
        });
      }
    }
  }

  const missions = [];
  const unloads = [];
  const loadBusy = [];
  const unloadBusy = [];
  const UNLOAD_INCREMENT_MIN = 5;

  const trucks = Object.keys(tripsByTruck).map((id) => ({
    id,
    list: tripsByTruck[id],
    idx: 0,
    availableAt: 0,
  }));

  let loadFreeAt = 0;
  let unloadFreeAt = 0;

  while (true) {
    const candidates = trucks
      .map((tk) => {
        const trip = tk.list[tk.idx];
        if (!trip) return null;
        const startDrive = Math.max(tk.availableAt, trip.notBefore);
        const arriveLoad = startDrive + trip.d1;
        return { tk, trip, startDrive, arriveLoad };
      })
      .filter(Boolean);

    if (candidates.length === 0) break;

    candidates.sort((a, b) => a.arriveLoad - b.arriveLoad);
    const { tk, trip, startDrive } = candidates[0];

    const s1 = startDrive;
    const e1 = s1 + trip.d1;
    const s2 = e1;
    const s2a = Math.max(s2, loadFreeAt);
    const e2a = s2a + trip.d2;
    loadFreeAt = e2a;

    const s3a = e2a;
    const e3a = s3a + trip.d3;
    const s4 = e3a;
    const s4a = Math.max(s4, unloadFreeAt);
    const e4a = s4a + trip.d4;
    unloadFreeAt = e4a;

    missions.push({
      product: trip.product,
      start: s1 % MINUTES_DAY,
      end: e4a % MINUTES_DAY,
      truckId: tk.id,
      segments: [
        { label: "Drive→Load", start: s1 % MINUTES_DAY, end: e1 % MINUTES_DAY },
        { label: "Load", start: s2a % MINUTES_DAY, end: e2a % MINUTES_DAY },
        { label: "Drive→Plant", start: s3a % MINUTES_DAY, end: e3a % MINUTES_DAY },
        { label: "Unload", start: s4a % MINUTES_DAY, end: e4a % MINUTES_DAY },
      ],
      unloadStart: s4a % MINUTES_DAY,
      unloadEnd: e4a % MINUTES_DAY,
    });

    loadBusy.push([s2a % MINUTES_DAY, e2a % MINUTES_DAY]);
    unloadBusy.push([s4a % MINUTES_DAY, e4a % MINUTES_DAY]);

    if (trip.product === "pastillas") {
      const dur = Math.max(1, e4a - s4a);
      const n = Math.max(1, Math.ceil(dur / UNLOAD_INCREMENT_MIN));
      const per = truckCapacityTons / n;
      for (let i = 1; i <= n; i++) {
        const tMin = s4a + Math.min(i * UNLOAD_INCREMENT_MIN, dur);
        unloads.push({ time: tMin % MINUTES_DAY, tons: per, truckId: tk.id });
      }
    }

    tk.availableAt = e4a;
    tk.idx += 1;
  }

  const totalUnitsPerHour = machines.reduce((acc, m) => acc + (m.speed || 0), 0);
  const consumptionTph = (totalUnitsPerHour * gramsPerUnit) / 1_000_000;

  const inv = inventoryProjection({
    initialTons: initialInventoryTons,
    consumptionTph,
    unloads: unloads.slice().sort((a, b) => a.time - b.time),
    step: 5,
  });

  const missionMins = (DEFAULT_MISSIONS.pastillas.segments || []).reduce((a, b) => a + b, 0) || 1;
  const sustainableUniform = sustainableSpeedPerMachine({
    missionMins,
    trucks: Object.keys(tripsByTruck).length || 1,
    gramsPerUnit,
    machines,
  });

  const kpis = {
    consumptionTph: Number(consumptionTph.toFixed(3)),
    pillsPerHour: Math.floor((consumptionTph * 1_000_000) / gramsPerUnit),
    trucksPastillas: missions.filter((m) => m.product === "pastillas").length,
    tonsPastillas: missions.filter((m) => m.product === "pastillas").length * truckCapacityTons,
    downtimeByLack: inv.pts.filter((p) => p.tons <= 0).length * 5,
    sustainableUniform,
  };

  return {
    missions: missions.sort((a, b) => a.start - b.start),
    unloads: unloads.sort((a, b) => a.time - b.time),
    inv,
    kpis,
    loadBusy,
    unloadBusy,
  };
}

function KPI({ label, value }) {
  return (
    <div className="border rounded-xl p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold">{String(value ?? "–")}</div>
    </div>
  );
}

function splitSpan(start, end) {
  start = ((start % MINUTES_DAY) + MINUTES_DAY) % MINUTES_DAY;
  end = ((end % MINUTES_DAY) + MINUTES_DAY) % MINUTES_DAY;
  if (start <= end) return [[start, end]];
  return [
    [start, MINUTES_DAY],
    [0, end],
  ];
}

function Gantt({ lang, missions = [] }) {
  const t = I18N[lang];
  if (!missions || missions.length === 0) {
    return <div className="text-sm text-muted-foreground">{t.noMissions}</div>;
  }

  const byTruck = {};
  for (const m of missions) {
    byTruck[m.truckId] = byTruck[m.truckId] || [];
    byTruck[m.truckId].push(m);
  }

  return (
    <div className="space-y-4">
      <div className="w-full h-6 relative border rounded-lg overflow-hidden bg-white">
        {Array.from({ length: 24 }).map((_, i) => (
          <div
            key={i}
            className="absolute top-0 bottom-0 border-l text-[10px] flex items-center justify-center"
            style={{ left: `${(i / 24) * 100}%`, width: `${(1 / 24) * 100}%` }}
          >
            {fmtHM(invRot(Math.floor((i / 24) * MINUTES_DAY)))}
          </div>
        ))}
      </div>

      {Object.entries(byTruck).map(([truckId, list]) => (
        <div key={truckId} className="space-y-2">
          <div className="text-sm font-medium">{truckId}</div>
          <div className="w-full h-10 relative border rounded-xl overflow-hidden bg-white">
            {list.map((m, idx) => {
              const baseSpans = splitSpan(rot(m.start), rot(m.end));
              const loadSeg = m.segments.find((s) => s.label === "Load");
              const unloadSeg = m.segments.find((s) => s.label === "Unload");
              const loadSpans = loadSeg ? splitSpan(rot(loadSeg.start), rot(loadSeg.end)) : [];
              const unloadSpans = unloadSeg ? splitSpan(rot(unloadSeg.start), rot(unloadSeg.end)) : [];

              return (
                <React.Fragment key={`frag-${idx}`}>
                  {baseSpans.map(([s, e], j) => (
                    <div
                      key={`base-${idx}-${j}`}
                      className={`absolute top-0 bottom-0 ${m.product === "pastillas" ? "bg-emerald-300" : "bg-zinc-300"} ring-2 ring-black`}
                      title={`${m.product} ${fmtHM(m.start)}→${fmtHM(m.end)}`}
                      style={{ left: `${(s / MINUTES_DAY) * 100}%`, width: `${((e - s) / MINUTES_DAY) * 100}%`, zIndex: 1 }}
                    />
                  ))}

                  {loadSpans.map(([s, e], j) => (
                    <div
                      key={`load-${idx}-${j}`}
                      className="absolute top-0 bottom-0 bg-orange-400/80"
                      title={`Carga ${fmtHM(loadSeg.start)}→${fmtHM(loadSeg.end)}`}
                      style={{ left: `${(s / MINUTES_DAY) * 100}%`, width: `${((e - s) / MINUTES_DAY) * 100}%`, zIndex: 2 }}
                    />
                  ))}

                  {unloadSpans.map(([s, e], j) => (
                    <div
                      key={`unload-${idx}-${j}`}
                      className="absolute top-0 bottom-0 bg-blue-400/80"
                      title={`Descarga ${fmtHM(unloadSeg.start)}→${fmtHM(unloadSeg.end)}`}
                      style={{ left: `${(s / MINUTES_DAY) * 100}%`, width: `${((e - s) / MINUTES_DAY) * 100}%`, zIndex: 3 }}
                    />
                  ))}
                </React.Fragment>
              );
            })}

            {(() => {
              const sorted = list.slice().sort((a, b) => rot(a.start) - rot(b.start));
              return sorted.map((m, i) =>
                i === 0 ? null : (
                  <div
                    key={`sep-${i}`}
                    className="absolute top-1 bottom-1 w-[2px] bg-black/80"
                    style={{ left: `${(rot(m.start) / MINUTES_DAY) * 100}%` }}
                    title={`Separador viaje ${i + 1}`}
                  />
                )
              );
            })()}
          </div>
        </div>
      ))}
    </div>
  );
}

function InventoryChart({ invPts, horizon }) {
  const data = (invPts || []).map((p) => ({ x: p.x, tons: Number(p.tons.toFixed(3)) }));
  const xTicks = Array.from({ length: 13 }).map((_, i) => Math.floor((i / 12) * horizon));

  const tickFmt = (x) => {
    const day = Math.floor(x / MINUTES_DAY) + 1;
    const hhmm = fmtHM(invRot(x % MINUTES_DAY));
    return `D${day} ${hhmm}`;
  };

  return (
    <div className="w-full h-72">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="x" ticks={xTicks} tickFormatter={tickFmt} />
          <YAxis yAxisId="left" />
          <Tooltip labelFormatter={(x) => tickFmt(x)} formatter={(v) => [`${v} t`, "Inventario"]} />
          <ReferenceLine y={0} yAxisId="left" strokeDasharray="3 3" />
          <Line type="monotone" dataKey="tons" yAxisId="left" dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function App() {
  const [lang, setLang] = useState("es");
  const t = I18N[lang];
  const productName = (key) => (key === "pastillas" ? t.pills : t.fineSalt);

  const [machines, setMachines] = useState(DEFAULT_MACHINES);
  const [machineCount, setMachineCount] = useState(7);
  const [linkMachineSpeeds, setLinkMachineSpeeds] = useState(true);
  const [uniformSpeed, setUniformSpeed] = useState(120000);
  const [gramsPerUnit, setGramsPerUnit] = useState(14.5);
  const [initialInventoryTons, setInitialInventoryTons] = useState(25);
  const [truckCapacityTons, setTruckCapacityTons] = useState(25);
  const [turns, setTurns] = useState(DEFAULT_TURNS);
  const [collapsed, setCollapsed] = useState({});

  useEffect(() => {
    setMachines((prev) => {
      const arr = prev.slice(0, machineCount);
      for (let i = arr.length; i < machineCount; i++) {
        arr.push({ id: defaultMachineName(i), speed: 120000 });
      }
      return arr;
    });
  }, [machineCount]);

  const [missionDefs, setMissionDefs] = useState(DEFAULT_MISSIONS);

  const machineSpeeds = useMemo(
    () => (linkMachineSpeeds ? machines.map((m) => ({ ...m, speed: uniformSpeed })) : machines),
    [machines, linkMachineSpeeds, uniformSpeed]
  );

  const totalUnitsPerHour = useMemo(
    () => machineSpeeds.reduce((acc, m) => acc + (m.speed || 0), 0),
    [machineSpeeds]
  );

  const consumptionTph = useMemo(
    () => (totalUnitsPerHour * gramsPerUnit) / 1_000_000,
    [totalUnitsPerHour, gramsPerUnit]
  );

  const plan = useMemo(
    () =>
      buildPlanFromTrips({
        turns,
        missionDefs,
        initialInventoryTons,
        truckCapacityTons,
        gramsPerUnit,
        machines: machineSpeeds,
      }),
    [turns, missionDefs, initialInventoryTons, truckCapacityTons, gramsPerUnit, machineSpeeds]
  );

  const suggestedUniform = useMemo(() => plan.kpis?.sustainableUniform ?? uniformSpeed, [plan, uniformSpeed]);

  return (
    <div className="min-h-screen bg-blue-50 text-slate-900 p-6 space-y-6">
      <header className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold">{t.title}</h1>
          <div className="text-sm text-muted-foreground hidden md:block">{t.mode}</div>
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-xs uppercase tracking-wide">{t.lang}</Label>
          <select
            className="h-9 border rounded-md px-2 bg-white"
            value={lang}
            onChange={(e) => setLang(e.target.value || "es")}
          >
            <option value="es">ES</option>
            <option value="en">EN</option>
          </select>
        </div>
      </header>

      <div className="grid grid-cols-1 2xl:grid-cols-3 gap-4">
        <Card className="col-span-1">
          <CardHeader>
            <CardTitle>{t.production}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <Label className="block">{t.machinesRunning(machines.length)}</Label>
              <div className="flex items-center gap-3 text-sm">
                <Switch checked={linkMachineSpeeds} onCheckedChange={setLinkMachineSpeeds} />
                <span>{t.uniformSpeed}</span>
              </div>

              {linkMachineSpeeds ? (
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{uniformSpeed.toLocaleString()} u/h</span>
                    <span className="text-muted-foreground">{t.uniform}</span>
                  </div>
                  <Slider
                    value={[uniformSpeed]}
                    min={10000}
                    max={300000}
                    step={1000}
                    onValueChange={([v]) => setUniformSpeed(v)}
                  />
                  <div className="text-xs mt-1">
                    {t.suggestedInbound}: <b>{suggestedUniform.toLocaleString()} u/h</b>
                  </div>
                </div>
              ) : (
                <div className="grid md:grid-cols-2 gap-3">
                  {machines.map((m, i) => (
                    <div key={m.id} className="flex items-center gap-3">
                      <span className="min-w-28 w-28">{m.id}</span>
                      <Input
                        type="number"
                        value={m.speed}
                        onChange={(e) => {
                          const v = Number(e.target.value || 0);
                          setMachines((prev) => prev.map((x, idx) => (idx === i ? { ...x, speed: v } : x)));
                        }}
                      />
                      <span className="text-xs">u/h</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="space-y-2 pt-2">
                <Label>{t.activeMachines}</Label>
                <Slider value={[machineCount]} min={0} max={10} step={1} onValueChange={([v]) => setMachineCount(v)} />
                <Input
                  type="number"
                  value={machineCount}
                  onChange={(e) => setMachineCount(clamp(Number(e.target.value || 0), 0, 10))}
                />
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <Label>{t.gramsPerPill}</Label>
                <Input type="number" value={gramsPerUnit} onChange={(e) => setGramsPerUnit(Number(e.target.value || 0))} />
              </div>
              <div>
                <Label>{t.initialInventory}</Label>
                <Input
                  type="number"
                  value={initialInventoryTons}
                  onChange={(e) => setInitialInventoryTons(Number(e.target.value || 0))}
                />
              </div>
              <div>
                <Label>{t.truckCapacity}</Label>
                <Input
                  type="number"
                  value={truckCapacityTons}
                  onChange={(e) => setTruckCapacityTons(Number(e.target.value || 0))}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t.productTimes}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {["pastillas", "fina"].map((key) => (
              <div key={key} className="border rounded-xl p-3 space-y-3">
                <div className="font-medium">{productName(key)}</div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-sm">
                  {missionDefs[key].segments.map((val, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <span className="whitespace-nowrap">{t.phases[idx]}</span>
                      <Input
                        type="number"
                        value={val}
                        onChange={(e) => {
                          const v = Number(e.target.value || 0);
                          setMissionDefs((prev) => ({
                            ...prev,
                            [key]: {
                              ...prev[key],
                              segments: prev[key].segments.map((x, i) => (i === idx ? v : x)),
                            },
                          }));
                        }}
                      />
                      <span className="text-xs">min</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t.turnsAndTrips}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-xs text-muted-foreground">{t.addTripsNote}</div>
            <div className="grid grid-cols-1 gap-4">
              {turns.map((tRow, idx) => (
                <div key={tRow.truckId} className="border rounded-xl p-3 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="font-medium">{tRow.truckId}</div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setCollapsed((c) => ({
                            ...c,
                            [tRow.truckId]: !c[tRow.truckId],
                          }))
                        }
                      >
                        {collapsed[tRow.truckId] ? t.expand : t.collapse}
                      </Button>
                      <div className="text-xs text-muted-foreground">{t.threeShifts}</div>
                    </div>
                  </div>

                  {!collapsed[tRow.truckId] && (
                    <>
                      {tRow.blocks.map((b, i) => (
                        <div key={i} className="space-y-3">
                          <div className="flex items-center gap-3">
                            <div className="flex-1">
                              <Label className="text-xs">{t.shiftStart}</Label>
                              <Input
                                type="time"
                                value={toHHMM(b.start)}
                                onChange={(e) => {
                                  const v = toMinutes(e.target.value);
                                  setTurns((prev) =>
                                    prev.map((row, rIndex) =>
                                      rIndex === idx
                                        ? {
                                            ...row,
                                            blocks: row.blocks.map((bb, j) => (j === i ? { ...bb, start: v } : bb)),
                                          }
                                        : row
                                    )
                                  );
                                }}
                              />
                            </div>
                            <div className="flex-1">
                              <Label className="text-xs">{t.shiftEndAuto}</Label>
                              <Input type="time" value={toHHMM((b.start + b.duration) % MINUTES_DAY)} readOnly />
                            </div>
                          </div>

                          <div className="border rounded-lg p-2">
                            <div className="text-sm font-medium mb-2">{t.trips}</div>
                            <div className="space-y-2">
                              {(b.trips || []).map((trip, k) => {
                                const segs = missionDefs[trip.product].segments;
                                const priorTrips = (b.trips || []).slice(0, k);
                                const priorDur = priorTrips.reduce(
                                  (acc, tr) => acc + missionDefs[tr.product].segments.reduce((a, bb) => a + bb, 0),
                                  0
                                );
                                const defaultStartAbs = b.start + priorDur;
                                const currentStart = trip.customStart !== undefined ? trip.customStart : defaultStartAbs;
                                const endAbs = currentStart + segs.reduce((a, bb) => a + bb, 0);
                                const spills = endAbs > b.start + b.duration;

                                return (
                                  <div key={k} className="border rounded-lg p-2 space-y-2">
                                    <div className="flex items-center justify-between">
                                      <span className="text-xs font-medium">Viaje {k + 1}</span>
                                      <Button
                                        variant="destructive"
                                        size="sm"
                                        onClick={() => {
                                          setTurns((prev) =>
                                            prev.map((row, rIndex) =>
                                              rIndex === idx
                                                ? {
                                                    ...row,
                                                    blocks: row.blocks.map((bb, j) =>
                                                      j === i
                                                        ? { ...bb, trips: bb.trips.filter((_, kk) => kk !== k) }
                                                        : bb
                                                    ),
                                                  }
                                                : row
                                            )
                                          );
                                        }}
                                      >
                                        {t.delete}
                                      </Button>
                                    </div>

                                    <div className="flex items-center gap-2">
                                      <div className="flex-1">
                                        <Label className="text-xs">{t.start}</Label>
                                        <Input
                                          type="time"
                                          value={toHHMM(currentStart % MINUTES_DAY)}
                                          onChange={(e) => {
                                            const v = toMinutes(e.target.value);
                                            setTurns((prev) =>
                                              prev.map((row, rIndex) =>
                                                rIndex === idx
                                                  ? {
                                                      ...row,
                                                      blocks: row.blocks.map((bb, j) =>
                                                        j === i
                                                          ? {
                                                              ...bb,
                                                              trips: bb.trips.map((tt, kk) =>
                                                                kk === k ? { ...tt, customStart: v } : tt
                                                              ),
                                                            }
                                                          : bb
                                                      ),
                                                    }
                                                  : row
                                              )
                                            );
                                          }}
                                        />
                                      </div>
                                      <div className="flex-1">
                                        <Label className="text-xs">{t.end}</Label>
                                        <div className="h-9 px-2 flex items-center border rounded-md bg-white text-sm">
                                          {toHHMM(endAbs % MINUTES_DAY)}
                                        </div>
                                      </div>
                                    </div>

                                    <div>
                                      <Label className="text-xs">{t.product}</Label>
                                      <select
                                        className="w-full border rounded-md h-9 px-2"
                                        value={trip.product}
                                        onChange={(e) => {
                                          const val = e.target.value;
                                          setTurns((prev) =>
                                            prev.map((row, rIndex) =>
                                              rIndex === idx
                                                ? {
                                                    ...row,
                                                    blocks: row.blocks.map((bb, j) =>
                                                      j === i
                                                        ? {
                                                            ...bb,
                                                            trips: bb.trips.map((tt, kk) =>
                                                              kk === k ? { ...tt, product: val } : tt
                                                            ),
                                                          }
                                                        : bb
                                                    ),
                                                  }
                                                : row
                                            )
                                          );
                                        }}
                                      >
                                        <option value="pastillas">{productName("pastillas")}</option>
                                        <option value="fina">{productName("fina")}</option>
                                      </select>
                                    </div>

                                    {spills && <div className="text-xs text-orange-600 font-medium">(derrame permitido)</div>}
                                  </div>
                                );
                              })}
                            </div>

                            <div className="pt-2 flex gap-2">
                              <Button
                                onClick={() => {
                                  setTurns((prev) =>
                                    prev.map((row, rIndex) =>
                                      rIndex === idx
                                        ? {
                                            ...row,
                                            blocks: row.blocks.map((bb, j) =>
                                              j === i
                                                ? { ...bb, trips: [...(bb.trips || []), { product: "pastillas" }] }
                                                : bb
                                            ),
                                          }
                                        : row
                                    )
                                  );
                                }}
                              >
                                {t.addTrip}
                              </Button>
                              <Button
                                variant="secondary"
                                onClick={() => {
                                  setTurns((prev) =>
                                    prev.map((row, rIndex) =>
                                      rIndex === idx
                                        ? {
                                            ...row,
                                            blocks: row.blocks.map((bb, j) => (j === i ? { ...bb, trips: [] } : bb)),
                                          }
                                        : row
                                    )
                                  );
                                }}
                              >
                                {t.clearTrips}
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-4">
              <CardTitle>{t.gantt24}</CardTitle>
              <div className="flex items-center gap-4 text-xs">
                <div className="flex items-center gap-1.5">
                  <div className="w-4 h-4 bg-zinc-300 border border-black rounded" />
                  <span>{t.fineSalt}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-4 h-4 bg-emerald-300 border border-black rounded" />
                  <span>{t.pills}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-4 h-4 bg-orange-400 rounded" />
                  <span>Carga / Load</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-4 h-4 bg-blue-400 rounded" />
                  <span>Descarga / Unload</span>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Gantt lang={lang} missions={plan.missions || []} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t.inv72}</CardTitle>
          </CardHeader>
          <CardContent>
            <InventoryChart invPts={plan.inv?.ptsX || []} horizon={plan.inv?.horizon || 3 * MINUTES_DAY} />
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>{t.kpis}</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3 text-sm">
            <KPI label={t.kpiConsumption} value={plan.kpis?.consumptionTph} />
            <KPI label={t.kpiPillsHour} value={plan.kpis?.pillsPerHour?.toLocaleString()} />
            <KPI label={t.kpiTrucksPills} value={plan.kpis?.trucksPastillas} />
            <KPI label={t.kpiTonsDay} value={plan.kpis?.tonsPastillas} />
            <KPI label={t.kpiDowntime} value={plan.kpis?.downtimeByLack} />
            <KPI label={t.kpiSustainable} value={plan.kpis?.sustainableUniform?.toLocaleString()} />
          </CardContent>
        </Card>
      </div>

      <div className="text-xs text-muted-foreground">Consumo estimado: {consumptionTph.toFixed(3)} t/h</div>
    </div>
  );
}
