/**
 * =============================================================================
 * CONTROLADOR DE INTELIGÊNCIA ARTIFICIAL (LUMI)
 * =============================================================================
 * Responsável por: Chat com IA, análise de imagens (notas fiscais),
 * insights proativos e controle de acesso Pro (Stripe).
 * 
 * Integração: Groq API (Llama 3.3) para processamento de linguagem natural.
 * =============================================================================
 */

const Groq = require('groq-sdk');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const Message = require('../models/Message');
const lumiAnalytics = require('../services/lumiAnalytics');
const dotenv = require('dotenv');

dotenv.config();

let groq = null;
if (process.env.GROQ_API_KEY) {
    groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
} else {
    console.warn('⚠️ AVISO: GROQ_API_KEY não configurada. Recursos de IA estarão indisponíveis.');
}

// ==========================================
// FUNÇÕES AUXILIARES (HELPERS)
// ==========================================

/**
 * Salva uma mensagem no histórico do chat.
 * Usado para dar "memória" à conversa com a Lumi.
 * 
 * @param {string} userId - ID do usuário
 * @param {string} role - 'user' ou 'assistant'
 * @param {string} content - Texto da mensagem
 */
const saveMessage = async (userId, role, content) => {
    try {
        await Message.create({ user_id: userId, role, content: content?.substring(0, 10000) });
        // Limpa mensagens antigas se exceder o limite
        await Message.cleanOldMessages(userId);
    } catch (err) {
        console.error("Erro ao salvar mensagem:", err);
    }
};

/**
 * Recupera as últimas N mensagens do histórico.
 * Usado para manter contexto nas conversas.
 * 
 * @param {string} userId - ID do usuário
 * @param {number} limit - Quantidade de mensagens (padrão: 10)
 * @returns {Array} Array de { role, content }
 */
const getHistory = async (userId, limit = 20) => {
    try {
        const history = await Message.find({ user_id: userId })
            .sort({ timestamp: -1 })
            .limit(Math.min(limit, 50));
        return history.reverse().map(m => ({ role: m.role, content: m.content }));
    } catch (err) {
        console.error("Erro ao buscar histórico:", err);
        return [];
    }
};

/**
 * Busca transações do mês atual para contextualizar a IA.
 * A Lumi precisa saber o que o usuário já gastou para dar advice.
 * 
 * @param {string} userId - ID do usuário
 * @returns {Array} Array de transações formatadas
 */
const getTransactionsFromDB = async (userId) => {
    try {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const start = `${year}-${month}-01`;
        const lastDay = new Date(year, now.getMonth() + 1, 0).getDate();
        const end = `${year}-${month}-${lastDay}`;

        const transactions = await Transaction.find({
            user_id: userId,
            date: { $gte: start, $lte: end }
        }).sort({ date: -1, timestamp: -1 });

        return transactions.map(t => ({
            id: t._id,
            amount: t.amount,
            category: t.category,
            description: t.description,
            payment_method: t.payment_method,
            date: t.date
        }));
    } catch (err) {
        console.error("Erro ao buscar transações:", err);
        return []
    }
};

/**
 * Grava uma transação no banco a partir de dados estruturados.
 * Suporta parcelamento (até 24 parcelas).
 * Valida campos para evitar dados inválidos.
 * 
 * @param {string} userId - ID do usuário
 * @param {Object} data - { amount, date, description, category, payment_method, installments }
 * @returns {string|null} ID da primeira transação criada ou null em caso de erro
 */
