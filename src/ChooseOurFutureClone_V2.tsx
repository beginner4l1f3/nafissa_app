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
  value?: number;
  note?: string;
};

// Steps with Portuguese titles (menu chips)
const STEPS = [
  { id: "transport", title: "Escola" },
  { id: "home", title: "Energia" },
  { id: "food", title: "Alimentação" },
  { id: "shopping", title: "Compras" },
  { id: "flights", title: "Férias" },
];

const DEFAULTS: Record<string, string> = {
  // deixamos vazio para não pré-seleccionar nada
  home: "",
  grid: "",
  eff: "",
  mode: "",
  car: "",
  diet: "",
  waste: "",
  local: "",
  dom: "",
  intl: "",
  shop: "",
  elec: "",
  vacation: "",
};

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

const Panel: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="rounded-3xl border bg-white p-6 shadow-sm">
    <div className="mb-4 text-lg font-semibold">{title}</div>
    {children}
  </div>
);

const PlaceCard: React.FC<{
  label: string;
  icon?: string; // caminho em /public
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
    {icon && (
      <img
        src={icon}
        alt=""
        className={`mb-2 h-8 w-8 ${selected ? "opacity-100" : "opacity-60"}`}
        aria-hidden="true"
      />
    )}
    <span className="text-base font-medium">{label}</span>
  </button>
);

// Simple Modal component
const Modal: React.FC<{
  open: boolean;
  title?: string;
  children: React.ReactNode;
  onClose: () => void;
}> = ({ open, title, children, onClose }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
      <div className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
        <button
          aria-label="Fechar"
          className="absolute right-3 top-3 rounded-full p-2 text-gray-500 hover:bg-gray-100"
          onClick={onClose}
        >
          ×
        </button>
        {title && <h3 className="mb-2 text-lg font-semibold">{title}</h3>}
        <div className="text-sm text-gray-700">{children}</div>
        <div className="mt-4 flex justify-end">
          <button
            className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            onClick={onClose}
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
};

// --------------------------- Main ---------------------------

type Choice = { label: string; icon?: string };

