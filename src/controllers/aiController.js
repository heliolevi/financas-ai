const Groq = require('groq-sdk');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const Message = require('../models/Message');
const dotenv = require('dotenv');

dotenv.config();

const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY
});

// --- FUNÇÕES AUXILIARES (HELPERS) ---

/**
 * Salva uma mensagem no histórico para que a Lumi tenha "memória".
 */
const saveMessage = async (userId, role, content) => {
    try {
        await Message.create({ user_id: userId, role, content });
    } catch (err) {
        console.error("Erro ao salvar mensagem:", err);
    }
};

/**
 * Recupera as últimas conversas para dar contexto à IA.
 */
const getHistory = async (userId, limit = 10) => {
    try {
        const history = await Message.find({ user_id: userId })
            .sort({ timestamp: -1 })
            .limit(limit);
        return history.reverse().map(m => ({ role: m.role, content: m.content }));
    } catch (err) {
        console.error("Erro ao buscar histórico:", err);
        return [];
    }
};

/**
 * Busca transações recentes para que a Lumi saiba o que o usuário já gastou.
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
        return [];
    }
};

const recordTransaction = async (userId, data) => {
    try {
        console.log(`[LUMI DEBUG] Tentando gravar para User: ${userId}`, data);
        
        // Normalização de Data
        let baseDateStr = data.date;
        if (!baseDateStr || typeof baseDateStr !== 'string' || baseDateStr.includes('[') || !baseDateStr.includes('-')) {
            baseDateStr = new Date().toISOString().split('T')[0];
        }

        const numInstallments = Number(data.installments) || 1;
        const totalAmount = Number(data.amount) || 0;
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
                category: data.category || 'Outros',
                description: (data.description || '') + descSuffix,
                payment_method: data.payment_method || 'Cartão de Crédito',
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
 * Remove um gasto identificado pela IA via ID.
 */
const deleteTransactionById = async (userId, id) => {
    try {
        await Transaction.deleteOne({ _id: id, user_id: userId });
        console.log(`[LUMI SUCCESS] Transação ${id} deletada com sucesso!`);
    } catch (err) {
        console.error("Erro ao deletar transação:", err);
    }
};

/**
 * Atualiza um gasto identificado pela IA via ID com novos dados.
 */