const recordTransaction = async (userId, data) => {
    try {
        console.log(`[LUMI DEBUG] Tentando gravar para User: ${userId}`, data);
        
        if (!data || typeof data !== 'object') {
            console.error("[LUMI ERROR] Dados inválidos para transação");
            return null;
        }

        let baseDateStr = data.date;
        if (!baseDateStr || typeof baseDateStr !== 'string' || baseDateStr.includes('[') || !baseDateStr.includes('-')) {
            baseDateStr = new Date().toISOString().split('T')[0];
        }

        // Limita parcelas entre 1 e 24, valor entre 0 e 1 milhão
        const numInstallments = Math.min(Math.max(1, Number(data.installments) || 1), 24);
        const totalAmount = Math.min(Math.max(0, Number(data.amount) || 0), 1000000);
        
        if (totalAmount <= 0) {
            console.log("[LUMI DEBUG] Ignorando transação de valor zero ou negativo");
            return null;
        }

        const installmentAmount = totalAmount / numInstallments;
        const baseDate = new Date(baseDateStr + 'T12:00:00');
        const groupId = numInstallments > 1 ? 'LUMI-' + Date.now().toString(36) + Math.random().toString(36).substring(2, 5) : null;

        let firstId = null;

        for (let i = 0; i < numInstallments; i++) {
            const currentMonthDate = new Date(baseDate);
            currentMonthDate.setMonth(baseDate.getMonth() + i);
            const dateStr = currentMonthDate.toISOString().split('T')[0];

            const descSuffix = numInstallments > 1 ? ` (${i + 1}/${numInstallments})` : '';

            const payload = {
                user_id: userId,
                amount: installmentAmount,
                category: String(data.category || 'Outros').slice(0, 50),
                description: (String(data.description || '').slice(0, 200)) + descSuffix,
                payment_method: String(data.payment_method || 'Cartão de Crédito').slice(0, 50),
                date: dateStr,
                installments: numInstallments,
                installment_index: i + 1,
                group_id: groupId
            };

            const t = new Transaction(payload);
            await t.save();
            if (i === 0) firstId = t._id;
        }

        console.log(`[LUMI SUCCESS] ${numInstallments} parcelas gravadas com sucesso!`);
        return firstId;
    } catch (err) {
        console.error("[LUMI ERROR] Erro fatal na gravação:", err.message);
    }
};

/**
 * Remove uma transação específica via ID.
 * A IA pode pedir para deletar quando identificar um erro.
 * 
 * @param {string} userId - ID do usuário
 * @param {string} id - ID da transação a deletar
 */
const deleteTransactionById = async (userId, id) => {
    try {
        if (!id || typeof id !== 'string' || id.length < 10) {
            console.error("ID inválido para exclusão:", id);
            return;
        }
        
        const transaction = await Transaction.findOne({ _id: id, user_id: userId });
        if (!transaction) {
            console.error(`Transação ${id} não encontrada ou acesso negado para usuário ${userId}`);
            return;
        }
        
        await Transaction.deleteOne({ _id: id, user_id: userId });
        console.log(`[LUMI SUCCESS] Transação ${id} deletada com sucesso!`);
    } catch (err) {
        console.error("Erro ao deletar transação:", err.message);
    }
};

const updateTransactionById = async (userId, id, updates) => {
    try {
        if (!id || typeof id !== 'string' || id.length < 10) {
            console.error("ID inválido para atualização:", id);
            return;
        }

        if (!updates || typeof updates !== 'object') {
            console.error("Updates inválidos:", updates);
            return;
        }

        const allowedFields = ['amount', 'category', 'description', 'payment_method', 'date'];
        const sanitizedUpdates = {};
        
        for (const key of allowedFields) {
            if (updates[key] !== undefined) {
                if (key === 'amount') {
                    const val = Number(updates[key]);
                    if (val > 0 && val <= 1000000) {
                        sanitizedUpdates[key] = val;
                    }
                } else if (key === 'date') {
                    const dateStr = String(updates[key]);
                    if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
                        sanitizedUpdates[key] = dateStr;
                    }
                } else {
                    sanitizedUpdates[key] = String(updates[key]).slice(0, 200);
                }
            }
        }

        if (Object.keys(sanitizedUpdates).length === 0) {
            console.error("Nenhum campo válido para atualizar");
            return;
        }

        const transaction = await Transaction.findOne({ _id: id, user_id: userId });
        if (!transaction) {
            console.error(`Transação ${id} não encontrada ou acesso negado para usuário ${userId}`);
            return;
        }

        await Transaction.updateOne({ _id: id, user_id: userId }, { $set: sanitizedUpdates });
        console.log(`[LUMI SUCCESS] Transação ${id} atualizada com sucesso!`);
    } catch (err) {
        console.error("Erro ao atualizar transação:", err.message);
    }
};

