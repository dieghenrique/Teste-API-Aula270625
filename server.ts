import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

// Enable JSON bodies with higher limits for large text chunks
app.use(express.json({ limit: "50mb" }));

// Initialize Gemini Client
const apiKey = process.env.GEMINI_API_KEY;
let ai: GoogleGenAI | null = null;

if (apiKey) {
  ai = new GoogleGenAI({
    apiKey: apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });
}

// API Routes

// Helper to check for API Key
const checkApiKey = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (!process.env.GEMINI_API_KEY || !ai) {
    return res.status(500).json({
      error: "API Key não configurada",
      message: "A chave GEMINI_API_KEY não foi encontrada nas variáveis de ambiente do servidor. Por favor, adicione-a nas configurações de segredos do AI Studio para que o analista possa funcionar."
    });
  }
  next();
};

// Endpoint 1: Analyze and extract data from a specific chunk
app.post("/api/analyze-chunk", checkApiKey, async (req, res) => {
  try {
    const { chunkText, chunkIndex, totalChunks } = req.body;

    if (!chunkText) {
      return res.status(400).json({ error: "O texto do bloco é obrigatório." });
    }

    const systemInstruction = `Você é um Assistente Contábil de alta precisão. Seu papel é analisar o trecho fornecido de demonstrações financeiras e extrair TODAS as informações de contas contábeis e seus respectivos valores para os anos identificados.
Sua extração deve ser fiel aos dados reais. Nunca invente ou assuma números que não estão no texto. Se uma conta não tiver valor para um determinado ano, deixe-a de fora ou coloque null.

Extraia as informações organizando-as em:
1. Empresa (nome identificado)
2. Anos identificados (geralmente dois ou três anos, por exemplo "2024", "2025")
3. Balanço Patrimonial (contas do Ativo Circulante, Ativo Não Circulante, Passivo Circulante, Passivo Não Circulante e Patrimônio Líquido com seus respectivos valores por ano)
4. DRE (Receita Bruta, Deduções, Receita Líquida, Custo de Vendas, Lucro Bruto, Despesas Operacionais, EBITDA, Lucro Operacional/EBIT, Despesas Financeiras, Receitas Financeiras, Impostos, Lucro Líquido, etc.)
5. DFC (Atividades Operacionais, de Investimento, de Financiamento, Variação do Caixa)
6. Notas Explicativas relevantes (resumos curtos sobre contingências, estimativas, ou eventos que impactem as análises)

Retorne EXCLUSIVAMENTE um JSON estruturado seguindo o esquema fornecido.`;

    const prompt = `Analise o Bloco ${chunkIndex + 1} de ${totalChunks} do relatório financeiro. Extraia os dados numéricos e textuais contidos nele:
--- TRECHO DO DOCUMENTO ---
${chunkText}
---------------------------`;

    const response = await ai!.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            empresa: { type: Type.STRING, description: "Nome da empresa se identificado no trecho, senão vazio." },
            anos: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Lista de anos identificados (ex: ['2024', '2025'])"
            },
            balanco_patrimonial: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  grupo: { type: Type.STRING, description: "Ativo Circulante, Ativo Nao Circulante, Passivo Circulante, Passivo Nao Circulante ou Patrimonio Liquido" },
                  conta: { type: Type.STRING, description: "Nome exato da conta contábil (ex: Caixa e Equivalentes, Estoques, Fornecedores, Capital Social)" },
                  valores: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        ano: { type: Type.STRING },
                        valor: { type: Type.NUMBER, description: "Valor numérico real da conta." }
                      },
                      required: ["ano", "valor"]
                    }
                  }
                },
                required: ["grupo", "conta", "valores"]
              }
            },
            dre: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  conta: { type: Type.STRING, description: "Nome da conta de resultado (ex: Receita Liquida, Custo, Lucro Bruto, Lucro Liquido)" },
                  valores: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        ano: { type: Type.STRING },
                        valor: { type: Type.NUMBER }
                      },
                      required: ["ano", "valor"]
                    }
                  }
                },
                required: ["conta", "valores"]
              }
            },
            dfc: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  conta: { type: Type.STRING, description: "Conta ou atividade da DFC (ex: Caixa das Atividades Operacionais, Variacao)" },
                  valores: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        ano: { type: Type.STRING },
                        valor: { type: Type.NUMBER }
                      },
                      required: ["ano", "valor"]
                    }
                  }
                },
                required: ["conta", "valores"]
              }
            },
            notas_explicativas: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Breves anotações de dados ou informações relevantes contidas nas notas explicativas deste bloco."
            }
          },
          required: ["balanco_patrimonial", "dre"]
        }
      }
    });

    const resultText = response.text;
    res.json(JSON.parse(resultText || "{}"));
  } catch (error: any) {
    console.error("Erro ao analisar bloco:", error);
    res.status(500).json({ error: "Erro na API do Gemini ao extrair dados", message: error.message });
  }
});

