// src/ChooseOurFutureClone.tsx
import React, { useMemo, useState } from "react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from "recharts";

// --------------------------- Types & Data ---------------------------

type Option = {
  id: string;
  label: string;
  value?: number; // contribution in tCO2e/year per person
  note?: string;
};

type Step = {
  id: string;
  title: string;
  subtitle?: string;
  options: Option[];
  calculator?: (selected: Record<string, string>) => number;
  multiple?: boolean;
};

const STEPS: Step[] = [
  // Energy (formerly "home") — same options, labels PT escaped
  {
    id: "home",
    title: "Energia",
    subtitle:
      "Escolhe o tamanho da casa, a mistura da rede eletrica e as melhorias de eficiencia.",
    options: [
      { id: "home_small", label: "Casa pequena / apartamento", value: 0.8 },
      { id: "home_medium", label: "Casa media", value: 1.2 },
      { id: "home_large", label: "Casa grande", value: 1.8 },
      { id: "grid_coal", label: "Rede e fossil-intensiva", value: 0.3, note: "+" },
      { id: "grid_mixed", label: "Rede e mista", value: 0.0 },
      { id: "grid_green", label: "Rede e maioritariamente renovavel", value: -0.3, note: "-" },
      { id: "eff_none", label: "Poucas melhorias de eficiencia", value: 0.0 },
      { id: "eff_some", label: "Algumas melhorias (LED, isolamento)", value: -0.12 },
      { id: "eff_deep", label: "Melhorias profundas (bomba de calor, retrofit)", value: -0.3 },
    ],
  },
  // School (formerly transport)
  {
    id: "transport",
    title: "Escola",
    subtitle: "Como te deslocas para a escola no dia a dia.",
    options: [
      { id: "mode_car_solo", label: "Conduzir sozinho", value: 1.2 },
      { id: "mode_carpool", label: "Partilha de carro", value: 0.6 },
      { id: "mode_bus", label: "Autocarro", value: 0.4 },
      { id: "mode_train", label: "Comboio/Metro", value: 0.3 },
      { id: "mode_bike", label: "Bicicleta/Caminhar", value: 0.0 },
      { id: "car_ice", label: "Se conduzires: carro a gasolina", value: 1.0 },
      { id: "car_hybrid", label: "Se conduzires: hibrido", value: 0.6 },
      { id: "car_ev", label: "Se conduzires: eletrico", value: 0.3 },
    ],
  },
  // Food
  {
    id: "food",
    title: "Alimentacao",
    subtitle: "Escolhas de dieta e desperdicio somam ao longo do ano.",
    options: [
      { id: "diet_heavy", label: "Dieta rica em carne", value: 1.2 },
      { id: "diet_mixed", label: "Dieta mista", value: 0.8 },
      { id: "diet_veg", label: "Vegetariana", value: 0.5 },
      { id: "diet_vegan", label: "Vegana", value: 0.4 },
      { id: "waste_high", label: "Muito desperdicio alimentar", value: 0.2 },
      { id: "waste_med", label: "Algum desperdicio alimentar", value: 0.1 },
      { id: "waste_low", label: "Minimo desperdicio alimentar", value: 0.05 },
      { id: "local_yes", label: "Frequente local/sazonal", value: -0.05 },
      { id: "local_no", label: "Raramente local/sazonal", value: 0.0 },
    ],
  },
  // Shopping
  {
    id: "shopping",
    title: "Compras",
    subtitle: "Os bens tambem tem pegada.",
    options: [
      { id: "shop_low", label: "Baixo consumo", value: 0.1 },
      { id: "shop_avg", label: "Consumo medio", value: 0.2 },
      { id: "shop_high", label: "Alto consumo", value: 0.5 },
      { id: "elec_none", label: "Novos eletronicos: nenhum", value: 0.0 },
      { id: "elec_some", label: "Novo telemovel ou portatil", value: 0.26 },
      { id: "elec_many", label: "Varios eletronicos", value: 0.5 },
    ],
  },
  // Holidays (formerly flights)
  {
    id: "flights",
    title: "Ferias",
    subtitle: "Alguns voos podem equivaler a meses de deslocacoes.",
    options: [
      { id: "dom_0", label: "Voos domesticos: 0", value: 0 },
      { id: "dom_1", label: "Voos domesticos: 1", value: 0.2 },
      { id: "dom_2", label: "Voos domesticos: 2", value: 0.4 },
      { id: "dom_4", label: "Voos domesticos: 4", value: 0.8 },
      { id: "intl_0", label: "Voos internacionais: 0", value: 0 },
      { id: "intl_1", label: "Voos internacionais: 1", value: 1.0 },
      { id: "intl_2", label: "Voos internacionais: 2", value: 2.0 },
    ],
  },
];

