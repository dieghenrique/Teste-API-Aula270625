import { useState, useRef } from "react";
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Percent, 
  ShieldAlert, 
  CheckCircle, 
  FileText, 
  Download, 
  AlertTriangle, 
  Activity, 
  Building2, 
  Calendar, 
  ArrowLeft,
  ChevronRight,
  ShieldCheck,
  Scale
} from "lucide-react";
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  LineChart, 
  Line, 
  PieChart, 
  Pie, 
  Cell, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend 
} from "recharts";
import ReactMarkdown from "react-markdown";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import { AnalysisResult, RiskMapItem } from "../types";

interface DashboardProps {
  data: AnalysisResult;
  onBack: () => void;
}

export default function Dashboard({ data, onBack }: DashboardProps) {
  const [activeTab, setActiveTab] = useState<"kpis" | "charts" | "report" | "risks">("kpis");
  const [exporting, setExporting] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  // Helper formats
  const formatBRL = (value: number | null | undefined) => {
    if (value === null || value === undefined || isNaN(value)) return "Não Informado";
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  const formatPercent = (value: number | null | undefined) => {
    if (value === null || value === undefined || isNaN(value)) return "0,0%";
    return `${value.toFixed(1).replace(".", ",")}%`;
  };

  const formatNumber = (value: number | null | undefined) => {
    if (value === null || value === undefined || isNaN(value)) return "0,00";
    return value.toFixed(2).replace(".", ",");
  };

  // Color mappings for risks
  const getRiskBadgeColor = (nivel: RiskMapItem["nivel"]) => {
    switch (nivel) {
      case "Critico":
        return "bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100";
      case "Relevante":
        return "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100";
      case "Moderado":
        return "bg-yellow-50 text-yellow-800 border-yellow-200 hover:bg-yellow-100";
      case "Baixo":
        return "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100";
      default:
        return "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100";
    }
  };

  const getRiskIcon = (nivel: RiskMapItem["nivel"]) => {
    switch (nivel) {
      case "Critico":
        return <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0" />;
      case "Relevante":
        return <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />;
      case "Moderado":
        return <AlertTriangle className="w-5 h-5 text-yellow-600 shrink-0" />;
      case "Baixo":
        return <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />;
    }
  };

  // Handle PDF export
  const handleExportPDF = async () => {
    if (!reportRef.current) return;
    setExporting(true);

    try {
      // Store current style state, temporarily force clean printable layout
      const element = reportRef.current;
      const scrollY = window.scrollY;
      window.scrollTo(0, 0);

      // Take snapshot using html2canvas
      const canvas = await html2canvas(element, {
        scale: 1.8, // crisp quality
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff",
        windowWidth: 1200, // standard width for consistent charting layout
      });

      const imgData = canvas.toDataURL("image/jpeg", 0.95);
      const pdf = new jsPDF("p", "mm", "a4");
      const imgWidth = 210; // A4 standard width in mm
      const pageHeight = 297; // A4 standard height in mm
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      let heightLeft = imgHeight;
      let position = 0;

      // Add cover/header and first page
      pdf.addImage(imgData, "JPEG", 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      // Add consecutive pages
      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, "JPEG", 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      const safeName = data.empresa.replace(/[^a-z0-9]/gi, "_").toLowerCase();
      pdf.save(`Relatorio_Executivo_${safeName}.pdf`);
      window.scrollTo(0, scrollY);
    } catch (error) {
      console.error("Erro ao exportar PDF:", error);
      alert("Houve um erro ao renderizar e exportar o PDF. Por favor, tente novamente.");
    } finally {
      setExporting(false);
    }
  };

  // Pie colors
  const ATIVO_COLORS = ["#0f172a", "#3b82f6", "#10b981", "#6366f1"];
  const PASSIVO_COLORS = ["#475569", "#94a3b8", "#0f766e", "#f59e0b"];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <button 
            onClick={onBack}
            className="flex items-center text-sm font-medium text-slate-500 hover:text-slate-800 transition mb-2"
          >
            <ArrowLeft className="w-4 h-4 mr-1" /> Voltar para Upload
          </button>
          <div className="flex items-center gap-2">
            <Building2 className="w-6 h-6 text-blue-950" />
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
              {data.empresa}
            </h1>
          </div>
          <p className="text-slate-500 text-sm mt-1 flex items-center gap-1.5">
            <Calendar className="w-4 h-4 text-slate-400" />
            Análise realizada para o período de: <span className="font-semibold text-slate-700">{data.periodos.join(" e ")}</span>
          </p>
        </div>

        <button
          onClick={handleExportPDF}
          disabled={exporting}
          className="flex items-center justify-center gap-2 px-5 py-3 rounded-lg bg-blue-950 hover:bg-blue-900 text-white font-medium text-sm shadow-sm transition active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
        >
          {exporting ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              Gerando Relatório...
            </>
          ) : (
            <>
              <Download className="w-4 h-4" />
              Exportar Relatório PDF
            </>
          )}
        </button>
      </div>

      {/* Accounting Balance Checker Card */}
      <div className={`mb-8 p-4 rounded-xl border flex items-start gap-4 shadow-xs ${
        data.validacao.equacao_bate 
          ? "bg-emerald-50/50 border-emerald-100 text-emerald-950" 
          : "bg-amber-50/50 border-amber-200 text-amber-950"
      }`}>
        <div className={`p-2 rounded-lg shrink-0 ${data.validacao.equacao_bate ? "bg-emerald-100" : "bg-amber-100"}`}>
          {data.validacao.equacao_bate ? (
            <Scale className="w-5 h-5 text-emerald-700" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-amber-700" />
          )}
        </div>
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-sm">Consistência Contábil:</span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-semibold border ${
              data.validacao.equacao_bate 
                ? "bg-emerald-100/50 border-emerald-200 text-emerald-800" 
                : "bg-amber-100/50 border-amber-300 text-amber-800"
            }`}>
              {data.validacao.equacao_bate ? "Ativo = Passivo + PL (Consistente)" : "Divergência Detectada"}
            </span>
          </div>
          <p className="text-sm mt-1 text-slate-600 leading-relaxed">
            {data.validacao.observacoes} 
            {!data.validacao.equacao_bate && (
              <span className="font-semibold text-rose-600 block sm:inline ml-0 sm:ml-1">
                (Diferença de {formatBRL(data.validacao.diferenca)})
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Primary KPI Grid (Top Cards) */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 mb-8">
        {/* Ativo Total */}
        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-xs flex flex-col justify-between">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Ativo Total</span>
          <div className="mt-2">
            <span className="text-lg font-bold text-slate-900 block truncate">{formatBRL(data.kpis.ativo_total)}</span>
            <span className="text-[10px] font-mono text-slate-400">Último Exercício</span>
          </div>
        </div>

        {/* Receita Líquida */}
        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Receita Líg.</span>
            {data.kpis.receita_liquida_anterior && data.kpis.receita_liquida_atual > data.kpis.receita_liquida_anterior ? (
              <TrendingUp className="w-4 h-4 text-emerald-500 shrink-0" />
            ) : data.kpis.receita_liquida_anterior && (
              <TrendingDown className="w-4 h-4 text-rose-500 shrink-0" />
            )}
          </div>
          <div className="mt-2">
            <span className="text-lg font-bold text-slate-900 block truncate">{formatBRL(data.kpis.receita_liquida_atual)}</span>
            <span className="text-[10px] text-slate-400 block truncate">
              {data.kpis.receita_liquida_anterior ? `Ant: ${formatBRL(data.kpis.receita_liquida_anterior)}` : "Exercício Único"}
            </span>
          </div>
        </div>

        {/* Lucro Líquido */}
        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Lucro Líq.</span>
            {data.kpis.lucro_liquido_atual > 0 ? (
              <TrendingUp className="w-4 h-4 text-emerald-500 shrink-0" />
            ) : (
              <TrendingDown className="w-4 h-4 text-rose-500 shrink-0" />
            )}
          </div>
          <div className="mt-2">
            <span className={`text-lg font-bold block truncate ${data.kpis.lucro_liquido_atual >= 0 ? "text-slate-900" : "text-rose-600"}`}>
              {formatBRL(data.kpis.lucro_liquido_atual)}
            </span>
            <span className="text-[10px] text-slate-400 block truncate">
              {data.kpis.lucro_liquido_anterior ? `Ant: ${formatBRL(data.kpis.lucro_liquido_anterior)}` : "Exercício Único"}
            </span>
          </div>
        </div>

        {/* Liquidez Corrente */}
        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-xs flex flex-col justify-between">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Liq. Corrente</span>
          <div className="mt-2">
            <span className={`text-lg font-bold block ${data.kpis.liquidez_corrente >= 1 ? "text-slate-900" : "text-amber-600"}`}>
              {formatNumber(data.kpis.liquidez_corrente)}
            </span>
            <span className="text-[10px] font-mono text-slate-400">
              {data.kpis.liquidez_corrente >= 1.5 ? "Muito Saudável" : data.kpis.liquidez_corrente >= 1 ? "Adequado" : "Atenção (Gargalo)"}
            </span>
          </div>
        </div>

        {/* Margem Líquida */}
        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-xs flex flex-col justify-between">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Margem Líq.</span>
          <div className="mt-2">
            <span className={`text-lg font-bold block ${data.kpis.margem_liquida >= 10 ? "text-emerald-700" : data.kpis.margem_liquida > 0 ? "text-slate-900" : "text-rose-600"}`}>
              {formatPercent(data.kpis.margem_liquida)}
            </span>
            <span className="text-[10px] font-mono text-slate-400">Eficiência Operac.</span>
          </div>
        </div>

        {/* ROE */}
        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-xs flex flex-col justify-between">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">ROE</span>
          <div className="mt-2">
            <span className={`text-lg font-bold block ${data.kpis.roe >= 15 ? "text-emerald-700" : data.kpis.roe > 0 ? "text-slate-900" : "text-rose-600"}`}>
              {formatPercent(data.kpis.roe)}
            </span>
            <span className="text-[10px] font-mono text-slate-400">Retorno sobre o PL</span>
          </div>
        </div>

        {/* Endividamento */}
        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-xs flex flex-col justify-between">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Endividam.</span>
          <div className="mt-2">
            <span className={`text-lg font-bold block ${data.kpis.endividamento > 70 ? "text-rose-600" : data.kpis.endividamento > 50 ? "text-amber-600" : "text-slate-900"}`}>
              {formatPercent(data.kpis.endividamento)}
            </span>
            <span className="text-[10px] font-mono text-slate-400">Cap. de Terceiros</span>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex border-b border-slate-200 mb-6 overflow-x-auto scrollbar-none">
        <button
          onClick={() => setActiveTab("kpis")}
          className={`pb-4 px-4 font-medium text-sm border-b-2 transition whitespace-nowrap ${
            activeTab === "kpis" 
              ? "border-blue-950 text-blue-950" 
              : "border-transparent text-slate-400 hover:text-slate-600"
          }`}
        >
          Visão Geral & KPIs
        </button>
        <button
          onClick={() => setActiveTab("charts")}
          className={`pb-4 px-4 font-medium text-sm border-b-2 transition whitespace-nowrap ${
            activeTab === "charts" 
              ? "border-blue-950 text-blue-950" 
              : "border-transparent text-slate-400 hover:text-slate-600"
          }`}
        >
          Gráficos Contábeis
        </button>
        <button
          onClick={() => setActiveTab("report")}
          className={`pb-4 px-4 font-medium text-sm border-b-2 transition whitespace-nowrap ${
            activeTab === "report" 
              ? "border-blue-950 text-blue-950" 
              : "border-transparent text-slate-400 hover:text-slate-600"
          }`}
        >
          Relatório Executivo Completo
        </button>
        <button
          onClick={() => setActiveTab("risks")}
          className={`pb-4 px-4 font-medium text-sm border-b-2 transition whitespace-nowrap ${
            activeTab === "risks" 
              ? "border-blue-950 text-blue-950" 
              : "border-transparent text-slate-400 hover:text-slate-600"
          }`}
        >
          Mapa de Riscos ({data.mapa_riscos.length})
        </button>
      </div>

      {/* Tab Panels */}
      <div>
        {/* Tab 1: Visão Geral */}
        {activeTab === "kpis" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              {/* Executive Summary Mini Box */}
              <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-xs">
                <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-blue-950" /> Resumo Executivo da Gestão
                </h3>
                <div className="prose prose-slate max-w-none text-slate-600 text-sm leading-relaxed">
                  <ReactMarkdown>{data.relatorio.resumo_executivo}</ReactMarkdown>
                </div>
              </div>

              {/* DFC and Equity Change Summaries */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Main Risks List */}
                <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-xs flex flex-col justify-between">
                  <div>
                    <h3 className="text-base font-bold text-slate-900 mb-3 flex items-center gap-2">
                      <ShieldAlert className="w-5 h-5 text-rose-600" /> Sinais de Alerta Principais
                    </h3>
                    <div className="space-y-3">
                      {data.mapa_riscos.slice(0, 3).map((item, idx) => (
                        <div key={idx} className="flex gap-2.5 items-start">
                          <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                            item.nivel === "Critico" ? "bg-rose-500" : "bg-amber-500"
                          }`}></span>
                          <div>
                            <span className="text-xs font-semibold text-slate-800">{item.risco}</span>
                            <p className="text-[11px] text-slate-400 line-clamp-1">{item.impacto}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <button 
                    onClick={() => setActiveTab("risks")}
                    className="text-xs font-medium text-blue-950 hover:text-blue-900 inline-flex items-center gap-1 mt-4 transition"
                  >
                    Ver mapa de riscos detalhado <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Recommendations Mini Card */}
                <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-xs flex flex-col justify-between">
                  <div>
                    <h3 className="text-base font-bold text-slate-900 mb-3 flex items-center gap-2">
                      <ShieldCheck className="w-5 h-5 text-emerald-600" /> Recomendações Prioritárias
                    </h3>
                    <ul className="space-y-2">
                      {data.relatorio.recomendacoes.slice(0, 3).map((rec, idx) => (
                        <li key={idx} className="text-xs text-slate-600 flex items-start gap-2">
                          <span className="text-emerald-500 font-bold font-mono">✓</span>
                          <span className="line-clamp-2">{rec}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <button 
                    onClick={() => setActiveTab("report")}
                    className="text-xs font-medium text-blue-950 hover:text-blue-900 inline-flex items-center gap-1 mt-4 transition"
                  >
                    Ver relatório e recomendações completas <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Sidebar with Validation & General Status */}
            <div className="space-y-6">
              {/* Quick Info Box */}
              <div className="bg-slate-900 text-white p-6 rounded-xl shadow-xs relative overflow-hidden">
                <div className="absolute right-0 bottom-0 opacity-10 translate-x-1/4 translate-y-1/4">
                  <Activity className="w-48 h-48" />
                </div>
                <div className="relative z-10">
                  <h4 className="text-xs font-bold text-blue-300 uppercase tracking-widest">Status Geral da Empresa</h4>
                  <p className="text-2xl font-bold mt-2">Diagnóstico Sólido</p>
                  <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                    Nossa inteligência artificial consolidou os dados contábeis e identificou um perfil de risco financeiro estruturado. Use os gráficos e o relatório abaixo para embasar a tomada de decisões corporativas.
                  </p>
                  <div className="mt-4 pt-4 border-t border-slate-800 space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400">Receita Anualizada:</span>
                      <span className="font-semibold text-slate-200">{formatBRL(data.kpis.receita_liquida_atual)}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400">Eficiência de Caixa:</span>
                      <span className="font-semibold text-slate-200">CPC Integrado</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Explanatory notes summary */}
              <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-xs">
                <h3 className="text-sm font-bold text-slate-900 mb-3">Notas Explicativas & Detalhes</h3>
                <div className="text-xs text-slate-500 space-y-2 max-h-48 overflow-y-auto pr-1">
                  {data.relatorio.confirmacao_dados ? (
                    <ReactMarkdown>{data.relatorio.confirmacao_dados.substring(0, 300) + "..."}</ReactMarkdown>
                  ) : (
                    "Nenhuma nota explicativa complementar identificada no processamento contábil."
                  )}
                </div>
                <button 
                  onClick={() => setActiveTab("report")}
                  className="text-xs text-blue-950 font-semibold hover:underline mt-4 block"
                >
                  Ler notas completas no relatório →
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Gráficos Contábeis */}
        {activeTab === "charts" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Gráfico 1: Evolução Receita vs Lucro */}
            <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-xs">
              <h3 className="text-sm font-bold text-slate-800 mb-4 uppercase tracking-wider">Evolução: Receita Líquida vs Lucro Líquido</h3>
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.graficos.receita_lucro_evolucao} margin={{ top: 10, right: 10, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="ano" stroke="#94a3b8" fontSize={11} tickLine={false} />
                    <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} />
                    <Tooltip 
                      formatter={(value: any) => [formatBRL(Number(value)), ""]} 
                      contentStyle={{ backgroundColor: "#0f172a", borderRadius: "8px", border: "none", color: "#fff" }} 
                    />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: "11px", paddingTop: 10 }} />
                    <Bar dataKey="receita" name="Receita Líquida" fill="#0f172a" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="lucro" name="Lucro Líquido" fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Gráfico 2: Evolução de Margens */}
            <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-xs">
              <h3 className="text-sm font-bold text-slate-800 mb-4 uppercase tracking-wider">Evolução de Margens Contábeis (%)</h3>
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data.graficos.evolucao_margens} margin={{ top: 10, right: 10, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="ano" stroke="#94a3b8" fontSize={11} tickLine={false} />
                    <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} tickFormatter={(v) => `${v}%`} />
                    <Tooltip 
                      formatter={(value: any) => [`${Number(value).toFixed(1)}%`, ""]}
                      contentStyle={{ backgroundColor: "#0f172a", borderRadius: "8px", border: "none", color: "#fff" }} 
                    />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: "11px", paddingTop: 10 }} />
                    <Line type="monotone" dataKey="margem_bruta" name="Margem Bruta" stroke="#3b82f6" strokeWidth={2.5} activeDot={{ r: 6 }} />
                    <Line type="monotone" dataKey="margem_liquida" name="Margem Líquida" stroke="#10b981" strokeWidth={2.5} />
                    <Line type="monotone" dataKey="margem_ebitda" name="Margem EBITDA" stroke="#f59e0b" strokeWidth={2} strokeDasharray="4 4" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Gráfico 3: Composição do Ativo */}
            <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-xs">
              <h3 className="text-sm font-bold text-slate-800 mb-4 uppercase tracking-wider">Estrutura Patrimonial: Composição do Ativo</h3>
              <div className="h-[280px] flex flex-col sm:flex-row items-center justify-center gap-4">
                <div className="w-full sm:w-1/2 h-[220px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={data.graficos.composicao_ativo}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {data.graficos.composicao_ativo.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={ATIVO_COLORS[index % ATIVO_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: any) => [formatBRL(Number(value)), ""]} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="w-full sm:w-1/2 space-y-2">
                  {data.graficos.composicao_ativo.map((entry, index) => (
                    <div key={index} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="w-3 h-3 rounded-xs shrink-0" style={{ backgroundColor: ATIVO_COLORS[index % ATIVO_COLORS.length] }}></span>
                        <span className="text-slate-600 truncate">{entry.name}</span>
                      </div>
                      <span className="font-mono font-semibold text-slate-800">{formatBRL(entry.value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Gráfico 4: Composição do Passivo e PL */}
            <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-xs">
              <h3 className="text-sm font-bold text-slate-800 mb-4 uppercase tracking-wider">Estrutura Patrimonial: Passivo & PL</h3>
              <div className="h-[280px] flex flex-col sm:flex-row items-center justify-center gap-4">
                <div className="w-full sm:w-1/2 h-[220px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={data.graficos.composicao_passivo}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {data.graficos.composicao_passivo.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={PASSIVO_COLORS[index % PASSIVO_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: any) => [formatBRL(Number(value)), ""]} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="w-full sm:w-1/2 space-y-2">
                  {data.graficos.composicao_passivo.map((entry, index) => (
                    <div key={index} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="w-3 h-3 rounded-xs shrink-0" style={{ backgroundColor: PASSIVO_COLORS[index % PASSIVO_COLORS.length] }}></span>
                        <span className="text-slate-600 truncate">{entry.name}</span>
                      </div>
                      <span className="font-mono font-semibold text-slate-800">{formatBRL(entry.value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Gráfico 5: Indicadores de Liquidez */}
            <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-xs">
              <h3 className="text-sm font-bold text-slate-800 mb-4 uppercase tracking-wider">Evolução dos Índices de Liquidez</h3>
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data.graficos.indicadores_liquidez} margin={{ top: 10, right: 10, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="ano" stroke="#94a3b8" fontSize={11} tickLine={false} />
                    <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} />
                    <Tooltip 
                      formatter={(value: any) => [formatNumber(Number(value)), ""]}
                      contentStyle={{ backgroundColor: "#0f172a", borderRadius: "8px", border: "none", color: "#fff" }} 
                    />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: "11px", paddingTop: 10 }} />
                    <Line type="monotone" dataKey="liquidez_corrente" name="Liquidez Corrente" stroke="#0f172a" strokeWidth={2.5} />
                    <Line type="monotone" dataKey="liquidez_seca" name="Liquidez Seca" stroke="#e11d48" strokeWidth={2} />
                    <Line type="monotone" dataKey="liquidez_geral" name="Liquidez Geral" stroke="#0d9488" strokeWidth={2} strokeDasharray="3 3" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Gráfico 6: Análise Vertical da DRE */}
            <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-xs">
              <h3 className="text-sm font-bold text-slate-800 mb-4 uppercase tracking-wider">Análise Vertical da DRE (% sobre Receita Líq.)</h3>
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.graficos.analise_vertical_dre} layout="vertical" margin={{ top: 10, right: 10, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                    <XAxis type="number" stroke="#94a3b8" fontSize={11} tickLine={false} domain={[0, 100]} />
                    <YAxis type="category" dataKey="conta" stroke="#94a3b8" fontSize={10} tickLine={false} width={120} />
                    <Tooltip 
                      formatter={(value: any) => [`${Number(value).toFixed(1)}%`, "Representação"]} 
                      contentStyle={{ backgroundColor: "#0f172a", borderRadius: "8px", border: "none", color: "#fff" }} 
                    />
                    <Bar dataKey="percentual" fill="#1e293b" radius={[0, 4, 4, 0]} name="Representação (%)" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Relatório Executivo */}
        {activeTab === "report" && (
          <div className="bg-white p-8 rounded-xl border border-slate-100 shadow-sm max-w-4xl mx-auto space-y-8" id="report-printable-area" ref={reportRef}>
            {/* Header Document */}
            <div className="border-b-3 border-blue-950 pb-6">
              <div className="flex justify-between items-start gap-4">
                <div>
                  <h2 className="text-2xl font-extrabold tracking-tight text-slate-900 uppercase">Relatório Contábil Executivo</h2>
                  <p className="text-xs font-semibold text-blue-900 tracking-wider uppercase mt-1">Diagnóstico Contábil de Alta Precisão - Inteligência Artificial</p>
                </div>
                <div className="text-right">
                  <span className="text-xs font-mono font-bold text-slate-400 block">DOCUMENTO CONFIDENCIAL</span>
                  <span className="text-xs font-mono font-bold text-slate-700 block mt-1">{new Date().toLocaleDateString("pt-BR")}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-6 border-t border-slate-100">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Empresa Analisada</span>
                  <span className="text-xs font-bold text-slate-800">{data.empresa}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Período de Demonstração</span>
                  <span className="text-xs font-bold text-slate-800">{data.periodos.join(" - ")}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Validação da Equação</span>
                  <span className={`text-xs font-bold ${data.validacao.equacao_bate ? "text-emerald-600" : "text-amber-600"}`}>
                    {data.validacao.equacao_bate ? "Ativo = Passivo + PL ✓" : "Divergência Contábil ⚠"}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Modelo de Análise</span>
                  <span className="text-xs font-bold text-slate-800 font-mono">Gemini-3.5-Flash</span>
                </div>
              </div>
            </div>

            {/* Document Content Sections */}
            <div className="space-y-8 text-slate-700 leading-relaxed text-sm">
              {/* Seção 1: Confirmação */}
              <section className="space-y-3 pb-6 border-b border-slate-100">
                <h3 className="text-base font-extrabold text-blue-950 uppercase tracking-wide flex items-center gap-1.5">
                  <span className="w-1.5 h-4 bg-blue-950 block rounded-xs"></span>
                  1. Confirmação dos Dados & Integridade Contábil
                </h3>
                <div className="prose prose-slate max-w-none text-slate-600">
                  <ReactMarkdown>{data.relatorio.confirmacao_dados}</ReactMarkdown>
                </div>
              </section>

              {/* Seção 2: Resumo Executivo */}
              <section className="space-y-3 pb-6 border-b border-slate-100">
                <h3 className="text-base font-extrabold text-blue-950 uppercase tracking-wide flex items-center gap-1.5">
                  <span className="w-1.5 h-4 bg-blue-950 block rounded-xs"></span>
                  2. Resumo Executivo da Gestão
                </h3>
                <div className="prose prose-slate max-w-none text-slate-600">
                  <ReactMarkdown>{data.relatorio.resumo_executivo}</ReactMarkdown>
                </div>
              </section>

              {/* Seção 3: Análise Horizontal */}
              <section className="space-y-3 pb-6 border-b border-slate-100">
                <h3 className="text-base font-extrabold text-blue-950 uppercase tracking-wide flex items-center gap-1.5">
                  <span className="w-1.5 h-4 bg-blue-950 block rounded-xs"></span>
                  3. Análise Horizontal de Tendências
                </h3>
                <div className="prose prose-slate max-w-none text-slate-600">
                  <ReactMarkdown>{data.relatorio.analise_horizontal}</ReactMarkdown>
                </div>
              </section>

              {/* Seção 4: Análise Vertical */}
              <section className="space-y-3 pb-6 border-b border-slate-100">
                <h3 className="text-base font-extrabold text-blue-950 uppercase tracking-wide flex items-center gap-1.5">
                  <span className="w-1.5 h-4 bg-blue-950 block rounded-xs"></span>
                  4. Análise Vertical da Estrutura
                </h3>
                <div className="prose prose-slate max-w-none text-slate-600">
                  <ReactMarkdown>{data.relatorio.analise_vertical}</ReactMarkdown>
                </div>
              </section>

              {/* Seção 5: Indicadores */}
              <section className="space-y-3 pb-6 border-b border-slate-100">
                <h3 className="text-base font-extrabold text-blue-950 uppercase tracking-wide flex items-center gap-1.5">
                  <span className="w-1.5 h-4 bg-blue-950 block rounded-xs"></span>
                  5. Indicadores Contábeis e Interpretação
                </h3>
                <div className="prose prose-slate max-w-none text-slate-600">
                  <ReactMarkdown>{data.relatorio.indicadores_interpretacao}</ReactMarkdown>
                </div>
              </section>

              {/* Seção 6: Diagnóstico profundo */}
              <section className="space-y-3 pb-6 border-b border-slate-100">
                <h3 className="text-base font-extrabold text-blue-950 uppercase tracking-wide flex items-center gap-1.5">
                  <span className="w-1.5 h-4 bg-blue-950 block rounded-xs"></span>
                  6. Diagnóstico de Pontos Fortes e Fraquezas
                </h3>
                <div className="prose prose-slate max-w-none text-slate-600">
                  <ReactMarkdown>{data.relatorio.diagnostico}</ReactMarkdown>
                </div>
              </section>

              {/* Seção 7: Conclusão Executiva */}
              <section className="space-y-3 pb-6 border-b border-slate-100">
                <h3 className="text-base font-extrabold text-blue-950 uppercase tracking-wide flex items-center gap-1.5">
                  <span className="w-1.5 h-4 bg-blue-950 block rounded-xs"></span>
                  7. Conclusão Executiva e Visão de Futuro
                </h3>
                <div className="prose prose-slate max-w-none text-slate-600">
                  <ReactMarkdown>{data.relatorio.conclusao_executiva}</ReactMarkdown>
                </div>
              </section>

              {/* Seção 8: Recomendações */}
              <section className="space-y-3">
                <h3 className="text-base font-extrabold text-blue-950 uppercase tracking-wide flex items-center gap-1.5">
                  <span className="w-1.5 h-4 bg-blue-950 block rounded-xs"></span>
                  8. Recomendações Contábeis e Financeiras Práticas
                </h3>
                <div className="grid grid-cols-1 gap-3 mt-4">
                  {data.relatorio.recomendacoes.map((rec, idx) => (
                    <div key={idx} className="bg-slate-50 border-l-4 border-blue-950 p-4 rounded-r-lg">
                      <span className="text-xs font-extrabold text-blue-950 tracking-wider uppercase block mb-1">RECOMENDAÇÃO 0{idx + 1}</span>
                      <p className="text-xs text-slate-600 font-medium leading-relaxed">{rec}</p>
                    </div>
                  ))}
                </div>
              </section>
            </div>

            {/* Document Footer */}
            <div className="border-t border-slate-200 pt-6 mt-12 text-center text-[10px] text-slate-400 space-y-1">
              <p>Analista Contábil IA - Processamento de Demonstrações Financeiras e Notas Explicativas.</p>
              <p>Os diagnósticos gerados por inteligência artificial são consultivos e devem ser assinados por um contador legalmente habilitado.</p>
            </div>
          </div>
        )}

        {/* Tab 4: Mapa de Riscos */}
        {activeTab === "risks" && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-xs">
              <h3 className="text-lg font-bold text-slate-900 mb-2">Entendendo o Mapa de Riscos</h3>
              <p className="text-sm text-slate-500 leading-relaxed">
                Nossa IA analisa as vulnerabilidades estruturais do balanço, margens e fluxo de caixa, agrupando-as por criticidade. Riscos Críticos e Relevantes requerem mitigação imediata da gestão financeira da empresa.
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4 pt-4 border-t border-slate-100 text-center">
                <div className="p-3 bg-rose-50 border border-rose-100 rounded-lg">
                  <span className="text-xl font-bold text-rose-700 font-mono">
                    {data.mapa_riscos.filter(r => r.nivel === "Critico").length}
                  </span>
                  <p className="text-[10px] text-rose-600 font-bold uppercase mt-1">Crítico</p>
                </div>
                <div className="p-3 bg-amber-50 border border-amber-100 rounded-lg">
                  <span className="text-xl font-bold text-amber-700 font-mono">
                    {data.mapa_riscos.filter(r => r.nivel === "Relevante").length}
                  </span>
                  <p className="text-[10px] text-amber-600 font-bold uppercase mt-1">Relevante</p>
                </div>
                <div className="p-3 bg-yellow-50 border border-yellow-100 rounded-lg">
                  <span className="text-xl font-bold text-yellow-800 font-mono">
                    {data.mapa_riscos.filter(r => r.nivel === "Moderado").length}
                  </span>
                  <p className="text-[10px] text-yellow-700 font-bold uppercase mt-1">Moderado</p>
                </div>
                <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-lg">
                  <span className="text-xl font-bold text-emerald-700 font-mono">
                    {data.mapa_riscos.filter(r => r.nivel === "Baixo").length}
                  </span>
                  <p className="text-[10px] text-emerald-600 font-bold uppercase mt-1">Baixo</p>
                </div>
              </div>
            </div>

            {/* List of Risks */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {data.mapa_riscos.map((item, index) => (
                <div 
                  key={index}
                  className={`bg-white p-6 rounded-xl border shadow-xs flex flex-col justify-between transition-all duration-200 hover:shadow-md ${
                    item.nivel === "Critico" ? "border-l-4 border-l-rose-500" :
                    item.nivel === "Relevante" ? "border-l-4 border-l-amber-500" :
                    item.nivel === "Moderado" ? "border-l-4 border-l-yellow-500" :
                    "border-l-4 border-l-emerald-500"
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider bg-slate-50 border border-slate-100 px-2 py-0.5 rounded-xs">
                        {item.categoria}
                      </span>
                      <span className={`text-[10px] font-bold border px-2 py-0.5 rounded-full uppercase flex items-center gap-1 ${getRiskBadgeColor(item.nivel)}`}>
                        {getRiskIcon(item.nivel)}
                        {item.nivel}
                      </span>
                    </div>

                    <h4 className="text-sm font-bold text-slate-900 mb-2">{item.risco}</h4>
                    <p className="text-xs text-slate-600 leading-relaxed mb-4">
                      <strong className="text-slate-800">Impacto Contemplado:</strong> {item.impacto}
                    </p>
                  </div>

                  <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-100/50">
                    <span className="text-[9px] font-bold text-blue-950 uppercase tracking-wider block mb-1">Mitigação Recomendada</span>
                    <p className="text-xs text-slate-600 font-medium leading-relaxed">{item.recomendacao}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