// Endpoint 2: Conduct deep analysis from consolidated JSON data
app.post("/api/analyze-consolidated", checkApiKey, async (req, res) => {
  try {
    const { consolidatedData } = req.body;

    if (!consolidatedData) {
      return res.status(400).json({ error: "Os dados consolidados são obrigatórios." });
    }

    // This prompt contains the exact instructions as the required system prompt (Bloco C type instructions).
    const systemInstruction = `Você é um Analista Contábil Sênior e Auditor de Alta Performance.
Seu papel é receber uma estrutura de dados contábeis em JSON (consolidada de Balanço Patrimonial, DRE, DFC) e gerar um diagnóstico contábil e financeiro profundo, completo e rigoroso, em português do Brasil.

INSTRUÇÕES RIGOROSAS:
1. VALIDAÇÃO DA EQUAÇÃO:
   - Verifique sempre se Ativo = Passivo + Patrimônio Líquido para todos os anos.
   - Caso haja divergências, você DEVE apontar o valor exato da diferença no campo de validação e discorrer sobre isso na confirmação dos dados do relatório.
   - Não oculte ou invente números para que as equações fechem. A honestidade contábil é primordial.

2. CÁLCULO E FUNDAMENTAÇÃO DE INDICADORES:
   - Todos os indicadores financeiros gerados devem ter evidência matemática direta baseada nas contas contábeis fornecidas.
   - Calcule e retorne os seguintes indicadores (para cada período disponível):
     * Liquidez Corrente = Ativo Circulante / Passivo Circulante
     * Margem Líquida = Lucro Líquido / Receita Líquida (em %)
     * ROE = Lucro Líquido / Patrimônio Líquido (em %)
     * Endividamento Geral = (Passivo Circulante + Passivo Não Circulante) / Ativo Total (em %)
     * Margem Bruta = Lucro Bruto / Receita Líquida (em %)
   - Forneça explicações extremamente claras e objetivas no relatório.

3. MAPA DE RISCO:
   - Identifique os principais gargalos e vulnerabilidades (ex: alto endividamento, liquidez sob pressão, queima de caixa, descompasso vertical na DRE, margens em queda).
   - Classifique cada risco nos níveis: "Critico" (vermelho), "Relevante" (laranja), "Moderado" (amarelo) ou "Baixo" (verde).
   - Justifique cada classificação com base em dados numéricos e apresente recomendações acionáveis.

4. SEÇÕES DO RELATÓRIO EXECUTIVO (retorne strings ricas formatadas em Markdown em cada campo de texto do JSON):
   - Confirmação dos dados: Faça uma abertura atestando a integridade dos dados extraídos, validando os totais do Ativo, Passivo e PL e indicando se a equação contábil bateu. Cite a empresa analisada e os anos.
   - Resumo executivo: Uma visão de helicóptero para o gestor. O que aconteceu com a empresa nos períodos analisados? Houve crescimento ou contração?
   - Análise horizontal: Explique a evolução temporal das contas do Balanço e da DRE (ex: aumento de receitas, despesas crescendo acima da receita, redução do endividamento).
   - Análise vertical: Analise a estrutura do Balanço e da DRE (ex: participação de estoques no ativo, peso do custo das vendas na receita, margem de contribuição).
   - Indicadores & Interpretação: Interprete de forma aprofundada os indicadores contábeis calculados. O que a liquidez corrente de 1.5 significa para o curto prazo? O ROE de 25% é atraente?
   - Diagnóstico e Sinais de Alerta: Destaque as principais fraquezas, inconsistências ou sinais de alerta contábeis encontrados.
   - Conclusão executiva: Um fechamento sintetizado indicando a saúde financeira geral da organização.
   - Recomendações: Uma lista detalhada e prática de ações corretivas ou estratégicas que a gestão deve tomar.

5. ESTRUTURA DOS GRÁFICOS:
   - Produza conjuntos de dados prontos para os gráficos do Recharts:
     * receita_lucro_evolucao: array de objetos { ano, receita, lucro }
     * composicao_ativo: array de objetos { name, value } representando as parcelas do Ativo (ex: Ativo Circulante, Ativo Não Circulante)
     * composicao_passivo: array de objetos { name, value } representando Passivo Circulante, Passivo Não Circulante e PL
     * analise_vertical_dre: contas principais da DRE e sua representatividade percentual sobre a Receita Líquida (100%)
     * evolucao_margens: evolução temporal das margens { ano, margem_bruta, margem_liquida, margem_ebitda }
     * indicadores_liquidez: evolução dos indicadores { ano, liquidez_corrente, liquidez_seca, liquidez_geral }

Retorne as informações EXCLUSIVAMENTE em formato JSON estruturado que siga estritamente o esquema fornecido.`;

    const prompt = `Aqui estão os dados contábeis extraídos e consolidados das demonstrações financeiras. Realize o diagnóstico completo:
--- DADOS EXTRAÍDOS CONSOLIDADOS ---
${JSON.stringify(consolidatedData, null, 2)}
------------------------------------`;

    const response = await ai!.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            empresa: { type: Type.STRING, description: "Nome oficial da empresa identificado" },
            periodos: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Anos analisados na ordem cronológica."
            },
            validacao: {
              type: Type.OBJECT,
              properties: {
                ativo_total: { type: Type.NUMBER, description: "Ativo total mais recente" },
                passivo_pl_total: { type: Type.NUMBER, description: "Soma do Passivo Total + PL mais recente" },
                equacao_bate: { type: Type.BOOLEAN, description: "Se Ativo = Passivo + PL (tolerância de R$ 10,00)" },
                diferenca: { type: Type.NUMBER, description: "Valor absoluto da diferença, se houver" },
                observacoes: { type: Type.STRING, description: "Breve texto informando a integridade da equação contábil." }
              },
              required: ["ativo_total", "passivo_pl_total", "equacao_bate", "diferenca", "observacoes"]
            },
            kpis: {
              type: Type.OBJECT,
              properties: {
                receita_liquida_atual: { type: Type.NUMBER, description: "Receita Líquida do ano mais recente" },
                receita_liquida_anterior: { type: Type.NUMBER, description: "Receita Líquida do ano anterior (se houver, senão null)" },
                lucro_liquido_atual: { type: Type.NUMBER, description: "Lucro Líquido do ano mais recente" },
                lucro_liquido_anterior: { type: Type.NUMBER, description: "Lucro Líquido do ano anterior (se houver, senão null)" },
                ativo_total: { type: Type.NUMBER, description: "Ativo Total do ano mais recente" },
                liquidez_corrente: { type: Type.NUMBER, description: "Liquidez corrente calculada do ano mais recente" },
                margem_liquida: { type: Type.NUMBER, description: "Margem Líquida em % do ano mais recente" },
                roe: { type: Type.NUMBER, description: "Retorno sobre o PL em % do ano mais recente" },
                endividamento: { type: Type.NUMBER, description: "Endividamento geral em % do ano mais recente" }
              },
              required: ["receita_liquida_atual", "lucro_liquido_atual", "ativo_total", "liquidez_corrente", "margem_liquida", "roe", "endividamento"]
            },
            graficos: {
              type: Type.OBJECT,
              properties: {
                receita_lucro_evolucao: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      ano: { type: Type.STRING },
                      receita: { type: Type.NUMBER },
                      lucro: { type: Type.NUMBER }
                    },
                    required: ["ano", "receita", "lucro"]
                  }
                },
                composicao_ativo: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      name: { type: Type.STRING },
                      value: { type: Type.NUMBER }
                    },
                    required: ["name", "value"]
                  }
                },
                composicao_passivo: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      name: { type: Type.STRING },
                      value: { type: Type.NUMBER }
                    },
                    required: ["name", "value"]
                  }
                },
                analise_vertical_dre: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      conta: { type: Type.STRING },
                      valor: { type: Type.NUMBER },
                      percentual: { type: Type.NUMBER }
                    },
                    required: ["conta", "valor", "percentual"]
                  }
                },
                evolucao_margens: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      ano: { type: Type.STRING },
                      margem_bruta: { type: Type.NUMBER },
                      margem_liquida: { type: Type.NUMBER },
                      margem_ebitda: { type: Type.NUMBER }
                    },
                    required: ["ano", "margem_bruta", "margem_liquida", "margem_ebitda"]
                  }
                },
                indicadores_liquidez: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      ano: { type: Type.STRING },
                      liquidez_corrente: { type: Type.NUMBER },
                      liquidez_seca: { type: Type.NUMBER },
                      liquidez_geral: { type: Type.NUMBER }
                    },
                    required: ["ano", "liquidez_corrente", "liquidez_seca", "liquidez_geral"]
                  }
                }
              },
              required: ["receita_lucro_evolucao", "composicao_ativo", "composicao_passivo", "analise_vertical_dre", "evolucao_margens", "indicadores_liquidez"]
            },
            mapa_riscos: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  risco: { type: Type.STRING },
                  categoria: { type: Type.STRING, description: "Ex: Liquidez, Rentabilidade, Operacional, Endividamento" },
                  nivel: { type: Type.STRING, description: "Critico, Relevante, Moderado ou Baixo" },
                  impacto: { type: Type.STRING },
                  recomendacao: { type: Type.STRING }
                },
                required: ["risco", "categoria", "nivel", "impacto", "recomendacao"]
              }
            },
            relatorio: {
              type: Type.OBJECT,
              properties: {
                confirmacao_dados: { type: Type.STRING, description: "Relatório de integridade e conferência dos dados em formato Markdown" },
                resumo_executivo: { type: Type.STRING, description: "Resumo executivo de alto nível para os gestores em formato Markdown" },
                analise_horizontal: { type: Type.STRING, description: "Análise horizontal de tendências em formato Markdown" },
                analise_vertical: { type: Type.STRING, description: "Análise vertical de estruturas em formato Markdown" },
                indicadores_interpretacao: { type: Type.STRING, description: "Interpretação e leitura dos índices em formato Markdown" },
                diagnostico: { type: Type.STRING, description: "Diagnóstico profundo de pontos fortes e fraquezas em formato Markdown" },
                conclusao_executiva: { type: Type.STRING, description: "Conclusão executiva final da saúde financeira em formato Markdown" },
                recomendacoes: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: "Lista de recomendações acionáveis práticas"
                }
              },
              required: ["confirmacao_dados", "resumo_executivo", "analise_horizontal", "analise_vertical", "indicadores_interpretacao", "diagnostico", "conclusao_executiva", "recomendacoes"]
            }
          },
          required: ["empresa", "periodos", "validacao", "kpis", "graficos", "mapa_riscos", "relatorio"]
        }
      }
    });

    res.json(JSON.parse(response.text || "{}"));
  } catch (error: any) {
    console.error("Erro ao analisar relatório consolidado:", error);
    res.status(500).json({ error: "Erro na API do Gemini ao gerar análise profunda", message: error.message });
  }
});

// Configure Vite middleware for development
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