export default function ChooseOurFutureClone() {
  const stepOrder = ["transport", "home", "food", "shopping", "flights"] as const;

  const [sel, setSel] = useState<Record<string, string>>({ ...DEFAULTS });
  const [stepIdx, setStepIdx] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [pendingStep, setPendingStep] = useState<number | null>(null);
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});

  const activeStep = stepOrder[stepIdx];
  const hasChoice = Boolean(sel[activeStep] && sel[activeStep] !== "");

  // Placeholder totals
  const totals = { home: 1, transport: 1, food: 1, flights: 1, shopping: 1 };
  const total = useMemo(() => sum(totals), [totals]);
  const perCapita = total;
  const t2100 = toyTemperature2100(perCapita);
  const tempSeries = useMemo(() => makeTempSeries(perCapita), [perCapita]);

  const pieData = [
    { name: "Férias", value: totals.flights },
    { name: "Escola", value: totals.transport },
    { name: "Compras", value: totals.shopping },
    { name: "Alimentação", value: totals.food },
    { name: "Energia", value: totals.home },
  ];

  // Perguntas por tema (cada opção com ícone)
  const STEP_UI: Record<string, { title: string; desc: string; options: Choice[] }> = {
    transport: {
      title: "Como costuma ir para a escola?",
      desc:
        "O meio de transporte utilizado para ir à escola tem impacto no consumo de energia e nas emissões de gases com efeito de estufa. Caminhar é a opção mais sustentável; transportes motorizados, sobretudo individuais, consomem mais recursos e poluem mais.",
      options: [
        { label: "A pé", icon: "/icons/escola/ape.png" },
        { label: "Chapa", icon: "/icons/escola/chapa.png" },
        { label: "Autocarro", icon: "/icons/escola/machimbombo.png" },
        { label: "Carro Pessoal", icon: "/icons/escola/carro.png" },
      ],
    },
    home: {
      title: "Que tipo de energia utiliza mais em casa?",
      desc:
        "A forma como produzimos e usamos energia em casa influencia directamente o consumo e as emissões. Energias renováveis (como solar) reduzem o impacto ambiental, enquanto fontes fósseis (como carvão e gasóleo) têm maior pegada de carbono.",
      options: [
        { label: "Electricidade da Rede", icon: "/icons/energia/electricidadedarede.png" },
        { label: "Painéis Solares", icon: "/icons/energia/painelsolar.png" },
        { label: "Gerador a Gasóleo/Petróleo", icon: "/icons/energia/gerador.png" },
        { label: "Lenha ou Carvão", icon: "/icons/energia/lenhacarvao.png" },
      ],
    },
    food: {
      title: "Que tipo de alimentação costuma ter?",
      desc:
        "A produção de carne e de produtos de origem animal emite metano e dióxido de carbono. Dietas com menos carne e mais alimentos de origem vegetal produzem menos emissões.",
      options: [
        { label: "Dieta com muita carne", icon: "/icons/alimentacao/muitacarne.png" },
        { label: "Dieta com alguma carne", icon: "/icons/alimentacao/dietacomcarne.png" },
        { label: "Dieta vegetariana", icon: "/icons/alimentacao/vegetariano.png" },
        { label: "Dieta vegana", icon: "/icons/alimentacao/vegano.png" },
      ],
    },
    shopping: {
      title: "Onde costuma fazer as suas compras do dia a dia?",
      desc:
        "As escolhas de consumo têm impacto no ambiente e na economia local. Comprar produtos locais reduz emissões associadas ao transporte; produtos importados tendem a ter maior pegada.",
      options: [
        { label: "Mercado Local", icon: "/icons/compras/mercadolocal.png" },
        { label: "Supermercado", icon: "/icons/compras/supermercado.png" },
        { label: "Compras Online", icon: "/icons/compras/comprasonline.png" },
        { label: "Produtos Importados com Frequência", icon: "/icons/compras/importados.png" },
      ],
    },
    flights: {
      title: "Que tipo de transporte usará nas próximas férias?",
      desc:
        "Os aviões são menos eficientes do que os carros e, quanto mais e mais longos forem os voos, maior será a energia necessária.",
      options: [
        { label: "Em Casa", icon: "/icons/ferias/emcasa.png" },
        { label: "Perto de Casa", icon: "/icons/ferias/pertodecasa.png" },
        { label: "Longe de Casa", icon: "/icons/ferias/longe.png" },
        { label: "Muito Longe de Casa", icon: "/icons/ferias/muitolongedecasa.png" },
      ],
    },
  };

  const handleNext = () => {
    if (!hasChoice) return; // impede avanço sem escolha

    const stepId = activeStep;
    if (!revealed[stepId]) {
      setModalOpen(true);
      setPendingStep(stepIdx + 1);
      setRevealed((r) => ({ ...r, [stepId]: true }));
      return;
    }
    setStepIdx((i) => Math.min(stepOrder.length - 1, i + 1));
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-slate-50 to-white p-4 md:p-8">
      <header className="mx-auto flex max-w-6xl items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-2xl bg-blue-600 font-bold text-white shadow">CF</div>
          <h1 className="text-xl font-bold md:text-2xl">Museus do Mar - Módulo de Desenvolvimento Cognitivo Sobre Poluição</h1>
        </div>
        <button
          className="rounded-xl bg-blue-600 px-3 py-2 text-sm font-medium text-white shadow hover:bg-blue-700"
          onClick={() => {
            setStepIdx(0);
            setRevealed({});
            setModalOpen(false);
            setSel({ ...DEFAULTS }); // limpar seleções
          }}
        >
          Recomeçar
        </button>
      </header>

      <div className="mx-auto mt-6 flex max-w-6xl flex-wrap gap-2">
        {stepOrder.map((id, i) => (
          <StepChip
            key={id}
            active={i === stepIdx}
            done={i < stepIdx}
            index={i}
            label={STEPS.find((s) => s.id === id)?.title || id}
            onClick={() => setStepIdx(i)}
          />
        ))}
      </div>

      <div className="mx-auto mt-6 grid max-w-6xl grid-cols-1 gap-6 md:grid-cols-3">
        <div className="md:col-span-2">
          <Panel title={STEP_UI[activeStep].title}>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {STEP_UI[activeStep].options.map((opt, i) => (
                <PlaceCard
                  key={i}
                  label={opt.label}
                  icon={opt.icon}
                  selected={sel[activeStep] === opt.label}
                  onClick={() => setSel((s) => ({ ...s, [activeStep]: opt.label }))}
                />
              ))}
            </div>

            <div className="mt-4 flex items-center justify-between">
              {stepIdx > 0 ? (
                <button
                  className="rounded-xl border px-4 py-2 text-sm font-medium hover:bg-gray-50"
                  onClick={() => setStepIdx((i) => Math.max(0, i - 1))}
                >
                  Voltar
                </button>
              ) : (
                <div />
              )}

              <div className="flex items-center gap-3">
                {!hasChoice && (
                  <span className="text-xs text-gray-500">Selecciona uma opção para continuar</span>
                )}
                <button
                  className={`rounded-xl px-4 py-2 text-sm font-medium shadow ${
                    hasChoice
                      ? "bg-blue-600 text-white hover:bg-blue-700"
                      : "bg-gray-200 text-gray-500 cursor-not-allowed"
                  }`}
                  onClick={handleNext}
                  disabled={!hasChoice}
                >
                  Seguinte
                </button>
              </div>
            </div>
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel title="Previsão do teu nível de poluição anual">
            <div className="grid grid-cols-2 items-center gap-4">
              <div>
                <div className="text-4xl font-extrabold">
                  {perCapita.toFixed(2)}
                  <span className="text-xl font-semibold text-gray-500"> tCO2e/ano</span>
                </div>
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
          </Panel>

          <Panel title="Se todos fossemos assim">
            <div className="text-sm text-gray-600">Aquecimento global projectado até 2100.</div>
            <div className="mt-2 text-3xl font-bold">~ {t2100.toFixed(1)}°C</div>
            <div className="mt-2 h-40 w-full">
              <ResponsiveContainer>
                <LineChart data={tempSeries}>
                  <XAxis dataKey="year" tick={{ fontSize: 10 }} interval={10} />
                  <YAxis domain={[0, 5]} tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(v: any) => `${v}°C`} />
                  <Legend />
                  <Line type="monotone" dataKey="temp" name={"Temp. global (°C)"} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Panel>
        </div>
      </div>

      {/* Modal for explanations */}
      <Modal
        open={modalOpen}
        title={STEP_UI[activeStep].title}
        onClose={() => {
          setModalOpen(false);
          if (pendingStep !== null) {
            setStepIdx(pendingStep);
            setPendingStep(null);
          }
        }}
      >
        {STEP_UI[activeStep].desc}
      </Modal>

      <div className="mx-auto mt-6 max-w-6xl rounded-3xl border bg-white p-4 text-center text-sm text-gray-600">
        Desenvolvido por Kukuma Tech e Museus do Mar (c) 2025.
      </div>
    </div>
  );
}
