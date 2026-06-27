import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Upload, 
  FileText, 
  CheckCircle, 
  AlertCircle, 
  Loader2, 
  Building2, 
  Trash2, 
  HelpCircle,
  Clock,
  RefreshCw,
  TrendingUp,
  FileCheck2,
  ShieldCheck
} from "lucide-react";
import Dashboard from "./components/Dashboard";
import { AnalysisResult, ChunkExtraction, ConsolidatedData } from "./types";

const MAX_CHARACTER_CHUNK = 40000; // ~10.000 tokens, safe limit for gemini-3.5-flash tier free
const SECONDS_BETWEEN_CALLS = 6;

export default function App() {
  // Session storage caching
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(() => {
    const cached = sessionStorage.getItem("analista_contabil_result");
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch (e) {
        return null;
      }
    }
    return null;
  });

  const [cachedFileName, setCachedFileName] = useState<string | null>(() => {
    return sessionStorage.getItem("analista_contabil_source_file_name");
  });

  // Upload & Extraction states
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [pdfText, setPdfText] = useState<string>("");
  
  // Queue state
  const [totalChunks, setTotalChunks] = useState(0);
  const [currentChunkIndex, setCurrentChunkIndex] = useState(0);
  const [cooldownCountdown, setCooldownCountdown] = useState(0);
  const [logs, setLogs] = useState<string[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Auto scroll progress logs
  useEffect(() => {
    const element = document.getElementById("log-viewport");
    if (element) {
      element.scrollTop = element.scrollHeight;
    }
  }, [logs]);

  // Countdown timer for 6s cooldown
  useEffect(() => {
    if (cooldownCountdown > 0) {
      const timer = setTimeout(() => {
        setCooldownCountdown(prev => prev - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldownCountdown]);

  // Push new log message with current time
  const addLog = useCallback((message: string) => {
    const now = new Date();
    const timeStr = now.toLocaleTimeString("pt-BR");
    setLogs(prev => [...prev, `[${timeStr}] ${message}`]);
  }, []);

  // Browser-side PDF text extraction using PDF.js
  const extractTextFromPdf = async (targetFile: File): Promise<string> => {
    addLog(`Iniciando leitura local do PDF: "${targetFile.name}"...`);
    const arrayBuffer = await targetFile.arrayBuffer();
    
    const pdfjsLib = (window as any).pdfjsLib;
    if (!pdfjsLib || !pdfjsLib.getDocument) {
      throw new Error("A biblioteca de leitura de PDF (PDF.js) não pôde ser carregada do CDN. Verifique sua conexão com a internet.");
    }

    // Configure CDN worker correctly
    pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js";

    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;
    let extractedText = "";

    addLog(`PDF carregado com sucesso. Total de páginas: ${pdf.numPages}. Extraindo conteúdo...`);

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(" ");
      extractedText += `\n--- PÁGINA ${i} ---\n` + pageText;
      
      if (i % 5 === 0 || i === pdf.numPages) {
        addLog(`Páginas extraídas: ${i} de ${pdf.numPages}...`);
      }
    }

    return extractedText;
  };

  // Helper wait function
  const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  // Call the chunk analysis API with rate-limiting retries
  const analyzeChunkWithRetry = async (
    chunkText: string,
    chunkIndex: number,
    total: number
  ): Promise<ChunkExtraction> => {
    const retries = [20000, 40000, 60000]; // exponential backoff retries as requested
    let attempt = 0;

    while (true) {
      try {
        const response = await fetch("/api/analyze-chunk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chunkText, chunkIndex, totalChunks: total }),
        });

        if (response.status === 429 || response.status === 503) {
          if (attempt < retries.length) {
            const waitTime = retries[attempt];
            addLog(`⚠ O modelo Gemini está ocupado ou limite atingido (Erro ${response.status}). Aguardando ${waitTime / 1000}s para retentar (Tentativa ${attempt + 1}/${retries.length})...`);
            setCooldownCountdown(waitTime / 1000);
            await wait(waitTime);
            setCooldownCountdown(0);
            attempt++;
            continue;
          } else {
            throw new Error(`O modelo Gemini está temporariamente indisponível ou limite de chamadas atingido (${response.status}). Por favor, tente novamente mais tarde.`);
          }
        }

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          const errMsg = errorData.message || errorData.error || `Erro de rede (${response.status})`;
          
          const isTransient = 
            response.status === 500 && 
            (errMsg.includes("503") || 
             errMsg.toLowerCase().includes("unavailable") || 
             errMsg.toLowerCase().includes("high demand") || 
             errMsg.toLowerCase().includes("temporary") ||
             errMsg.toLowerCase().includes("overloaded") ||
             errMsg.toLowerCase().includes("demanda") ||
             errMsg.toLowerCase().includes("limite") ||
             errMsg.toLowerCase().includes("rate limit") ||
             errMsg.toLowerCase().includes("try again"));

          if (isTransient && attempt < retries.length) {
            const waitTime = retries[attempt];
            addLog(`⚠ Instabilidade temporária no Gemini detectada: "${errMsg}". Aguardando ${waitTime / 1000}s para retentar (Tentativa ${attempt + 1}/${retries.length})...`);
            setCooldownCountdown(waitTime / 1000);
            await wait(waitTime);
            setCooldownCountdown(0);
            attempt++;
            continue;
          }

          throw new Error(errMsg);
        }

        return await response.json();
      } catch (error: any) {
        const errMessage = error.message || "";
        const isTransientErr = 
          errMessage.includes("429") || 
          errMessage.includes("503") ||
          errMessage.toLowerCase().includes("unavailable") ||
          errMessage.toLowerCase().includes("high demand") ||
          errMessage.toLowerCase().includes("temporary") ||
          errMessage.toLowerCase().includes("rate limit") ||
          errMessage.toLowerCase().includes("overloaded");

        if (attempt < retries.length && isTransientErr) {
          const waitTime = retries[attempt];
          addLog(`⚠ Erro temporário na rede ou API: "${errMessage}". Esperando ${waitTime / 1000}s para tentar novamente...`);
          setCooldownCountdown(waitTime / 1000);
          await wait(waitTime);
          setCooldownCountdown(0);
          attempt++;
          continue;
        }
        throw error;
      }
    }
  };

  // Divide the text into safe chunks at line boundaries
  const splitTextIntoChunks = (text: string, maxChunkSize = MAX_CHARACTER_CHUNK): string[] => {
    const lines = text.split("\n");
    const chunks: string[] = [];
    let currentChunk = "";

    for (const line of lines) {
      if ((currentChunk + "\n" + line).length > maxChunkSize) {
        if (currentChunk.trim() !== "") {
          chunks.push(currentChunk);
        }
        currentChunk = line;
      } else {
        currentChunk = currentChunk === "" ? line : currentChunk + "\n" + line;
      }
    }

    if (currentChunk.trim() !== "") {
      chunks.push(currentChunk);
    }

    return chunks;
  };

  // Smart Consolidation (Etapa 2)
  const consolidateExtractions = (extractions: ChunkExtraction[]): ConsolidatedData => {
    addLog("Iniciando consolidação dos dados extraídos...");

    // Pick first non-empty company name
    const companyName = extractions.find(e => e.empresa)?.empresa || "Empresa Contábil S.A.";

    // Collect all unique years in alphabetical/chronological order
    const allYearsSet = new Set<string>();
    extractions.forEach(e => {
      if (Array.isArray(e.anos)) {
        e.anos.forEach(y => allYearsSet.add(y));
      }
      if (Array.isArray(e.balanco_patrimonial)) {
        e.balanco_patrimonial.forEach(acc => {
          if (Array.isArray(acc.valores)) {
            acc.valores.forEach(v => {
              if (v.ano) allYearsSet.add(v.ano);
            });
          }
        });
      }
    });
    const sortedYears = Array.from(allYearsSet).sort((a, b) => a.localeCompare(b));

    // Consolidate Balanço Patrimonial accounts
    const balancoMap = new Map<string, { grupo: string; conta: string; valoresMap: Map<string, number> }>();
    extractions.forEach(e => {
      if (Array.isArray(e.balanco_patrimonial)) {
        e.balanco_patrimonial.forEach(acc => {
          const key = `${acc.grupo || "Geral"}||${acc.conta}`.toLowerCase().trim();
          if (!balancoMap.has(key)) {
            balancoMap.set(key, {
              grupo: acc.grupo || "Ativo Circulante",
              conta: acc.conta,
              valoresMap: new Map<string, number>()
            });
          }
          const mapped = balancoMap.get(key)!;
          if (Array.isArray(acc.valores)) {
            acc.valores.forEach(val => {
              if (val.ano && val.valor !== null && val.valor !== undefined) {
                mapped.valoresMap.set(val.ano, val.valor);
              }
            });
          }
        });
      }
    });

    const balancoPatrimonial = Array.from(balancoMap.values()).map(b => ({
      grupo: b.grupo,
      conta: b.conta,
      valores: Array.from(b.valoresMap.entries()).map(([ano, valor]) => ({ ano, valor }))
    }));

    // Consolidate DRE accounts
    const dreMap = new Map<string, { conta: string; valoresMap: Map<string, number> }>();
    extractions.forEach(e => {
      if (Array.isArray(e.dre)) {
        e.dre.forEach(acc => {
          const key = acc.conta.toLowerCase().trim();
          if (!dreMap.has(key)) {
            dreMap.set(key, {
              conta: acc.conta,
              valoresMap: new Map<string, number>()
            });
          }
          const mapped = dreMap.get(key)!;
          if (Array.isArray(acc.valores)) {
            acc.valores.forEach(val => {
              if (val.ano && val.valor !== null && val.valor !== undefined) {
                mapped.valoresMap.set(val.ano, val.valor);
              }
            });
          }
        });
      }
    });

    const dre = Array.from(dreMap.values()).map(d => ({
      conta: d.conta,
      valores: Array.from(d.valoresMap.entries()).map(([ano, valor]) => ({ ano, valor }))
    }));

    // Consolidate DFC accounts
    const dfcMap = new Map<string, { conta: string; valoresMap: Map<string, number> }>();
    extractions.forEach(e => {
      if (Array.isArray(e.dfc)) {
        e.dfc.forEach(acc => {
          const key = acc.conta.toLowerCase().trim();
          if (!dfcMap.has(key)) {
            dfcMap.set(key, {
              conta: acc.conta,
              valoresMap: new Map<string, number>()
            });
          }
          const mapped = dfcMap.get(key)!;
          if (Array.isArray(acc.valores)) {
            acc.valores.forEach(val => {
              if (val.ano && val.valor !== null && val.valor !== undefined) {
                mapped.valoresMap.set(val.ano, val.valor);
              }
            });
          }
        });
      }
    });

    const dfc = Array.from(dfcMap.values()).map(d => ({
      conta: d.conta,
      valores: Array.from(d.valoresMap.entries()).map(([ano, valor]) => ({ ano, valor }))
    }));

    // Consolidate explanatory notes
    const notesSet = new Set<string>();
    extractions.forEach(e => {
      if (Array.isArray(e.notas_explicativas)) {
        e.notas_explicativas.forEach(n => {
          if (n && n.trim() !== "") notesSet.add(n.trim());
        });
      }
    });

    addLog(`Consolidação finalizada. Empresa: "${companyName}". Anos consolidados: ${sortedYears.join(", ")}`);

    return {
      empresa: companyName,
      anos: sortedYears,
      balanco_patrimonial: balancoPatrimonial,
      dre,
      dfc,
      notas_explicativas: Array.from(notesSet)
    };
  };

  // Call the consolidated analysis API with rate-limiting & 503 retries
  const analyzeConsolidatedWithRetry = async (
    consolidated: ConsolidatedData
  ): Promise<AnalysisResult> => {
    const retries = [20000, 40000, 60000];
    let attempt = 0;

    while (true) {
      try {
        const response = await fetch("/api/analyze-consolidated", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ consolidatedData: consolidated }),
        });

        if (response.status === 429 || response.status === 503) {
          if (attempt < retries.length) {
            const waitTime = retries[attempt];
            addLog(`⚠ O modelo Gemini está ocupado ou limite atingido na análise profunda (Erro ${response.status}). Aguardando ${waitTime / 1000}s para retentar (Tentativa ${attempt + 1}/${retries.length})...`);
            setCooldownCountdown(waitTime / 1000);
            await wait(waitTime);
            setCooldownCountdown(0);
            attempt++;
            continue;
          } else {
            throw new Error(`O modelo Gemini está temporariamente indisponível ou limite de chamadas atingido na etapa final (${response.status}). Por favor, tente novamente mais tarde.`);
          }
        }

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          const errMsg = errorData.message || errorData.error || `Erro de rede (${response.status})`;

          const isTransient = 
            response.status === 500 && 
            (errMsg.includes("503") || 
             errMsg.toLowerCase().includes("unavailable") || 
             errMsg.toLowerCase().includes("high demand") || 
             errMsg.toLowerCase().includes("temporary") ||
             errMsg.toLowerCase().includes("overloaded") ||
             errMsg.toLowerCase().includes("demanda") ||
             errMsg.toLowerCase().includes("limite") ||
             errMsg.toLowerCase().includes("rate limit") ||
             errMsg.toLowerCase().includes("try again"));

          if (isTransient && attempt < retries.length) {
            const waitTime = retries[attempt];
            addLog(`⚠ Instabilidade temporária no Gemini na etapa final: "${errMsg}". Aguardando ${waitTime / 1000}s para retentar (Tentativa ${attempt + 1}/${retries.length})...`);
            setCooldownCountdown(waitTime / 1000);
            await wait(waitTime);
            setCooldownCountdown(0);
            attempt++;
            continue;
          }

          throw new Error(errMsg);
        }

        return await response.json();
      } catch (error: any) {
        const errMessage = error.message || "";
        const isTransientErr = 
          errMessage.includes("429") || 
          errMessage.includes("503") ||
          errMessage.toLowerCase().includes("unavailable") ||
          errMessage.toLowerCase().includes("high demand") ||
          errMessage.toLowerCase().includes("temporary") ||
          errMessage.toLowerCase().includes("rate limit") ||
          errMessage.toLowerCase().includes("overloaded");

        if (attempt < retries.length && isTransientErr) {
          const waitTime = retries[attempt];
          addLog(`⚠ Erro temporário na análise consolidada: "${errMessage}". Esperando ${waitTime / 1000}s para tentar novamente...`);
          setCooldownCountdown(waitTime / 1000);
          await wait(waitTime);
          setCooldownCountdown(0);
          attempt++;
          continue;
        }
        throw error;
      }
    }
  };

  // Main Orchestrator Action
  const handleAnalyze = async () => {
    if (!file) return;

    setAnalyzing(true);
    setErrorMsg(null);
    setLogs([]);

    try {
      // 1. Local PDF Extraction
      setExtracting(true);
      const text = await extractTextFromPdf(file);
      setPdfText(text);
      setExtracting(false);

      if (text.trim().length === 0) {
        throw new Error("Não foi possível extrair nenhum texto legível do PDF. Certifique-se de que o documento não é apenas uma imagem escaneada sem OCR.");
      }

      addLog(`Leitura de texto concluída. Total de caracteres extraídos: ${text.length}`);

      // 2. Chunks splitting
      const chunks = splitTextIntoChunks(text);
      setTotalChunks(chunks.length);
      addLog(`Texto dividido em ${chunks.length} bloco(s) de análise (~${Math.round(MAX_CHARACTER_CHUNK / 4)} tokens por bloco para respeitar limites do plano gratuito).`);

      // 3. Process blocks in Queue with 6s cooldown delay between calls
      const extractions: ChunkExtraction[] = [];

      for (let i = 0; i < chunks.length; i++) {
        setCurrentChunkIndex(i);
        addLog(`[ETAPA 1/3] Iniciando análise do Bloco ${i + 1} de ${chunks.length}...`);

        const extraction = await analyzeChunkWithRetry(chunks[i], i, chunks.length);
        extractions.push(extraction);
        addLog(`✓ Bloco ${i + 1} de ${chunks.length} processado e estruturado.`);

        // Apply a 6-second delay between requests to comply with free tier RPM limits
        if (i < chunks.length - 1) {
          addLog(`Aguardando pausa de ${SECONDS_BETWEEN_CALLS} segundos de conformidade de taxa contábil antes de enviar o próximo bloco...`);
          for (let s = SECONDS_BETWEEN_CALLS; s > 0; s--) {
            setCooldownCountdown(s);
            await wait(1000);
          }
          setCooldownCountdown(0);
        }
      }

      // 4. Consolidation (Etapa 2)
      addLog("[ETAPA 2/3] Agrupando e consolidando balanços patrimoniais e DREs...");
      const consolidated = consolidateExtractions(extractions);

      // 5. Deep Financial Analysis (Etapa 3)
      addLog("[ETAPA 3/3] Enviando estrutura contábil consolidada para análise financeira e auditoria de riscos sênior...");
      
      const finalResult = await analyzeConsolidatedWithRetry(consolidated);
      addLog("✓ Diagnóstico executivo gerado com sucesso pelo Analista Contábil Sênior!");

      // Store in Session Cache (memória da sessão)
      sessionStorage.setItem("analista_contabil_result", JSON.stringify(finalResult));
      sessionStorage.setItem("analista_contabil_source_file_name", file.name);
      
      setAnalysisResult(finalResult);
      setCachedFileName(file.name);
    } catch (error: any) {
      console.error(error);
      setErrorMsg(error.message || "Erro desconhecido no processamento das demonstrações contábeis.");
      addLog(`❌ Erro no processamento: ${error.message}`);
    } finally {
      setAnalyzing(false);
      setCooldownCountdown(0);
    }
  };

  // Dropzone drag handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const selectedFile = files[0];
      if (selectedFile.type === "application/pdf" || selectedFile.name.endsWith(".pdf")) {
        setFile(selectedFile);
        setErrorMsg(null);
      } else {
        setErrorMsg("Por favor, selecione apenas arquivos em formato PDF contendo demonstrações contábeis.");
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      setFile(files[0]);
      setErrorMsg(null);
    }
  };

  // Clear cache/session memory to analyze a new file
  const handleReset = () => {
    sessionStorage.removeItem("analista_contabil_result");
    sessionStorage.removeItem("analista_contabil_source_file_name");
    setAnalysisResult(null);
    setCachedFileName(null);
    setFile(null);
    setErrorMsg(null);
    setLogs([]);
  };

  // If there is an active analysis, show Dashboard
  if (analysisResult) {
    return (
      <div className="min-h-screen bg-slate-50/50">
        {/* Cached Alert Banner */}
        {cachedFileName && (
          <div className="bg-blue-900 text-white px-4 py-2 text-xs font-medium text-center flex items-center justify-center gap-2">
            <span>Análise carregada do cache da sessão contábil do arquivo <strong>{cachedFileName}</strong></span>
            <button 
              onClick={handleReset}
              className="underline hover:text-blue-200 transition font-bold"
            >
              Fazer upload de um novo arquivo
            </button>
          </div>
        )}
        <Dashboard data={analysisResult} onBack={handleReset} />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-12 min-h-screen flex flex-col justify-center">
      {/* Visual Identity Title */}
      <div className="text-center mb-10">
        <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-blue-950 text-white shadow-md mb-4">
          <Building2 className="w-10 h-10" />
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
          Analista Contábil IA
        </h1>
        <p className="mt-3 text-slate-500 text-base max-w-xl mx-auto leading-relaxed">
          Faça o upload do conjunto de demonstrações financeiras (Balanço, DRE, DFC, DMPL e Notas Explicativas) para auditoria automatizada e geração de relatórios de gestão profundos.
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-xl overflow-hidden p-6 sm:p-8">
        {!analyzing ? (
          <div className="space-y-6">
            {/* Drag & Drop Area */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-xl p-8 text-center transition cursor-pointer relative ${
                isDragging 
                  ? "border-blue-900 bg-blue-50/50" 
                  : "border-slate-200 hover:border-slate-400"
              }`}
            >
              <input
                type="file"
                id="pdf-upload"
                accept=".pdf"
                onChange={handleFileChange}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <div className="flex flex-col items-center justify-center gap-3">
                <div className="p-3.5 rounded-full bg-slate-50 text-slate-500">
                  <Upload className="w-8 h-8 text-blue-950" />
                </div>
                {file ? (
                  <div>
                    <span className="text-sm font-bold text-slate-800 block truncate max-w-lg mx-auto">
                      {file.name}
                    </span>
                    <span className="text-xs text-slate-400 font-mono mt-1 block">
                      {(file.size / (1024 * 1024)).toFixed(2)} MB • Clique ou arraste para substituir
                    </span>
                  </div>
                ) : (
                  <div>
                    <span className="text-sm font-bold text-slate-700 block">
                      Arraste seu PDF contábil aqui ou clique para selecionar
                    </span>
                    <span className="text-xs text-slate-400 mt-1 block">
                      Suporta Balanços, DREs, DFCs e Notas Explicativas em formato PDF
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Constraints & Tier Limits Warning */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 flex items-start gap-3">
              <Clock className="w-5 h-5 text-slate-500 shrink-0 mt-0.5" />
              <div className="text-xs text-slate-500 leading-relaxed space-y-1">
                <span className="font-bold text-slate-700">Controles de Limite de Taxa Integrados (Tier Gratuito)</span>
                <p>O aplicativo gerenciará a extração local do texto em blocos de até 40.000 caracteres, pausando por 6 segundos entre as requisições para respeitar o limite de chamadas por minuto (RPM). Retries automáticos com backoff exponencial serão aplicados se necessário.</p>
              </div>
            </div>

            {errorMsg && (
              <div className="p-4 rounded-xl bg-rose-50 border border-rose-100 text-rose-800 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <div className="text-xs font-semibold leading-normal">{errorMsg}</div>
              </div>
            )}

            {/* Action Button */}
            <button
              onClick={handleAnalyze}
              disabled={!file}
              className="w-full flex items-center justify-center gap-2 bg-blue-950 hover:bg-blue-900 active:scale-[0.99] text-white font-semibold py-4 px-6 rounded-xl transition shadow-md disabled:bg-slate-100 disabled:text-slate-400 disabled:pointer-events-none"
            >
              <FileCheck2 className="w-5 h-5" />
              Analisar Demonstrações Contábeis
            </button>
          </div>
        ) : (
          /* Analyzing / Progress View */
          <div className="space-y-6 py-4">
            <div className="flex flex-col items-center justify-center text-center">
              <Loader2 className="w-10 h-10 text-blue-950 animate-spin mb-4" />
              <h3 className="text-lg font-bold text-slate-900">
                {extracting ? "Lendo e extraindo PDF localmente..." : `Processando bloco ${currentChunkIndex + 1} de ${totalChunks}...`}
              </h3>
              <p className="text-xs text-slate-400 mt-1.5 max-w-md mx-auto leading-relaxed">
                Extraindo contas e aplicando modelos de IA para estruturar as demonstrações contábeis. Por favor, mantenha esta janela aberta.
              </p>
            </div>

            {/* Progress Bar */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-semibold text-slate-500 px-1">
                <span>Progresso dos Blocos</span>
                <span>{totalChunks > 0 ? `${Math.round(((currentChunkIndex) / totalChunks) * 100)}%` : "0%"}</span>
              </div>
              <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-blue-950 transition-all duration-500 rounded-full"
                  style={{ width: `${totalChunks > 0 ? ((currentChunkIndex) / totalChunks) * 100 : 0}%` }}
                ></div>
              </div>
            </div>

            {/* Cooldown Timer Alert */}
            {cooldownCountdown > 0 && (
              <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-100/70 text-amber-950 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 text-amber-700 animate-spin" />
                  <span className="text-xs font-semibold">Respeitando limite de requisições por minuto (RPM)</span>
                </div>
                <span className="text-xs font-mono font-bold bg-amber-200/50 px-2.5 py-0.5 rounded-md text-amber-900">
                  Próxima chamada em {cooldownCountdown}s
                </span>
              </div>
            )}

            {/* Detailed Accounting Logs Console */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Console de Auditoria</span>
              <div 
                id="log-viewport"
                className="bg-slate-900 border border-slate-950 rounded-xl p-4 h-48 overflow-y-auto font-mono text-xs text-emerald-400 space-y-1.5 scroll-smooth shadow-inner"
              >
                {logs.map((log, index) => (
                  <div key={index} className="leading-relaxed whitespace-pre-wrap select-all">
                    {log}
                  </div>
                ))}
                {logs.length === 0 && (
                  <div className="text-slate-500 italic">Iniciando console do auditor...</div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Aesthetic Footer */}
      <div className="text-center mt-8 text-xs text-slate-400 flex items-center justify-center gap-1.5">
        <ShieldCheck className="w-4 h-4 text-slate-300" />
        <span>Processamento de dados seguro e local. Suas demonstrações contábeis não são salvas de forma permanente.</span>
      </div>
    </div>
  );
}