/**
 * Remove TODOS os gastos do usuário de uma vez.
 */
const deleteAllTransactions = async (userId) => {
    try {
        await Transaction.deleteMany({ user_id: userId });
    } catch (err) {
        console.error("Erro ao deletar tudo:", err);
    }
};

// ==========================================
// FUNÇÃO PRINCIPAL: CHAT COM LUMI
// ==========================================

/**
 * Processa mensagem do usuário e retorna resposta da IA.
 * Fluxo:
 * 1. Verifica assinatura (bloqueia não-pros)
 * 2. Coleta contexto (histórico + transações + perfil)
 * 3. Envia para Groq API (Llama 3.3)
 * 4. Executa ações solicitadas pela IA (CRUD transações)
 * 5. Salva resposta no histórico
 * 
 * Tags especiais da IA (executadas silenciosamente):
 * - [[SAVE:{...}]] → Grava transação
 * - [[UPDATE:ID,{...}]] → Atualiza transação
 * - [[DELETE:ID]] → Deleta transação
 * - [[DELETE_ALL]] → Deleta todas as transações
 * - [[UPDATE_PROFILE:{...}]] → Atualiza perfil
 * 
 * @param {Object} req - body: { message }
 * @param {Object} res - { response, transactionAdded }
 */
const analyzeFinances = async (req, res) => {
    const { message } = req.body;
    const userId = req.userId;

    if (!groq) {
        return res.status(503).json({ message: 'Serviço de IA indisponível no momento. Configure a chave da API.' });
    }

    if (!message || typeof message !== 'string' || message.length > 5000) {
        return res.status(400).json({ message: 'Mensagem inválida ou muito longa (máx 5000 caracteres).' });
    }

    try {
        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ message: 'Usuário não encontrado' });

        // ==========================================
        // CONTROLE DE ACESSO (PAYWALL)
        // ==========================================
        // Se não for assinante ('active'), retorna mensagem de upgrade
        // Usuários especiais (helio.vieira, admin) têm acesso livre
        const isCreator = user.username === 'helio.vieira' || user.username === 'admin';
        
        if (user.subscriptionStatus !== 'active' && !isCreator) {
            return res.status(200).json({ 
                response: "Olá! Para continuar analisando suas finanças com a minha inteligência completa, você precisa ser um assinante **Lumi Pro**. 🚀\n\nClique no botão **'Assinar Lumi Pro'** para liberar seu acesso agora por apenas R$ 20,00/mês!",
                transactionAdded: false,
                requireSubscription: true 
            });
        }

        // 1. Salva a pergunta do usuário no banco (para contexto futuro)
        await saveMessage(userId, 'user', message);

        // ==========================================
        // COLETA DE CONTEXTO
        // ==========================================
        
        // Histórico de conversas anteriores
        const history = await getHistory(userId);
        
        // Transações do mês atual
        const transactions = await getTransactionsFromDB(userId);
        
        // Calcula métricas do mês
        const total = transactions.reduce((acc, t) => acc + t.amount, 0);
        const cats = {};
        transactions.forEach(t => cats[t.category] = (cats[t.category] || 0) + t.amount);
        const creditSpent = transactions.filter(t => t.payment_method === 'Cartão de Crédito').reduce((acc, t) => acc + t.amount, 0);
        const creditPct = total > 0 ? (creditSpent / total) * 100 : 0;

        // Lista formatada de transações (para IA editar/deletar)
        const transactionsSummary = transactions.map(t => `- ID: ${t.id} | ${t.date} | ${t.description} | R$ ${t.amount} | ${t.category}`).join('\n            ');

        // Despesas fixas do perfil
        const totalFixed = user.fixedExpenses ? user.fixedExpenses.reduce((acc, e) => acc + e.amount, 0) : 0;

        // ==========================================
        // ANÁLISES AVANÇADAS
        // ==========================================
        
        // Comparativo mês atual vs anterior
        const monthlyComparison = await lumiAnalytics.getMonthlyComparison(userId);
        
        // Previsão de gastos até fim do mês
        const forecast = await lumiAnalytics.getSpendingForecast(userId, user.monthlyBudget || 0);
        
        // Sugestões de onde cortar gastos
        const smartCuts = await lumiAnalytics.getSmartCutSuggestions(userId);
        
        // Alertas reativos baseados na situação atual
        const reactiveAlerts = await lumiAnalytics.checkReactiveAlerts(user, totalFixed);

        // ==========================================
        // MONTA PROMPT PARA IA
        // ==========================================
        
        // Resumo do perfil financeiro
        const profileSummary = `
            Renda Bruta: R$ ${user.grossIncome || 0}
            Renda Líquida: R$ ${user.netIncome || 0}
            Banco: ${user.bankName || 'Não informado'} (Saldo: R$ ${user.bankBalance || 0})
            Cartão: Limite R$ ${user.creditCardLimit || 0} (Usado: R$ ${user.creditCardUsed || 0}, Fatura: R$ ${user.creditCardBill || 0}, Vencimento: Dia ${user.creditCardDueDate || '?'})
            Despesas Fixas Total: R$ ${totalFixed.toFixed(2)}
            Lista de Fixas: ${user.fixedExpenses && user.fixedExpenses.length > 0 ? user.fixedExpenses.map(e => `${e.name}: R$ ${e.amount} (venc. ${e.dueDate})`).join(', ') : 'Nenhuma cadastrada'}
            Orçamento Mensal: R$ ${user.monthlyBudget || 0}
        `;

        const currentDate = new Date().toLocaleDateString('pt-BR');
        
        // Contexto de alertas
        const alertsContext = reactiveAlerts.length > 0 
            ? `\n--- ⚠️ ALERTAS REATIVOS ---\n${reactiveAlerts.map(a => `[${a.type.toUpperCase()}] ${a.title}: ${a.message}`).join('\n')}`
            : '';

        // Contexto de comparativo
        const comparisonContext = monthlyComparison.previous.count > 0
            ? `\n--- 📊 COMPARATIVO MENSAL ---\nMês Anterior: R$ ${monthlyComparison.previous.total.toFixed(2)}\nMês Atual: R$ ${monthlyComparison.current.total.toFixed(2)}\nVariação: ${monthlyComparison.growth > 0 ? '+' : ''}${monthlyComparison.growth.toFixed(1)}%\nAnálise: ${monthlyComparison.analysis.map(a => a.message).join(' | ')}`
            : '';

        // Contexto de previsão
        const forecastContext = forecast.monthlyBudget > 0
            ? `\n--- 🔮 PREVISÃO DO MÊS ---\nMedia Diária: R$ ${forecast.dailyAverage.toFixed(2)}\nProjecção Total: R$ ${forecast.projectedTotal.toFixed(2)}\nOrçamento: R$ ${forecast.monthlyBudget}\nStatus: ${forecast.status} - ${forecast.message}`
            : '';

        // Contexto de sugestões de corte
        const cutsContext = smartCuts.length > 0
            ? `\n--- ✂️ SUGESTÕES DE CORTE ---\n${smartCuts.map(c => `- ${c.category}: R$ ${c.excess.toFixed(2)} acima da média (atual: R$ ${c.currentSpent.toFixed(2)}, média: R$ ${c.monthlyAvg.toFixed(2)})`).join('\n')}`
            : '';

        // Contexto dinâmico completo
        const dynamicContext = `
            Cliente: ${user.username}
            Data Atual: ${currentDate}
            --- PERFIL FINANCEIRO ATUAL ---
            ${profileSummary}
            
            --- GASTOS VARIÁVEIS DO MÊS ---
            Total gasto (Variável): R$ ${total.toFixed(2)}
            Gasto por categoria: ${JSON.stringify(cats)}
            Uso de Cartão de Crédito: ${creditPct.toFixed(0)}% ${creditPct > 60 ? '(ALERTA GATILHO: Chegando na zona vermelha!)' : '(Sob controle)'}
            ${alertsContext}
            ${comparisonContext}
            ${forecastContext}
            ${cutsContext}
            
            --- ÚLTIMAS TRANSAÇÕES PARA EDIÇÃO (God Mode) ---
            ${transactionsSummary || 'Nenhuma transação encontrada.'}
        `;

        const messages = [
            {
                role: "system",
                content: `Você é a **Lumi**, uma Wealth Manager pessoal Premium. Analise dados, diagnostique números e oriente o cliente com precisão.

## REGRAS PRINCIPAIS
- Question gastos supérfluos com elegância
- Onboarding em 4 passos: Renda → Banco → Cartão → Fixas
- Diagnóstico obrigatório: Comprometimento (<50% saudável, 50-75% alerta, >75% crítico)
- Use dados reais do contexto para fundamentar suas recomendações
- Seja direta: não use linguagem vaga

## FERRAMENTAS (silenciosas - nunca mostre o JSON)
1. [[UPDATE_PROFILE:{...}]] - salvar dados do perfil
2. [[SAVE:{...}]] - salvar gastos variáveis
3. [[UPDATE:ID,{...}]] / [[DELETE:ID]] - editar/deletar transações
4. Google Calendar: gere links para despesas fixes

## CONTEXTO DO CLIENTE:
${dynamicContext}`
            },
            ...history.map(msg => ({ role: msg.role, content: msg.content })),
        ];

        const completion = await groq.chat.completions.create({
            messages: messages,
            model: "llama-3.3-70b-versatile",
        });

        let aiResponse = completion.choices[0].message.content;
        console.log(`[LUMI RAW] Resposta da IA:`, aiResponse);
        let dataChanged = false;

        if (aiResponse.includes("[[DELETE_ALL]]")) {
            await deleteAllTransactions(userId);
            dataChanged = true;
            aiResponse = aiResponse.replace("[[DELETE_ALL]]", "").trim();
        }

        const deleteMatches = aiResponse.matchAll(/\[\[DELETE:(.*?)\]\]/g);
        for (const match of deleteMatches) {
            const idToDelete = match[1].trim();
            if (idToDelete) {
                await deleteTransactionById(userId, idToDelete);
                dataChanged = true;
            }
        }
        aiResponse = aiResponse.replace(/\[\[DELETE:.*?\]\]/g, "").trim();

        const updateMatches = aiResponse.matchAll(/\[\[UPDATE:\s*(.*?)\s*,\s*(\{.*?\})\s*\]\]/g);
        for (const match of updateMatches) {
            try {
                const idToUpdate = match[1].trim();
                const updates = JSON.parse(match[2]);
                if (idToUpdate) {
                    await updateTransactionById(userId, idToUpdate, updates);
                    dataChanged = true;
                }
            } catch (e) {
                console.error("Erro ao fazer update via IA:", e.message);
            }
        }
        aiResponse = aiResponse.replace(/\[\[UPDATE:.*?\]\]/g, "").trim();

        const saveMatches = aiResponse.matchAll(/\[\[SAVE:(.*?)\]\]/g);
        for (const match of saveMatches) {
            try {
                const transactionData = JSON.parse(match[1]);
                
                // BUG FIX: Evita salvar transações com valor zero (saudações e lixo)
                if (Number(transactionData.amount) > 0) {
                    await recordTransaction(userId, transactionData);
                    dataChanged = true;
                } else {
                    console.log("[LUMI DEBUG] Ignorando transação de valor zero:", transactionData.description);
                }
            } catch (e) {
                console.error("Erro ao salvar via IA:", e.message);
            }
        }
        aiResponse = aiResponse.replace(/\[\[SAVE:.*?\]\]/g, "").trim();

        // NOVA TAG: UPDATE_PROFILE
        const profileMatches = aiResponse.matchAll(/\[\[UPDATE_PROFILE:(.*?)\]\]/g);
        for (const match of profileMatches) {
            try {
                const profileDataRaw = JSON.parse(match[1]);
                
                if (!profileDataRaw || typeof profileDataRaw !== 'object') {
                    console.error("[LUMI ERROR] Dados de perfil inválidos");
                    continue;
                }

                const allowedProfileFields = ['grossIncome', 'netIncome', 'bankName', 'bankBalance', 'creditCardLimit', 'creditCardUsed', 'creditCardBill', 'creditCardDueDate', 'fixedExpenses', 'monthlyBudget', 'savingsGoal', 'savingsCurrent'];
                const sanitizedProfileData = {};
                
                for (const key of allowedProfileFields) {
                    if (profileDataRaw[key] !== undefined) {
                        if (['grossIncome', 'netIncome', 'bankBalance', 'creditCardLimit', 'creditCardUsed', 'creditCardBill', 'monthlyBudget', 'savingsGoal', 'savingsCurrent'].includes(key)) {
                            const numVal = Number(profileDataRaw[key]);
                            if (key === 'netIncome' && sanitizedProfileData.grossIncome !== undefined && numVal > sanitizedProfileData.grossIncome) {
                                console.warn("[LUMI WARN] netIncome maior que grossIncome, ajustando para igual");
                                sanitizedProfileData[key] = sanitizedProfileData.grossIncome;
                            } else if (numVal >= 0 && numVal <= 10000000) {
                                sanitizedProfileData[key] = numVal;
                            }
                        } else if (key === 'creditCardDueDate') {
                            const dueDate = Math.max(1, Math.min(31, Number(profileDataRaw[key]) || 0));
                            if (dueDate > 0) sanitizedProfileData[key] = dueDate;
                        } else if (key === 'bankName') {
                            sanitizedProfileData[key] = String(profileDataRaw[key]).slice(0, 100);
                        } else if (key === 'fixedExpenses' && Array.isArray(profileDataRaw[key])) {
                            sanitizedProfileData[key] = profileDataRaw[key].filter(e => e && e.name && e.amount > 0).map(e => ({
                                name: String(e.name).slice(0, 100),
                                amount: Math.max(0, Number(e.amount) || 0),
                                dueDate: Math.max(1, Math.min(31, Number(e.dueDate) || 1))
                            }));
                        }
                    }
                }

                if (Object.keys(sanitizedProfileData).length > 0) {
                    await User.findByIdAndUpdate(userId, { $set: sanitizedProfileData });
                    console.log(`[LUMI SUCCESS] Perfil do usuário ${userId} atualizado!`);
                    dataChanged = true;
                }
            } catch (e) {
                console.error("Erro ao atualizar perfil via IA:", e.message);
            }
        }
        aiResponse = aiResponse.replace(/\[\[UPDATE_PROFILE:.*?\]\]/g, "").trim();

        await saveMessage(userId, 'assistant', aiResponse);

        res.status(200).json({ 
            response: aiResponse,
            transactionAdded: dataChanged 
        });

    } catch (error) {
        console.error('Groq AI Error:', error);
        res.status(500).json({ message: 'Erro ao processar sua solicitação na IA' });
    }
};