// Category names (PT) for the pie chart
const CATEGORY_LABELS_PT = {
  flights: "Ferias",
  transport: "Escola",
  shopping: "Compras",
  food: "Alimentacao",
  home: "Energia",
} as const;

// Default selections
const DEFAULTS: Record<string, string> = {
  // energy
  home: "home_medium",
  grid: "grid_mixed",
  eff: "eff_some",
  // school/transport
  mode: "mode_train",
  car: "car_hybrid",
  // food
  diet: "diet_mixed",
  waste: "waste_med",
  local: "local_yes",
  // holidays
  dom: "dom_1",
  intl: "intl_0",
  // shopping
  shop: "shop_avg",
  elec: "elec_some",
  // visual-only state
  vacation: "intl_flight",
};

// --------------------------- Helpers ---------------------------

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function toyTemperature2100(perCapita: number) {
  const minT = 1.6;
  const t = minT + Math.max(0, perCapita - 2) * 0.35;
  return clamp(t, 1.3, 4.5);
}

function makeTempSeries(perCapita: number) {
  const end = toyTemperature2100(perCapita);
  const startYear = 2025;
  const endYear = 2100;
  const years = endYear - startYear;
  const out = [] as { year: number; temp: number }[];
  const startTemp = 1.2;
  for (let i = 0; i <= years; i++) {
    const y = startYear + i;
    const t = startTemp + (end - startTemp) * (1 - Math.exp(-i / 30));
    out.push({ year: y, temp: Number(t.toFixed(2)) });
  }
  return out;
}

// Value per option
const OPTION_VALUE = new Map<string, number>();
STEPS.forEach((s) => s.options.forEach((o) => OPTION_VALUE.set(o.id, o.value ?? 0)));

function calcCategoryTotals(selected: Record<string, string>) {
  // Energy
  const home =
    (selected.home ? OPTION_VALUE.get(selected.home) ?? 0 : 0) +
    (selected.grid ? OPTION_VALUE.get(selected.grid) ?? 0 : 0) +
    (selected.eff ? OPTION_VALUE.get(selected.eff) ?? 0 : 0);

  // School (transport)
  const modeId = selected.mode || "mode_train";
  const modeVal = OPTION_VALUE.get(modeId) ?? 0;
  const carVal =
    modeId.startsWith("mode_car") || modeId === "mode_carpool"
      ? OPTION_VALUE.get(selected.car || "car_hybrid") ?? 0
      : 0;
  const transport = modeVal + carVal;

  // Food
  const food =
    (OPTION_VALUE.get(selected.diet || "diet_mixed") ?? 0) +
    (OPTION_VALUE.get(selected.waste || "waste_med") ?? 0) +
    (OPTION_VALUE.get(selected.local || "local_yes") ?? 0);

  // Holidays (flights)
  const flights =
    (OPTION_VALUE.get(selected.dom || "dom_1") ?? 0) +
    (OPTION_VALUE.get(selected.intl || "intl_0") ?? 0);

  // Shopping
  const shopping =
    (OPTION_VALUE.get(selected.shop || "shop_avg") ?? 0) +
    (OPTION_VALUE.get(selected.elec || "elec_some") ?? 0);

  return { home, transport, food, flights, shopping };
}

function sum(obj: Record<string, number>) {
  return Object.values(obj).reduce((a, b) => a + b, 0);
}

// --------------------------- UI ---------------------------

