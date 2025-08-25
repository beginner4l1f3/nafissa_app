import React, { useMemo, useState, useCallback } from "react";
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

/* ======================= Tipos & Constantes ======================= */

type StepId = "transport" | "home" | "food" | "shopping" | "flights" | "results";

type Choice = { label: string; icon?: string };
type StepConfig = { title: string; desc: string; options: Choice[] };

const STEPS: { id: StepId; title: string }[] = [
  { id: "transport", title: "Escola" },
  { id: "home", title: "Energia" },
  { id: "food", title: "Alimentação" },
  { id: "shopping", title: "Compras" },
  { id: "flights", title: "Férias" },
  { id: "results", title: "Resultados" },
];

const STEP_ORDER: StepId[] = ["transport", "home", "food", "shopping", "flights", "results"];

/* ======================= Helpers ======================= */

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

const toyTemperature2100 = (perCapita: number) => {
  const minT = 1.6;
  const t = minT + Math.max(0, perCapita - 2) * 0.35;
  return clamp(t, 1.3, 4.5);
};

const makeTempSeries = (perCapita: number) => {
  const end = toyTemperature2100(perCapita);
  const startYear = 2025;
  const endYear = 2100;
  const years = endYear - startYear;
  const startTemp = 1.2;
  const out: { year: number; temp: number }[] = [];
  for (let i = 0; i <= years; i++) {
    const y = startYear + i;
    const t = startTemp + (end - startTemp) * (1 - Math.exp(-i / 30));
    out.push({ year: y, temp: Number(t.toFixed(2)) });
  }
  return out;
};

const sum = (obj: Record<string, number>) => Object.values(obj).reduce((a, b) => a + b, 0);

/* ======================= UI ======================= */

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
      {index}
    </span>
    <span className="font-medium">{label}</span>
  </button>
);

const Panel: React.FC<{ title?: string; children: React.ReactNode; className?: string }> = ({ title, children, className }) => (
  <div className={`rounded-3xl border bg-white p-6 shadow-sm ${className || ""}`}>
    {title && <div className="mb-4 text-lg font-semibold">{title}</div>}
    {children}
  </div>
);

const PlaceCard: React.FC<{
  label: string;
  icon?: string;
  selected: boolean;
  onClick: () => void;
}> = ({ label, icon, selected, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={`flex h-44 w-full flex-col items-center justify-center gap-3 rounded-2xl border p-6 text-center shadow-sm transition hover:shadow-md ${
      selected ? "border-blue-600 bg-blue-50" : "border-gray-200 bg-white"
    }`}
  >
    {icon && (
      <img
        src={icon}
        alt={label}
        className={`h-14 w-14 object-contain ${selected ? "opacity-100" : "opacity-70"}`}
        loading="lazy"
      />
    )}
    <span className="text-base font-medium">{label}</span>
  </button>
);

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
          <button className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700" onClick={onClose}>
            OK
          </button>
        </div>
      </div>
    </div>
  );
};

/* ======================= Conteúdos dos passos ======================= */