/**
 * Gera um insight proativo automático baseado no histórico recente do usuário.
 */
// ==========================================
// ROTAS DE AI
// ==========================================

/**
 * analisaFinances - Função principal do chat com Lumi.
 * Ver arquivo completo acima para detalhes.
 * tags especiais: [[SAVE:{}]], [[UPDATE:ID,{}]], [[DELETE:ID]], [[DELETE_ALL]], [[UPDATE_PROFILE:{}]]
 */

/**
 * Gera insight proativo automático (mensagem de boas-vindas).
 * Usado na tela inicial do dashboard.
 * 
 * @param {Object} req - userId do middleware
 * @param {Object} res - { insight: string }
 */
const getProactiveInsight = async (req, res) => {
    const userId = req.userId;
    try {
        const transactions = await Transaction.find({ user_id: userId }).sort({ date: -1 }).limit(30);
        const user = await User.findById(userId);

        if (!user.netIncome || user.netIncome === 0) {
            return res.json({ insight: `Olá ${user.username}! Eu sou a Lumi, sua Wealth Manager pessoal. Para começarmos sua jornada de lucros e controle, preciso que façamos seu onboarding financeiro. Qual é a sua renda bruta e líquida mensal?` });
        }

        if (transactions.length === 0) {
            return res.json({ insight: `Olá ${user.username}! Já preparei seu perfil. Quando você começar a registrar seus gastos variáveis, poderei te dar um diagnóstico completo em tempo real. Que tal anotar sua primeira compra hoje? 😊` });
        }

        const summary = transactions.map(t => `${t.date}: ${t.description} (R$ ${t.amount}) [${t.category}]`).join('\n');
        const currentDate = new Date().toLocaleDateString('pt-BR');

        const completion = await groq.chat.completions.create({
            messages: [
                {
                    role: "system",
                    content: `Você é a **Lumi**, uma Wealth Manager e Concierge Financeira pessoal de alto padrão.
A data de hoje é: ${currentDate}.
Sua tarefa é dar as boas-vindas ao usuário e fornecer UM insight inteligente, refinado e proativo (máx 2 frases) baseado nos gastos recentes e na data.
- **Concierge Premium**: Use linguagem requintada, elegante, chamando o cliente pelo nome.
- **Educadora afiada / Proatividade**: Se for fim de mês, alerte sobre segurar gastos. Se o gasto em utilidades ou iFood for alto, comande de forma sutil. Se os gastos estiverem baixos, comemore o sucesso.
- **NUNCA** mencione dados técnicos, nem JSON ou o formato dos dados.`
                },
                {
                    role: "user",
                    content: `Usuário: ${user.username}\n\nHistórico Recente:\n${summary}`
                }
            ],
            model: "llama-3.8b-8192", // Modelo mais rápido para insights iniciais
        });

        const insight = completion.choices[0].message.content;
        res.json({ insight });
    } catch (err) {
        console.error("Erro ao gerar insight proativo:", err);
        res.status(500).json({ message: "Erro ao gerar insight" });
    }
};