const StepChip: React.FC<{
  active: boolean;
  done: boolean;
  index: number;
  label: string;
  onClick: () => void;
}> = ({ active, done, index, label, onClick }) => (
  <button
    onClick={onClick}
    className={`flex items-center gap-2 rounded-full px-3 py-1 text-sm transition ${
      active ? "bg-blue-600 text-white" : done ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"
    }`}
  >
    <span className={`grid h-6 w-6 place-items-center rounded-full ${active ? "bg-blue-700 text-white" : "bg-white text-gray-800"}`}>
      {index + 1}
    </span>
    <span className="font-medium">{label}</span>
  </button>
);

const OptionCard: React.FC<{
  option: Option;
  selected: boolean;
  onSelect: () => void;
}> = ({ option, selected, onSelect }) => (
  <button
    onClick={onSelect}
    className={`group relative flex w-full items-start gap-3 rounded-2xl border p-4 text-left transition hover:shadow ${
      selected ? "border-blue-600 bg-blue-50" : "border-gray-200 bg-white"
    }`}
  >
    <div className={`mt-1 h-4 w-4 rounded-full border ${selected ? "border-blue-600 bg-blue-600" : "border-gray-400"}`} />
    <div>
      <div className="text-base font-medium leading-tight">{option.label}</div>
      {typeof option.value === "number" && (
        <div className="mt-1 text-xs text-gray-500">
          {option.value > 0 ? "+" : option.value < 0 ? "-" : "\u00B1"}
          {Math.abs(option.value)} tCO2e/ano
        </div>
      )}
      {option.note && <div className="mt-2 text-[11px] text-gray-400">Nota: {option.note}</div>}
    </div>
  </button>
);

const Panel: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="rounded-3xl border bg-white p-6 shadow-sm">
    <div className="mb-4 text-lg font-semibold">{title}</div>
    {children}
  </div>
);

// Simple inline icons
const IconAirplane: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M2 12l20-6-6 8 6 2-8 2-2 4-2-5-6-1 4-2-2-2z" />
  </svg>
);
const IconCar: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M3 13l2-6h14l2 6" />
    <circle cx="7.5" cy="16.5" r="1.5" />
    <circle cx="16.5" cy="16.5" r="1.5" />
  </svg>
);

