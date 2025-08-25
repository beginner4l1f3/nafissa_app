import React, { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
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

/**
 * Clean‑room, educational remake inspired by UCAR SciEd's “Choose Our Future”.
 * — No UCAR text, artwork, or code reused.
 * — All copy, data, and code below are original and illustrative only.
 * — Replace the toy emission factors with your preferred dataset.
 */

// --------------------------- Types & Data ---------------------------

type Option = {
  id: string;
  label: string;
  // contribution in tons CO2e per person per year (tCO2e/yr)
  value?: number;
  note?: string;
};

type Step = {
  id: string;
  title: string;
  subtitle?: string;
  options: Option[];
  // Optional: custom calculator when the simple per-option value doesn't fit
  calculator?: (selected: Record<string, string>) => number;
  // Optional: show as radio (single) or segmented multi (single only for now)
  multiple?: boolean;
};

const STEPS: Step[] = [
  {
    id: "home",
    title: "Home Energy",
    subtitle:
      "Your home's size, energy mix, and efficiency shape your heating/cooling footprint.",
    options: [
      { id: "home_small", label: "Small home / apartment", value: 0.8 },
      { id: "home_medium", label: "Medium home", value: 1.2 },
      { id: "home_large", label: "Large home", value: 1.8 },
      { id: "grid_coal", label: "Grid is fossil‑heavy", value: 0.3, note: "+" },
      { id: "grid_mixed", label: "Grid is mixed", value: 0.0 },
      { id: "grid_green", label: "Grid is mostly renewable", value: -0.3, note: "−" },
      { id: "eff_none", label: "Few efficiency upgrades", value: 0.0 },
      { id: "eff_some", label: "Some upgrades (LED, insulation)", value: -0.12 },
      { id: "eff_deep", label: "Deep upgrades (heat‑pump, retrofit)", value: -0.3 },
    ],
  },
  {
    id: "transport",
    title: "Transport",
    subtitle: "How you get around matters — especially daily travel.",
    options: [
      { id: "mode_car_solo", label: "Drive alone", value: 1.2 },
      { id: "mode_carpool", label: "Carpool", value: 0.6 },
      { id: "mode_bus", label: "Bus", value: 0.4 },
      { id: "mode_train", label: "Train/Metro", value: 0.3 },
      { id: "mode_bike", label: "Bike/Walk", value: 0.0 },
      { id: "car_ice", label: "If driving: gasoline car", value: 1.0 },
      { id: "car_hybrid", label: "If driving: hybrid", value: 0.6 },
      { id: "car_ev", label: "If driving: EV", value: 0.3 },
    ],
  },
  {
    id: "food",
    title: "Food",
    subtitle: "Diet choices + waste add up over a year.",
    options: [
      { id: "diet_heavy", label: "Meat‑heavy diet", value: 1.2 },
      { id: "diet_mixed", label: "Mixed diet", value: 0.8 },
      { id: "diet_veg", label: "Vegetarian", value: 0.5 },
      { id: "diet_vegan", label: "Vegan", value: 0.4 },
      { id: "waste_high", label: "High food waste", value: 0.2 },
      { id: "waste_med", label: "Some food waste", value: 0.1 },
      { id: "waste_low", label: "Minimal food waste", value: 0.05 },
      { id: "local_yes", label: "Often local/seasonal", value: -0.05 },
      { id: "local_no", label: "Rarely local/seasonal", value: 0.0 },
    ],
  },
  {
    id: "flights",
    title: "Flights",
    subtitle: "A few flights can rival months of commuting.",
    options: [
      { id: "dom_0", label: "Domestic flights: 0", value: 0 },
      { id: "dom_1", label: "Domestic flights: 1", value: 0.2 },
      { id: "dom_2", label: "Domestic flights: 2", value: 0.4 },
      { id: "dom_4", label: "Domestic flights: 4", value: 0.8 },
      { id: "intl_0", label: "International flights: 0", value: 0 },
      { id: "intl_1", label: "International flights: 1", value: 1.0 },
      { id: "intl_2", label: "International flights: 2", value: 2.0 },
    ],
  },
  {
    id: "shopping",
    title: "Purchases",
    subtitle: "Stuff has a footprint too.",
    options: [
      { id: "shop_low", label: "Low consumption", value: 0.1 },
      { id: "shop_avg", label: "Average consumption", value: 0.2 },
      { id: "shop_high", label: "High consumption", value: 0.5 },
      { id: "elec_none", label: "New electronics: none", value: 0.0 },
      { id: "elec_some", label: "New phone or laptop", value: 0.26 },
      { id: "elec_many", label: "Multiple electronics", value: 0.5 },
    ],
  },
];

const CATEGORY_GROUPS: Record<string, string> = {
  home: "Home",
  transport: "Transport",
  food: "Food",
  flights: "Flights",
  shopping: "Purchases",
};

// default selections (roughly around an average baseline ~4.7 tCO2e/yr)
const DEFAULTS: Record<string, string> = {
  // home
  home: "home_medium",
  grid: "grid_mixed",
  eff: "eff_some",
  // transport
  mode: "mode_train",
  car: "car_hybrid",
  // food
  diet: "diet_mixed",
  waste: "waste_med",
  local: "local_yes",
  // flights
  dom: "dom_1",
  intl: "intl_0",
  // shopping
  shop: "shop_avg",
  elec: "elec_some",
};

// --------------------------- Helpers ---------------------------

function formatTons(x: number) {
  return `${x.toFixed(2)} tCO₂e/yr`;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

/**
 * Extremely simplified temperature mapping for demo purposes ONLY.
 * Assumes long‑run warming correlates with sustained global per‑capita emissions.
 * T2100 (°C above pre‑industrial) ~ 1.6°C at ~2 tCO2e/person/yr, rising with higher per‑capita.
 */
function toyTemperature2100(perCapita: number) {
  const minT = 1.6;
  const t = minT + Math.max(0, perCapita - 2) * 0.35; // 0.35 °C per extra tCO2e
  return clamp(t, 1.3, 4.5);
}

function makeTempSeries(perCapita: number) {
  const end = toyTemperature2100(perCapita);
  const startYear = 2025;
  const endYear = 2100;
  const years = endYear - startYear;
  // Ease toward end temperature
  const out = [] as { year: number; temp: number }[];
  const startTemp = 1.2; // ~observed warming today
  for (let i = 0; i <= years; i++) {
    const y = startYear + i;
    const t = startTemp + (end - startTemp) * (1 - Math.exp(-i / 30));
    out.push({ year: y, temp: Number(t.toFixed(2)) });
  }
  return out;
}

// Map an option id to its numeric value
const OPTION_VALUE = new Map<string, number>();
STEPS.forEach((s) => s.options.forEach((o) => OPTION_VALUE.set(o.id, o.value ?? 0)));

// Build UI groupings for each step
const STEP_GROUPINGS: Record<string, string[]> = {
  home: ["home_small", "home_medium", "home_large", "grid_coal", "grid_mixed", "grid_green", "eff_none", "eff_some", "eff_deep"],
  transport: ["mode_car_solo", "mode_carpool", "mode_bus", "mode_train", "mode_bike", "car_ice", "car_hybrid", "car_ev"],
  food: ["diet_heavy", "diet_mixed", "diet_veg", "diet_vegan", "waste_high", "waste_med", "waste_low", "local_yes", "local_no"],
  flights: ["dom_0", "dom_1", "dom_2", "dom_4", "intl_0", "intl_1", "intl_2"],
  shopping: ["shop_low", "shop_avg", "shop_high", "elec_none", "elec_some", "elec_many"],
};

function calcCategoryTotals(selected: Record<string, string>) {
  // Home: size + grid + efficiency
  const home =
    (selected.home ? OPTION_VALUE.get(selected.home) ?? 0 : 0) +
    (selected.grid ? OPTION_VALUE.get(selected.grid) ?? 0 : 0) +
    (selected.eff ? OPTION_VALUE.get(selected.eff) ?? 0 : 0);

  // Transport: mode + car (if driving)
  const modeId = selected.mode || "mode_train";
  const modeVal = OPTION_VALUE.get(modeId) ?? 0;
  const carVal = modeId.startsWith("mode_car") || modeId === "mode_carpool" ? OPTION_VALUE.get(selected.car || "car_hybrid") ?? 0 : 0;
  const transport = modeVal + carVal;

  // Food: diet + waste + local
  const food =
    (OPTION_VALUE.get(selected.diet || "diet_mixed") ?? 0) +
    (OPTION_VALUE.get(selected.waste || "waste_med") ?? 0) +
    (OPTION_VALUE.get(selected.local || "local_yes") ?? 0);

  // Flights: domestic + international
  const flights =
    (OPTION_VALUE.get(selected.dom || "dom_1") ?? 0) +
    (OPTION_VALUE.get(selected.intl || "intl_0") ?? 0);

  // Shopping: spending + electronics
  const shopping =
    (OPTION_VALUE.get(selected.shop || "shop_avg") ?? 0) +
    (OPTION_VALUE.get(selected.elec || "elec_some") ?? 0);

  return { home, transport, food, flights, shopping };
}

function sum(obj: Record<string, number>) {
  return Object.values(obj).reduce((a, b) => a + b, 0);
}

// --------------------------- UI Components ---------------------------

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
          {option.value > 0 ? "+" : option.value < 0 ? "−" : "±"}
          {Math.abs(option.value)} tCO₂e/yr
        </div>
      )}
      {option.note && <div className="mt-2 text-[11px] text-gray-400">Note: {option.note}</div>}
    </div>
  </button>
);

