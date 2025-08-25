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

// paleta de cores suaves mas vivas
const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#AA46BE"];

/* ======================= Dados de Emissões ======================= */

// Definir tipo para os dados de emissão
type EmissionData = {
  [category: string]: {
    [option: string]: { semana: number; mes: number; ano: number; ate2100: number };
  };
};

const EMISSION_DATA: EmissionData = {
  transporte_escola: {
    "A pé": { semana: 0.0, mes: 0.0, ano: 0.0, ate2100: 0 },
    "Chapa": { semana: 2.5, mes: 10.8, ano: 130, ate2100: 9750 },
    "Autocarro": { semana: 1.3, mes: 5.4, ano: 65, ate2100: 4875 },
    "Carro Pessoal": { semana: 7.5, mes: 32.5, ano: 390, ate2100: 29250 }
  },
  energia_casa: {
    "Eletricidade da Rede": { semana: 1.8, mes: 8.0, ano: 96, ate2100: 7200 },
    "Painéis Solares": { semana: 0.0, mes: 0.0, ano: 0, ate2100: 0 },
    "Gerador a Gasóleo/Petróleo": { semana: 16.2, mes: 70, ano: 840, ate2100: 63000 },
    "Lenha ou Carvão": { semana: 13.5, mes: 58, ano: 700, ate2100: 52500 }
  },
  alimentacao: {
    "Dieta com muita carne": { semana: 50.0, mes: 216.7, ano: 2600, ate2100: 195000 },
    "Dieta com alguma carne": { semana: 38.5, mes: 166.7, ano: 2000, ate2100: 150000 },
    "Dieta vegetariana": { semana: 26.7, mes: 115.8, ano: 1390, ate2100: 104250 },
    "Dieta vegana": { semana: 19.2, mes: 83.3, ano: 1000, ate2100: 75000 }
  },
  compras: {
    "Mercado Local": { semana: 1.0, mes: 4.2, ano: 50, ate2100: 3750 },
    "Supermercado": { semana: 1.9, mes: 8.3, ano: 100, ate2100: 7500 },
    "Compras Online": { semana: 2.9, mes: 12.5, ano: 150, ate2100: 11250 },
    "Produtos Importados com Frequência": { semana: 5.8, mes: 25, ano: 300, ate2100: 22500 }
  },
  ferias: {
    "Em Casa": { semana: 0.0, mes: 0.0, ano: 0, ate2100: 0 },
    "Perto de Casa": { semana: 1.9, mes: 8.3, ano: 100, ate2100: 7500 },
    "Longe de Casa": { semana: 19.2, mes: 83.3, ano: 1000, ate2100: 75000 },
    "Muito Longe de Casa": { semana: 57.7, mes: 250.0, ano: 3000, ate2100: 225000 }
  }
};

// Mapeamento entre as chaves do STEP_UI e as chaves do EMISSION_DATA
const CATEGORY_MAPPING: Record<string, keyof typeof EMISSION_DATA> = {
  transport: "transporte_escola",
  home: "energia_casa", 
  food: "alimentacao",
  shopping: "compras",
  flights: "ferias"
};

/* ======================= Helpers ======================= */

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

const calculateTotalEmissions = (selections: Record<string, string>) => {
  let total = 0;
  
  Object.keys(selections).forEach(categoryKey => {
    const selection = selections[categoryKey];
    const emissionCategory = CATEGORY_MAPPING[categoryKey];
    
    if (selection && emissionCategory && EMISSION_DATA[emissionCategory] && EMISSION_DATA[emissionCategory][selection]) {
      total += EMISSION_DATA[emissionCategory][selection].ano;
    }
  });
  
  return total;
};

const calculateCumulative2100 = (selections: Record<string, string>) => {
  let total = 0;
  
  Object.keys(selections).forEach(categoryKey => {
    const selection = selections[categoryKey];
    const emissionCategory = CATEGORY_MAPPING[categoryKey];
    
    if (selection && emissionCategory && EMISSION_DATA[emissionCategory] && EMISSION_DATA[emissionCategory][selection]) {
      total += EMISSION_DATA[emissionCategory][selection].ate2100;
    }
  });
  
  return total;
};

// Função para calcular o aquecimento global baseado nas emissões
const calculateWarming = (cumulativeEmissions: number) => {
  // Modelo simplificado: 4.3°C para 2.20 trilhões de toneladas
  const baseEmissions = 2200000000000; // 2.20 trilhões
  const baseWarming = 4.3; // 4.3°C
  
  // Ajuste proporcional (modelo simplificado)
  const warming = (cumulativeEmissions / baseEmissions) * baseWarming;
  
  // Garantir um mínimo realista (já estamos em ~1.2°C acima dos níveis pré-industriais)
  return Math.max(1.2, warming);
};