const PlaceCard: React.FC<{
  label: string;
  icon?: React.ReactNode;
  selected: boolean;
  onClick: () => void;
}> = ({ label, icon, selected, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={`flex h-36 w-full flex-col items-center justify-center rounded-2xl border p-6 text-center shadow-sm transition hover:shadow-md ${
      selected ? "border-blue-600 bg-blue-50" : "border-gray-200 bg-white"
    }`}
  >
    <div className={`mb-2 ${selected ? "text-blue-600" : "text-gray-400"}`}>{icon}</div>
    <span className="text-base font-medium">{label}</span>
  </button>
);

// --------------------------- Main Component ---------------------------

export default function ChooseOurFutureClone() {
  // requested order for chips: Escola -> Energia -> Alimentacao -> Compras -> Ferias
  const stepOrder = ["transport", "home", "food", "shopping", "flights"] as const;

  const [sel, setSel] = useState<Record<string, string>>({ ...DEFAULTS });
  const [stepIdx, setStepIdx] = useState(0);
  const activeStep = stepOrder[stepIdx];

  const totals = useMemo(() => calcCategoryTotals(sel), [sel]);
  const total = useMemo(() => sum(totals), [totals]);
  const perCapita = total;
  const t2100 = toyTemperature2100(perCapita);
  const tempSeries = useMemo(() => makeTempSeries(perCapita), [perCapita]);

  // pieData with PT labels and requested mapping
  const pieData = [
    { name: CATEGORY_LABELS_PT.flights, value: totals.flights },
    { name: CATEGORY_LABELS_PT.transport, value: totals.transport },
    { name: CATEGORY_LABELS_PT.shopping, value: totals.shopping },
    { name: CATEGORY_LABELS_PT.food, value: totals.food },
    { name: CATEGORY_LABELS_PT.home, value: totals.home },
  ];

  function setSelection(group: string, id: string) {
    setSel((s) => ({ ...s, [group]: id }));
  }

  function resetAll() {
    setSel({ ...DEFAULTS });
    setStepIdx(0);
  }

  function optionsForStep(step: string): { key: string; opts: Option[]; groupKey: string }[] {
    switch (step) {
      case "home":
        return [
          { key: sel.home, opts: STEPS[0].options.slice(0, 3), groupKey: "home" },
          { key: sel.grid, opts: STEPS[0].options.slice(3, 6), groupKey: "grid" },
          { key: sel.eff, opts: STEPS[0].options.slice(6, 9), groupKey: "eff" },
        ];
      case "transport":
        return [
          { key: sel.mode, opts: STEPS[1].options.slice(0, 5), groupKey: "mode" },
          { key: sel.car, opts: STEPS[1].options.slice(5, 8), groupKey: "car" },
        ];
      case "food":
        return [
          { key: sel.diet, opts: STEPS[2].options.slice(0, 4), groupKey: "diet" },
          { key: sel.waste, opts: STEPS[2].options.slice(4, 7), groupKey: "waste" },
          { key: sel.local, opts: STEPS[2].options.slice(7, 9), groupKey: "local" },
        ];
      case "flights":
        return [
          { key: sel.dom, opts: STEPS[4].options.slice(0, 4), groupKey: "dom" },
          { key: sel.intl, opts: STEPS[4].options.slice(4, 7), groupKey: "intl" },
        ];
      case "shopping":
        return [
          { key: sel.shop, opts: STEPS[3].options.slice(0, 3), groupKey: "shop" },
          { key: sel.elec, opts: STEPS[3].options.slice(3, 6), groupKey: "elec" },
        ];
      default:
        return [];
    }
  }

  const stepMeta: Record<(typeof stepOrder)[number], { title: string; desc: string }> = {
    transport: { title: "Escola", desc: "Como te deslocas para a escola no dia a dia." },
    home: { title: "Energia", desc: "Escolhe o tamanho da casa, a mistura da rede eletrica e as melhorias de eficiencia." },
    food: { title: "Alimentacao", desc: "Seleciona dieta, desperdicio alimentar e habitos local/sazonal." },
    shopping: { title: "Compras", desc: "Define o teu nivel de consumo e novos eletronicos." },
    flights: { title: "Ferias", desc: "Adiciona voos domesticos e internacionais por ano." },
  };

  // Visual options for the placecards screen (kept under Energy step per previous request)
  const vacationOptions = [
    { id: "intl_flight", label: "Voo Internacional", icon: <IconAirplane className="h-8 w-8" /> },
    { id: "domestic_flight", label: "Voo Domestico", icon: <IconAirplane className="h-8 w-8" /> },
    { id: "car_trip", label: "Viagem de Carro", icon: <IconCar className="h-8 w-8" /> },
    { id: "multi_flights", label: "Multiplas viagens de aviao por ano", icon: <IconAirplane className="h-8 w-8" /> },
  ] as const;

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-slate-50 to-white p-4 md:p-8">
      {/* Header */}
      <header className="mx-auto flex max-w-6xl items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-2xl bg-blue-600 font-bold text-white shadow">CF</div>
          <div>
            <h1 className="text-xl font-bold md:text-2xl">Museus do Mar - Modulo de Desenvolvimento Cognitivo Sobre Poluicao</h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className="rounded-xl bg-blue-600 px-3 py-2 text-sm font-medium text-white shadow hover:bg-blue-700" onClick={resetAll}>
            Recomecar
          </button>
        </div>
      </header>

      {/* Progress chips */}
      <div className="mx-auto mt-6 flex max-w-6xl flex-wrap gap-2">
        {stepOrder.map((id, i) => (
          <StepChip key={id} active={i === stepIdx} done={i < stepIdx} index={i} label={stepMeta[id].title} onClick={() => setStepIdx(i)} />
        ))}
      </div>

      {/* Main grid */}
      <div className="mx-auto mt-6 grid max-w-6xl grid-cols-1 gap-6 md:grid-cols-3">
        {/* Left: options */}
        <div className="md:col-span-2">
          {/* Keep the placecards screen under Energy (home) per earlier request */}
          {activeStep === "home" ? (
            <Panel title="Que tipo de ferias ira fazer?">
              <p className="mb-4 text-sm text-gray-600">
                Os avioes sao menos eficientes do que os carros e, quanto mais e mais longos forem os voos, maior sera a energia necessaria.
              </p>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {vacationOptions.map((opt) => (
                  <PlaceCard key={opt.id} label={opt.label} icon={opt.icon} selected={sel.vacation === opt.id} onClick={() => setSelection("vacation", opt.id)} />
                ))}
              </div>
              <div className="mt-4 flex items-center justify-between">
                <button className="rounded-xl border px-4 py-2 text-sm font-medium hover:bg-gray-50" onClick={() => setStepIdx((i) => Math.max(0, i - 1))} disabled={stepIdx === 0}>
                  Voltar
                </button>
                <button className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow hover:bg-blue-700" onClick={() => setStepIdx((i) => Math.min(stepOrder.length - 1, i + 1))}>
                  Seguinte
                </button>
              </div>
            </Panel>
          ) : (
            <Panel title={`${stepMeta[activeStep].title}`}>
              <p className="mb-4 text-sm text-gray-600">{stepMeta[activeStep].desc}</p>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {optionsForStep(activeStep).map(({ key, opts, groupKey }, idx) => (
                  <div key={idx} className="rounded-2xl bg-gray-50/60 p-3">
                    <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Grupo {idx + 1}</div>
                    <div className="grid grid-cols-1 gap-2">
                      {opts.map((o) => (
                        <OptionCard key={o.id} option={o} selected={key === o.id} onSelect={() => setSelection(groupKey, o.id)} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex items-center justify-between">
                <button className="rounded-xl border px-4 py-2 text-sm font-medium hover:bg-gray-50" onClick={() => setStepIdx((i) => Math.max(0, i - 1))} disabled={stepIdx === 0}>
                  Voltar
                </button>
                <button className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow hover:bg-blue-700" onClick={() => setStepIdx((i) => Math.min(stepOrder.length - 1, i + 1))}>
                  Seguinte
                </button>
              </div>
            </Panel>
          )}
        </div>

        {/* Right: summary */}
        <div className="space-y-6">
          <Panel title="A tua pegada (selecoes atuais)">
            <div className="grid grid-cols-2 items-center gap-4">
              <div>
                <div className="text-4xl font-extrabold">
                  {perCapita.toFixed(2)}
                  <span className="text-xl font-semibold text-gray-500"> tCO2e/ano</span>
                </div>
                <div className="mt-2 text-sm text-gray-600">A linha de base aqui e a soma das categorias abaixo.</div>
              </div>
              <div className="h-40 w-full">
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={pieData} dataKey="value" nameKey="name" outerRadius={70}>
                      {pieData.map((_, i) => (
                        <Cell key={i} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: any) => `${Number(v).toFixed(2)} tCO2e/ano`} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
              {pieData.map((p) => (
                <div key={p.name} className="rounded-lg bg-gray-50 p-2">
                  <div className="text-xs text-gray-500">{p.name}</div>
                  <div className="font-medium">{p.value.toFixed(2)} tCO2e/ano</div>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="Se toda a gente vivesse assim (modelo didatico)">
            <div className="text-sm text-gray-600">Aquecimento global projetado ate 2100 (muito simplificado).</div>
            <div className="mt-2 text-3xl font-bold">~ {t2100.toFixed(1)}\u00B0C</div>
            <div className="mt-2 h-40 w-full">
              <ResponsiveContainer>
                <LineChart data={tempSeries}>
                  <XAxis dataKey="year" tick={{ fontSize: 10 }} interval={10} />
                  <YAxis domain={[0, 5]} tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(v: any) => `${v}\u00B0C`} />
                  <Legend />
                  <Line type="monotone" dataKey="temp" name={`Temp. global (\u00B0C)`} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <p className="mt-2 text-xs text-gray-500">Visualizacao educativa apenas. Substitui por um modelo preferido para uso rigoroso.</p>
          </Panel>
        </div>
      </div>

      {/* Footer */}
      <div className="mx-auto mt-6 max-w-6xl rounded-3xl border bg-white p-4 text-center text-sm text-gray-600">
        Desenvolvido por Kukuma Tech e Museus do Mar (c) 2025.
      </div>
    </div>
  );
}
