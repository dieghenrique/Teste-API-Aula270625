// Types for the Analista Contábil IA application

export interface ValueByYear {
  ano: string;
  valor: number;
}

export interface AccountingAccount {
  grupo?: string; // Ativo Circulante, Ativo Não Circulante, etc. (for Balanço Patrimonial)
  conta: string; // Account name, e.g. "Caixa e Equivalentes", "Receita Líquida"
  valores: ValueByYear[];
}

export interface ChunkExtraction {
  empresa?: string;
  anos?: string[];
  balanco_patrimonial: AccountingAccount[];
  dre: AccountingAccount[];
  dfc?: AccountingAccount[];
  notas_explicativas?: string[];
}

export interface ConsolidatedData {
  empresa: string;
  anos: string[];
  balanco_patrimonial: AccountingAccount[];
  dre: AccountingAccount[];
  dfc: AccountingAccount[];
  notas_explicativas: string[];
}

export interface ValidationResult {
  ativo_total: number;
  passivo_pl_total: number;
  equacao_bate: boolean;
  diferenca: number;
  observacoes: string;
}

export interface Kpis {
  receita_liquida_atual: number;
  receita_liquida_anterior: number | null;
  lucro_liquido_atual: number;
  lucro_liquido_anterior: number | null;
  ativo_total: number;
  liquidez_corrente: number;
  margem_liquida: number;
  roe: number;
  endividamento: number;
}

export interface RevenueProfitEvolution {
  ano: string;
  receita: number;
  lucro: number;
}

export interface AssetComposition {
  name: string;
  value: number;
}

export interface LiabilityComposition {
  name: string;
  value: number;
}

export interface DreVerticalAnalysis {
  conta: string;
  valor: number;
  percentual: number;
}

export interface MarginsEvolution {
  ano: string;
  margem_bruta: number;
  margem_liquida: number;
  margem_ebitda: number;
}

export interface LiquidityIndices {
  ano: string;
  liquidez_corrente: number;
  liquidez_seca: number;
  liquidez_geral: number;
}

export interface ChartsData {
  receita_lucro_evolucao: RevenueProfitEvolution[];
  composicao_ativo: AssetComposition[];
  composicao_passivo: LiabilityComposition[];
  analise_vertical_dre: DreVerticalAnalysis[];
  evolucao_margens: MarginsEvolution[];
  indicadores_liquidez: LiquidityIndices[];
}

export interface RiskMapItem {
  risco: string;
  categoria: string;
  nivel: 'Critico' | 'Relevante' | 'Moderado' | 'Baixo';
  impacto: string;
  recomendacao: string;
}

export interface ExecutiveReport {
  confirmacao_dados: string;
  resumo_executivo: string;
  analise_horizontal: string;
  analise_vertical: string;
  indicadores_interpretacao: string;
  diagnostico: string;
  conclusao_executiva: string;
  recomendacoes: string[];
}

export interface AnalysisResult {
  empresa: string;
  periodos: string[];
  validacao: ValidationResult;
  kpis: Kpis;
  graficos: ChartsData;
  mapa_riscos: RiskMapItem[];
  relatorio: ExecutiveReport;
}