// Função para criar a série temporal de temperatura (CORRIGIDA)
const makeTempSeries = (cumulativeEmissions: number) => {
  const endWarming = calculateWarming(cumulativeEmissions);
  const startYear = 2025;
  const endYear = 2100;
  const years = endYear - startYear;
  const startTemp = 1.2; // Temperatura atual (acima dos níveis pré-industriais)
  const out: { year: number; temp: number }[] = [];
  
  // Adicionar alguns dados históricos para contexto
  out.push({ year: 2000, temp: 0.9 });
  out.push({ year: 2010, temp: 1.0 });
  out.push({ year: 2020, temp: 1.2 });
  
  // Projeção futura (CORREÇÃO: temperatura deve aumentar, não diminuir)
  for (let i = 0; i <= years; i++) {
    const y = startYear + i;
    // Curva de aquecimento: progressão linear em direção ao valor final
    const progress = i / years;
    const t = startTemp + (endWarming - startTemp) * progress;
    out.push({ year: y, temp: Number(t.toFixed(2)) });
  }
  
  return out;
};

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
      "As escolhas de consumo têm impacto no ambiente e na economia local. Comprar produtos locais reduz emissões associadas ao transporte; produtos importados tendem a têm maior pegada.",
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

  // Calcular totais baseados nas seleções
  const perCapita = useMemo(() => calculateTotalEmissions(sel), [sel]);
  const cumulative2100 = useMemo(() => calculateCumulative2100(sel), [sel]);
  const t2100 = useMemo(() => calculateWarming(cumulative2100), [cumulative2100]);
  const tempSeries = useMemo(() => makeTempSeries(cumulative2100), [cumulative2100]);
  
  // Calcular dados para o gráfico de pizza baseado nas emissões anuais
  const pieData = useMemo(() => {
    const categories = Object.keys(sel);
    return categories.map(categoryKey => {
      const selection = sel[categoryKey as keyof typeof sel];
      const emissionCategory = CATEGORY_MAPPING[categoryKey];
      const value = selection && emissionCategory && EMISSION_DATA[emissionCategory] && EMISSION_DATA[emissionCategory][selection] 
        ? EMISSION_DATA[emissionCategory][selection].ano 
        : 0;
      
      return {
        name: STEPS.find(s => s.id === categoryKey)?.title || categoryKey,
        value: value
      };
    }).filter(item => item.value > 0); // Apenas categorias com valores
  }, [sel]);

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
      setPendingStep(isLastBeforeResults ? STEP_ORDER.indexOf("results") : Math.min(STEP_ORDER.length - 1, stepIdx + 1));
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
                <div className="mt-2 text-4xl font-extrabold">≈ {t2100.toFixed(2)}°C</div>
                <div className="mt-2 h-48 w-full">
                  <ResponsiveContainer>
                    <LineChart data={tempSeries}>
                      <XAxis dataKey="year" tick={{ fontSize: 10 }} interval={10} />
                      <YAxis domain={[0, 5]} tick={{ fontSize: 10 }} />
                      <Tooltip formatter={(v: number) => [`${v}°C`, "Temperatura"]} />
                      <Legend />
                      <Line type="monotone" dataKey="temp" name="Temp. global (°C)" dot={false} stroke="#ff7300" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <p className="mt-3 text-xs text-gray-500">Nota: visualização educativa e simplificada. Um modelo científico rigoroso poderá produzir valores diferentes.</p>
              </Panel>

              <Panel title="Distribuição da tua pegada anual">
                <div className="h-48 w-full">
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie data={pieData} dataKey="value" nameKey="name" outerRadius={80}>
                        {pieData.map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: number) => [`${v.toFixed(2)} tCO₂e/ano`, "Emissões"]} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <ul className="mt-3 grid grid-cols-2 gap-2 text-sm">
                  {pieData.map((p, i) => (
                    <li key={p.name} className="flex items-center gap-2 rounded-lg bg-gray-50 p-2">
                      <span
                        className="inline-block h-3 w-3 rounded-sm"
                        style={{ backgroundColor: COLORS[i % COLORS.length] }}
                      />
                      <div>
                        <div className="text-xs text-gray-500">{p.name}</div>
                        <div className="font-medium">{p.value.toFixed(2)} tCO₂e/ano</div>
                      </div>
                    </li>
                  ))}
                </ul>
              </Panel>

              <Panel title="Emissões Cumulativas até 2100">
                <div className="text-sm text-gray-600">
                  Com base nas tuas escolhas, as tuas emissões cumulativas até 2100 seriam de:
                </div>
                <div className="mt-2 text-3xl font-bold">
                  {(cumulative2100 / 1000000).toFixed(2)} milhões de tCO₂e
                </div>
                <div className="mt-2 text-sm text-gray-500">
                  Isto contribuiria para um aquecimento global de aproximadamente:
                </div>
                <div className="mt-1 text-2xl font-extrabold text-orange-600">
                  {t2100.toFixed(2)}°C acima dos níveis pré-industriais
                </div>
              </Panel>

              <Panel title="O que significam estes números?">
                <p className="text-sm text-gray-700">
                  As <strong>emissões cumulativas até 2100</strong> representam o total de gases com efeito de estufa que 
                  seriam libertados se mantivesses estes hábitos ao longo da tua vida. 
                  O <strong>aquecimento global de {t2100.toFixed(2)}°C</strong> é uma projecção baseada no impacto 
                  colectivo se muitas pessoas fizessem escolhas semelhantes às tuas.
                </p>
                <p className="mt-3 text-sm text-gray-700">
                  Para contexto, as metas do Acordo de Paris visam limitar o aquecimento a <strong>1.5-2.0°C</strong>, 
                  mas as trajectórias actuais apontam para <strong>2.5-3.0°C</strong> até 2100.
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