/**
 * Analisa imagem de nota fiscal/recibo e extrai dados para criar transação.
 * Usa visão computacional do Llama 3.2 90B Vision.
 * 
 * @param {Object} req - body: { image: URL/base64 }
 * @param {Object} res - { success, message, data }
 */
const analyzeImage = async (req, res) => {
    const { image } = req.body;
    const userId = req.userId;

    if (!image) {
        return res.status(400).json({ message: 'Imagem não fornecida' });
    }

    try {
        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ message: 'Usuário não encontrado' });

        const isCreator = user.username === 'helio.vieira' || user.username === 'admin';
        if (user.subscriptionStatus !== 'active' && !isCreator) {
            return res.status(403).json({ message: 'Recurso exclusivo para assinantes Lumi Pro' });
        }

        const completion = await groq.chat.completions.create({
            messages: [
                {
                    role: "system",
                    content: `Você é a **Lumi**, assistente financeira. Analise a imagem de nota fiscal/recibo e extraia os dados em formato JSON válido. 
Retorne APENAS o JSON sem texto adicional.
Campos: description (estabelecimento), amount (valor numérico), category (categoria), date (YYYY-MM-DD ou hoje).`
                },
                {
                    role: "user",
                    content: [
                        { type: "image_url", image_url: { url: image } }
                    ]
                }
            ],
            model: "llama-3.2-90b-vision-preview",
        });

        const response = completion.choices[0].message.content;
        
        let data;
        try {
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                data = JSON.parse(jsonMatch[0]);
            } else {
                return res.status(400).json({ message: 'Não consegui extrair dados da imagem' });
            }
        } catch (e) {
            console.error('Parse error:', e, response);
            return res.status(400).json({ message: 'Formato de resposta inválido' });
        }

        if (!data || !data.amount || data.amount <= 0) {
            return res.status(400).json({ message: 'Não consegui identificar o valor na nota' });
        }

        data.date = data.date || new Date().toISOString().split('T')[0];
        data.payment_method = 'Cartão de Crédito';
        
        await recordTransaction(userId, data);
        
        res.json({ 
            success: true, 
            message: `Transação registrada: ${data.description} - R$ ${data.amount}`,
            data 
        });

    } catch (err) {
        console.error('Erro ao analisar imagem:', err);
        res.status(500).json({ message: 'Erro ao processar imagem' });
    }
};

module.exports = { analyzeFinances, getProactiveInsight, analyzeImage };