const Panel: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="rounded-3xl border bg-white p-6 shadow-sm">
    <div className="mb-4 text-lg font-semibold">{title}</div>
    {children}
  </div>
);

// --------------------------- Main Component ---------------------------

export default function ChooseOurFutureClone() {
  // track selections by key (see DEFAULTS keys)
  const [sel, setSel] = useState<Record<string, string>>({ ...DEFAULTS });
  const [stepIdx, setStepIdx] = useState(0);
  const [showAbout, setShowAbout] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  const stepOrder = ["home", "transport", "food", "flights", "shopping"] as const;
  const activeStep = stepOrder[stepIdx];

  const totals = useMemo(() => calcCategoryTotals(sel), [sel]);
  const total = useMemo(() => sum(totals), [totals]);

  const perCapita = total; // by construction this is tCO2e per person per year
  const t2100 = toyTemperature2100(perCapita);
  const tempSeries = useMemo(() => makeTempSeries(perCapita), [perCapita]);

  const pieData = [
    { name: "Home", value: totals.home },
    { name: "Transport", value: totals.transport },
    { name: "Food", value: totals.food },
    { name: "Flights", value: totals.flights },
    { name: "Purchases", value: totals.shopping },
  ];

  const COLORS = ["#60a5fa", "#34d399", "#fbbf24", "#f87171", "#a78bfa"]; // let Recharts pick defaults if unavailable

  function setSelection(group: string, id: string) {
    setSel((s) => ({ ...s, [group]: id }));
  }

  function resetAll() {
    setSel({ ...DEFAULTS });
    setStepIdx(0);
  }

  function exportChoices() {
    const blob = new Blob([JSON.stringify({ selections: sel, totals, perCapita, t2100 }, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "choose-our-future-cleanroom.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  // Build the list of options shown for the current step
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
          { key: sel.dom, opts: STEPS[3].options.slice(0, 4), groupKey: "dom" },
          { key: sel.intl, opts: STEPS[3].options.slice(4, 7), groupKey: "intl" },
        ];
      case "shopping":
        return [
          { key: sel.shop, opts: STEPS[4].options.slice(0, 3), groupKey: "shop" },
          { key: sel.elec, opts: STEPS[4].options.slice(3, 6), groupKey: "elec" },
        ];
      default:
        return [];
    }
  }

  const stepMeta: Record<(typeof stepOrder)[number], { title: string; desc: string }> = {
    home: { title: "Home Energy", desc: "Choose your home size, grid mix, and upgrades." },
    transport: { title: "Transport", desc: "Pick your main travel mode and car type if applicable." },
    food: { title: "Food", desc: "Select diet, food waste, and local/seasonal habits." },
    flights: { title: "Flights", desc: "Add domestic and international flights per year." },
    shopping: { title: "Purchases", desc: "Set general consumption and new electronics." },
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-slate-50 to-white p-4 md:p-8">
      {/* Header */}
      <header className="mx-auto flex max-w-6xl items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-2xl bg-blue-600 font-bold text-white shadow">CF</div>
          <div>
            <h1 className="text-xl font-bold md:text-2xl">Choose Our Future — Clean‑Room</h1>
            <p className="text-sm text-gray-500">Interactive demo (educational only)</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className="rounded-xl border px-3 py-2 text-sm hover:bg-gray-50" onClick={() => setShowHelp(true)}>
            Instructions
          </button>
          <button className="rounded-xl border px-3 py-2 text-sm hover:bg-gray-50" onClick={() => setShowAbout(true)}>
            About
          </button>
          <button className="rounded-xl border px-3 py-2 text-sm hover:bg-gray-50" onClick={exportChoices}>
            Export JSON
          </button>
          <button className="rounded-xl bg-blue-600 px-3 py-2 text-sm font-medium text-white shadow hover:bg-blue-700" onClick={resetAll}>
            Reset
          </button>
        </div>
      </header>

      {/* Progress chips */}
      <div className="mx-auto mt-6 flex max-w-6xl flex-wrap gap-2">
        {stepOrder.map((id, i) => (
          <StepChip
            key={id}
            active={i === stepIdx}
            done={i < stepIdx}
            index={i}
            label={stepMeta[id].title}
            onClick={() => setStepIdx(i)}
          />
        ))}
      </div>

      {/* Main grid */}
      <div className="mx-auto mt-6 grid max-w-6xl grid-cols-1 gap-6 md:grid-cols-3">
        {/* Left: options */}
        <div className="md:col-span-2">
          <Panel title={`${stepMeta[activeStep].title}`}>
            <p className="mb-4 text-sm text-gray-600">{stepMeta[activeStep].desc}</p>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {optionsForStep(activeStep).map(({ key, opts, groupKey }, idx) => (
                <div key={idx} className="rounded-2xl bg-gray-50/60 p-3">
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Group {idx + 1}</div>
                  <div className="grid grid-cols-1 gap-2">
                    {opts.map((o) => (
                      <OptionCard key={o.id} option={o} selected={key === o.id} onSelect={() => setSelection(groupKey, o.id)} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 flex items-center justify-between">
              <button
                className="rounded-xl border px-4 py-2 text-sm font-medium hover:bg-gray-50"
                onClick={() => setStepIdx((i) => Math.max(0, i - 1))}
                disabled={stepIdx === 0}
              >
                ← Back
              </button>
              <button
                className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow hover:bg-blue-700"
                onClick={() => setStepIdx((i) => Math.min(stepOrder.length - 1, i + 1))}
              >
                Next →
              </button>
            </div>
          </Panel>
        </div>

        {/* Right: summary */}
        <div className="space-y-6">
          <Panel title="Your footprint (current selections)">
            <div className="grid grid-cols-2 items-center gap-4">
              <div>
                <div className="text-4xl font-extrabold">{perCapita.toFixed(2)}<span className="text-xl font-semibold text-gray-500"> tCO₂e/yr</span></div>
                <div className="mt-2 text-sm text-gray-600">Baseline shown here is the sum across categories below.</div>
              </div>
              <div className="h-40 w-full">
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={pieData} dataKey="value" nameKey="name" outerRadius={70}>
                      {pieData.map((_, i) => (
                        <Cell key={i} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: any) => `${Number(v).toFixed(2)} tCO₂e/yr`} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
              {pieData.map((p) => (
                <div key={p.name} className="rounded-lg bg-gray-50 p-2">
                  <div className="text-xs text-gray-500">{p.name}</div>
                  <div className="font-medium">{p.value.toFixed(2)} tCO₂e/yr</div>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="If everyone lived like this (toy model)">
            <div className="text-sm text-gray-600">Projected global warming by 2100 (very simplified).</div>
            <div className="mt-2 text-3xl font-bold">≈ {t2100.toFixed(1)}°C</div>
            <div className="mt-2 h-40 w-full">
              <ResponsiveContainer>
                <LineChart data={tempSeries}>
                  <XAxis dataKey="year" tick={{ fontSize: 10 }} interval={10} />
                  <YAxis domain={[0, 5]} tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(v: any) => `${v}°C`} />
                  <Legend />
                  <Line type="monotone" dataKey="temp" name="Global temp (°C)" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <p className="mt-2 text-xs text-gray-500">
              Educational visualization only. Replace with your preferred carbon‑to‑warming model for rigorous use.
            </p>
          </Panel>
        </div>
      </div>

      {/* Footer actions */}
      <div className="mx-auto mt-6 max-w-6xl rounded-3xl border bg-white p-4 text-center text-sm text-gray-600">
        Inspired by public educational tools. This remake does not reuse UCAR assets or code.
      </div>

      {/* Modals */}
      <AnimatePresence>
        {showAbout && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
            <div className="max-w-2xl rounded-2xl bg-white p-6 shadow-xl">
              <div className="flex items-start justify-between gap-6">
                <div>
                  <h2 className="text-xl font-bold">About this demo</h2>
                  <p className="mt-2 text-sm text-gray-600">
                    This interactive estimates a personal annual footprint across five categories and shows a
                    simplified projection of global temperature if everyone adopted similar habits. All factors are
                    illustrative and should be replaced with vetted data for research or instruction.
                  </p>
                </div>
                <button className="rounded-full p-2 hover:bg-gray-100" onClick={() => setShowAbout(false)}>✕</button>
              </div>
              <div className="mt-4 grid gap-3 text-sm">
                <div className="rounded-xl bg-gray-50 p-3">
                  <div className="font-semibold">Toy factors</div>
                  <div>Each option adds or subtracts tons of CO₂‑equivalent per person per year.</div>
                </div>
                <div className="rounded-xl bg-gray-50 p-3">
                  <div className="font-semibold">Toy temperature model</div>
                  <div>
                    T<sub>2100</sub> ≈ 1.6°C + 0.35 × max(0, per‑capita − 2). The time series eases toward that value from ~1.2°C today.
                  </div>
                </div>
                <div className="rounded-xl bg-gray-50 p-3">
                  <div className="font-semibold">Replace with your data</div>
                  <div>
                    Swap in published emission factors and a climate model (e.g., an impulse‑response model) for rigorous work.
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showHelp && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
            <div className="max-w-2xl rounded-2xl bg-white p-6 shadow-xl">
              <div className="flex items-start justify-between gap-6">
                <div>
                  <h2 className="text-xl font-bold">How to use</h2>
                  <ol className="mt-2 list-inside list-decimal space-y-2 text-sm text-gray-700">
                    <li>Walk through each category and pick the options that best match your life.</li>
                    <li>Watch the right‑hand panel update your per‑capita footprint and category split.</li>
                    <li>Check the (toy) 2100 temperature projection and export your selections if needed.</li>
                    <li>Reset anytime to return to default assumptions.</li>
                  </ol>
                </div>
                <button className="rounded-full p-2 hover:bg-gray-100" onClick={() => setShowHelp(false)}>✕</button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