const STEP_UI: Record<Exclude<StepId, "results">, StepConfig> = {
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
      "A forma como produzimos e usamos energia em casa influencia diretamente o consumo e as emissões. Energias renováveis (como solar) reduzem o impacto ambiental, enquanto fontes fósseis (como carvão e gasóleo) têm maior pegada de carbono.",
    options: [
      { label: "Eletricidade da Rede", icon: "/icons/energia/electricidadedarede.png" },
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

/* ======================= Componente Principal ======================= */

export default function ChooseOurFutureClone() {
  // seleções só para os 5 passos de perguntas
  const [sel, setSel] = useState<Record<"transport" | "home" | "food" | "shopping" | "flights", string>>({
    transport: "",
    home: "",
    food: "",
    shopping: "",
    flights: "",
  });
  const [stepIdx, setStepIdx] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [pendingStep, setPendingStep] = useState<number | null>(null);
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});

  const activeStep = STEP_ORDER[stepIdx];
  const isResults = activeStep === "results";
  const hasChoice = !isResults && Boolean(sel[activeStep as keyof typeof sel]);

  /* números pedagógicos (placeholder) */
  const totals = useMemo(() => ({ home: 1, transport: 1, food: 1, flights: 1, shopping: 1 }), []);
  const total = useMemo(() => sum(totals), [totals]);
  const t2100 = useMemo(() => toyTemperature2100(total), [total]);
  const tempSeries = useMemo(() => makeTempSeries(total), [total]);
  const pieData = useMemo(
    () => [
      { name: "Férias", value: totals.flights },
      { name: "Escola", value: totals.transport },
      { name: "Compras", value: totals.shopping },
      { name: "Alimentação", value: totals.food },
      { name: "Energia", value: totals.home },
    ],
    [totals]
  );

  /* handlers */
  const handleSelection = useCallback(
    (label: string) => {
      if (isResults) return;
      setSel((s) => ({ ...s, [activeStep]: label }));
    },
    [activeStep, isResults]
  );

  const handleNext = useCallback(() => {
    if (isResults) return;
    if (!hasChoice) return;

    const isLastBeforeResults = activeStep === "flights";

    if (!revealed[activeStep]) {
      setModalOpen(true);
      setPendingStep(isLastBeforeResults ? STEP_ORDER.indexOf("results") : stepIdx + 1);
      setRevealed((r) => ({ ...r, [activeStep]: true }));
      return;
    }

    setStepIdx((i) => (isLastBeforeResults ? STEP_ORDER.indexOf("results") : Math.min(STEP_ORDER.length - 1, i + 1)));
  }, [activeStep, hasChoice, isResults, revealed, stepIdx]);

  const handleBack = useCallback(() => setStepIdx((i) => Math.max(0, i - 1)), []);
  const handleStepChange = useCallback((i: number) => setStepIdx(i), []);
  const handleReset = useCallback(() => {
    setSel({ transport: "", home: "", food: "", shopping: "", flights: "" });
    setStepIdx(0);
    setRevealed({});
    setModalOpen(false);
    setPendingStep(null);
  }, []);
  const handleModalClose = useCallback(() => {
    setModalOpen(false);
    if (pendingStep !== null) {
      setStepIdx(pendingStep);
      setPendingStep(null);
    }
  }, [pendingStep]);

  /* ======================= Render ======================= */

  return (
    <div className="flex min-h-screen w-full flex-col bg-gradient-to-b from-slate-50 to-white">
      {/* Header */}
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 p-4 md:p-6">
        <div className="flex items-center gap-3">
          <img src="/icons/museusdomar.jpeg" alt="Museus do Mar" className="h-10 w-10 rounded-2xl object-cover shadow" loading="lazy" />
          <h1 className="text-xl font-bold md:text-2xl">Museus do Mar - Módulo de Desenvolvimento Cognitivo Sobre Poluição</h1>
        </div>
        <button className="rounded-xl bg-blue-600 px-3 py-2 text-sm font-medium text-white shadow hover:bg-blue-700" onClick={handleReset}>
          Recomeçar
        </button>
      </header>

      {/* Chips */}
      <div className="mx-auto mt-2 flex w-full max-w-6xl flex-wrap gap-2 px-4">
        {STEP_ORDER.map((id, i) => (
          <StepChip key={id} active={i === stepIdx} done={i < stepIdx} index={i + 1} label={STEPS.find((s) => s.id === id)?.title || id} onClick={() => handleStepChange(i)} />
        ))}
      </div>

      {/* Main */}
      <main className="mx-auto mt-4 w-full max-w-6xl flex-1 px-4 pb-6">
        {!isResults ? (
          <Panel title={STEP_UI[activeStep as Exclude<StepId, "results">].title}>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {STEP_UI[activeStep as Exclude<StepId, "results">].options.map((opt, i) => (
                <PlaceCard key={i} label={opt.label} icon={opt.icon} selected={sel[activeStep as keyof typeof sel] === opt.label} onClick={() => handleSelection(opt.label)} />
              ))}
            </div>

            <div className="mt-6 flex items-center justify-between">
              {stepIdx > 0 ? (
                <button className="rounded-xl border px-4 py-2 text-sm font-medium hover:bg-gray-50" onClick={handleBack}>
                  Voltar
                </button>
              ) : (
                <div />
              )}

              <div className="flex items-center gap-3">
                {!hasChoice && <span className="text-xs text-gray-500">Selecciona uma opção para continuar</span>}
                <button
                  className={`rounded-xl px-5 py-2 text-sm font-medium shadow ${hasChoice ? "bg-blue-600 text-white hover:bg-blue-700" : "cursor-not-allowed bg-gray-200 text-gray-500"}`}
                  onClick={handleNext}
                  disabled={!hasChoice}
                  aria-disabled={!hasChoice}
                >
                  Seguinte
                </button>
              </div>
            </div>
          </Panel>
        ) : (
          <>
            {/* Banner */}
            <div className="mb-4 rounded-3xl bg-gradient-to-r from-blue-600 to-cyan-500 p-6 text-white shadow">
              <h2 className="text-2xl font-extrabold">Resultados e Reflexão Final</h2>
              <p className="mt-1 text-sm opacity-90">Estes resultados baseiam-se nas escolhas que fizeste ao longo do módulo.</p>
            </div>

            {/* Gráficos */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Panel title="Aquecimento projetado até 2100 (modelo didático)">
                <div className="text-sm text-gray-600">Se toda a gente vivesse com escolhas semelhantes às tuas, a temperatura média global poderia aproximar-se de:</div>
                <div className="mt-2 text-4xl font-extrabold">≈ {t2100.toFixed(1)}°C</div>
                <div className="mt-2 h-48 w-full">
                  <ResponsiveContainer>
                    <LineChart data={tempSeries}>
                      <XAxis dataKey="year" tick={{ fontSize: 10 }} interval={10} />
                      <YAxis domain={[0, 5]} tick={{ fontSize: 10 }} />
                      <Tooltip formatter={(v: number) => `${v}°C`} />
                      <Legend />
                      <Line type="monotone" dataKey="temp" name="Temp. global (°C)" dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <p className="mt-3 text-xs text-gray-500">Nota: visualização educativa e simplificada. Um modelo científico rigoroso poderá produzir valores diferentes.</p>
              </Panel>

              <Panel title="Distribuição da tua pegada (estimativa pedagógica)">
                <div className="h-48 w-full">
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie data={pieData} dataKey="value" nameKey="name" outerRadius={80}>
                        {pieData.map((_, i) => (
                          <Cell key={i} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: number) => `${v.toFixed(2)} tCO2e/ano`} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <ul className="mt-3 grid grid-cols-2 gap-2 text-sm">
                  {pieData.map((p) => (
                    <li key={p.name} className="rounded-lg bg-gray-50 p-2">
                      <div className="text-xs text-gray-500">{p.name}</div>
                      <div className="font-medium">{p.value.toFixed(2)} tCO2e/ano</div>
                    </li>
                  ))}
                </ul>
              </Panel>

              <Panel title="O que significa este nível de temperatura?">
                <p className="text-sm text-gray-700">
                  O planeta aquece à medida que libertamos dióxido de carbono e outros gases com efeito de estufa. O valor acima é uma projeção
                  simplificada de quanto a Terra poderia aquecer até 2100 caso muitas pessoas tomassem decisões semelhantes às tuas. Para reduzir o
                  aquecimento, ajudam escolhas com menor consumo de energia e menos emissões, e mudanças coletivas em infraestruturas e tecnologias
                  limpas.
                </p>
              </Panel>

              <Panel title="E agora? Ideias para melhorar">
                <ul className="list-disc space-y-2 pl-5 text-sm text-gray-700">
                  <li>Preferir deslocações a pé, de bicicleta ou transporte partilhado.</li>
                  <li>Reduzir o consumo de energia e, quando possível, optar por fontes renováveis.</li>
                  <li>Experimentar refeições com menos carne ao longo da semana.</li>
                  <li>Dar prioridade a produtos locais e duráveis, evitando compras desnecessárias.</li>
                </ul>
              </Panel>
            </div>
          </>
        )}
      </main>

      {/* Modal (não aparece na página de resultados) */}
      {!isResults && (
        <Modal open={modalOpen} title={STEP_UI[activeStep as Exclude<StepId, "results">].title} onClose={handleModalClose}>
          {STEP_UI[activeStep as Exclude<StepId, "results">].desc}
        </Modal>
      )}

      {/* Footer fixo ao fundo */}
      <footer className="mt-auto w-full border-t bg-white/70">
        <div className="mx-auto max-w-6xl p-4 text-center text-sm text-gray-600">
          Desenvolvido por Kukuma Tech e Museus do Mar © 2025.
        </div>
      </footer>
    </div>
  );
}