const updateTransactionById = async (userId, id, updates) => {
    try {
        await Transaction.updateOne({ _id: id, user_id: userId }, { $set: updates });
        console.log(`[LUMI SUCCESS] Transação ${id} atualizada com sucesso!`);
    } catch (err) {
        console.error("Erro ao atualizar transação:", err);
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

// --- FUNÇÃO PRINCIPAL ---

const analyzeFinances = async (req, res) => {
    const { message } = req.body;
    const userId = req.userId;

    try {
        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ message: 'Usuário não encontrado' });

        // BLOQUEIO: Se o usuário não for pagante ('active'), a Lumi não responde lógica financeira profunda
        // BYPASS PARA O CRIADOR (Hélio)
        const isCreator = user.username === 'helio.vieira' || user.username === 'admin';
        
        if (user.subscriptionStatus !== 'active' && !isCreator) {
            return res.status(200).json({ 
                response: "Olá! Para continuar analisando suas finanças com a minha inteligência completa, você precisa ser um assinante **Lumi Pro**. 🚀\n\nClique no botão **'Assinar Lumi Pro'** para liberar seu acesso agora por apenas R$ 20,00/mês!",
                transactionAdded: false,
                requireSubscription: true 
            });
        }

        // 1. Salva a pergunta do usuário no banco
        await saveMessage(userId, 'user', message);

        // 2. ColetaContexto: Memória e Transações
        const history = await getHistory(userId);
        const transactions = await getTransactionsFromDB(userId);
        
        const total = transactions.reduce((acc, t) => acc + t.amount, 0);
        const cats = {};
        transactions.forEach(t => cats[t.category] = (cats[t.category] || 0) + t.amount);
        const creditSpent = transactions.filter(t => t.payment_method === 'Cartão de Crédito').reduce((acc, t) => acc + t.amount, 0);
        const creditPct = total > 0 ? (creditSpent / total) * 100 : 0;

        const transactionsSummary = transactions.map(t => `- ID: ${t.id} | ${t.date} | ${t.description} | R$ ${t.amount} | ${t.category}`).join('\n            ');

        const totalFixed = user.fixedExpenses ? user.fixedExpenses.reduce((acc, e) => acc + e.amount, 0) : 0;
        const profileSummary = `
            Renda Bruta: R$ ${user.grossIncome || 0}
            Renda Líquida: R$ ${user.netIncome || 0}
            Banco: ${user.bankName || 'Não informado'} (Saldo: R$ ${user.bankBalance || 0})
            Cartão: Limite R$ ${user.creditCardLimit || 0} (Usado: R$ ${user.creditCardUsed || 0}, Fatura: R$ ${user.creditCardBill || 0}, Vencimento: Dia ${user.creditCardDueDate || '?'})
            Despesas Fixas Total: R$ ${totalFixed.toFixed(2)}
            Lista de Fixas: ${user.fixedExpenses && user.fixedExpenses.length > 0 ? user.fixedExpenses.map(e => `${e.name}: R$ ${e.amount} (venc. ${e.dueDate})`).join(', ') : 'Nenhuma cadastrada'}
        `;

        const currentDate = new Date().toLocaleDateString('pt-BR');
        const dynamicContext = `
            Cliente: ${user.username}
            Data Atual: ${currentDate}
            --- PERFIL FINANCEIRO ATUAL ---
            ${profileSummary}
            
            --- GASTOS VARIÁVEIS DO MÊS ---
            Total gasto (Variável): R$ ${total.toFixed(2)}
            Gasto por categoria: ${JSON.stringify(cats)}
            Uso de Cartão de Crédito: ${creditPct.toFixed(0)}% ${creditPct > 60 ? '(ALERTA GATILHO: Chegando na zona vermelha!)' : '(Sob controle)'}
            
            --- ÚLTIMAS TRANSAÇÕES PARA EDIÇÃO (God Mode) ---
            ${transactionsSummary || 'Nenhuma transação encontrada.'}
        `;

        const messages = [
            {
                role: "system",
                content: `Você é a **Lumi**, uma Wealth Manager Analítica e Concierge Financeira pessoal de alto padrão. Seu objetivo é coletar dados, realizar diagnósticos matemáticos e guiar a saúde financeira do cliente com autoridade e precisão.

### DIRETRIZES DE COMPORTAMENTO
1. **Ativa e Analítica**: Não seja uma mera secretária. Analise dados, questione o usuário e dê diagnósticos claros usando números e porcentagens.
2. **Onboarding Financeiro**: Se o perfil do cliente estiver incompleto (rendas zeradas ou sem gastos fixos), conduza a entrevista na ordem:
   - Passo 1: Renda Bruta e Líquida. (Validação: Líquida NUNCA > Bruta).
   - Passo 2: Nome do Banco e Saldo Atual.
   - Passo 3: Cartão de Crédito (Limite Total, Usado, Fatura e Vencimento).
   - Passo 4: Listagem de Despesas Fixas (Nome, Valor, Vencimento).
3. **Diagnóstico Matemático (OBRIGATÓRIO)**:
   - **Comprometimento de Renda**: (Total Despesas Fixas / Renda Líquida) * 100. [Saudável: <50% | Alerta: 50-75% | Crítico: >75%].
   - **Uso do Cartão**: (Limite Utilizado / Limite Total) * 100. [Ideal: <30% | Moderado: 30-70% | Perigoso: >70%].
4. **Respostas Diretas**: Nunca use linguagem vaga. Se houver risco, aponte-o explicitamente ("Sua situação é Crítica pois 80% da sua renda está comprometida").

### FERRAMENTAS E TAGS (SILENCIOSAS - NUNCA MOSTRE O JSON)
1. **[[UPDATE_PROFILE:{...}]]**: Use para salvar dados do perfil. Campos: grossIncome, netIncome, bankName, bankBalance, creditCardLimit, creditCardUsed, creditCardBill, creditCardDueDate, fixedExpenses (array de {name, amount, dueDate}).
2. **[[SAVE:{...}]]**: Para novos gastos VARIÁVEIS.
3. **[[UPDATE:ID, {...}]]** / **[[DELETE:ID]]**: Edição de gastos variáveis.
4. **Google Calendar (Links Mágicos)**: Para cada despesa fixa cadastrada ou detectada, gere um link no chat assim: 👉 [Adicionar ao Google Agenda - Nome da Conta](URL).
   - **Formato URL GCal**: https://www.google.com/calendar/render?action=TEMPLATE&text=Pagamento+-+NOME_DA_CONTA&details=Lembrete+de+Pagamento+da+Lumi.+Lembrete+configurado+para+2+dias+antes.&dates=20240401/20240401 (Use o ano/mês atual e o dia de vencimento informado pelo usuário).

### CONTEXTO DO CLIENTE NESTE MOMENTO:
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
                const profileData = JSON.parse(match[1]);
                await User.findByIdAndUpdate(userId, { $set: profileData });
                console.log(`[LUMI SUCCESS] Perfil do usuário ${userId} atualizado!`);
                dataChanged = true;
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
            model: "llama-3-8b-8192", // Modelo mais rápido para insights iniciais
        });

        const insight = completion.choices[0].message.content;
        res.json({ insight });
    } catch (err) {
        console.error("Erro ao gerar insight proativo:", err);
        res.status(500).json({ message: "Erro ao gerar insight" });
    }
};

module.exports = { analyzeFinances, getProactiveInsight };
