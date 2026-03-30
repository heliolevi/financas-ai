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
        const transactions = await Transaction.find({ user_id: userId })
            .sort({ date: -1, timestamp: -1 })
            .limit(20);
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
        
        // Normalização de Data (Evita "[Data atual]" ou formatos inválidos)
        let finalDate = data.date;
        if (!finalDate || typeof finalDate !== 'string' || finalDate.includes('[') || !finalDate.includes('-')) {
            finalDate = new Date().toISOString().split('T')[0];
        }

        const payload = {
            user_id: userId,
            amount: Number(data.amount) || 0,
            category: data.category || 'Outros',
            description: data.description || '',
            payment_method: data.payment_method || 'Dinheiro',
            date: finalDate,
            installments: Number(data.installments) || 1,
            installment_index: Number(data.installment_index) || 1
        };

        const t = new Transaction(payload);
        await t.save();
        console.log(`[LUMI SUCCESS] Transação ${t._id} gravada com sucesso!`);
        return t._id;
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
    } catch (err) {
        console.error("Erro ao deletar transação:", err);
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

        const dynamicContext = `
            Total gasto: R$ ${total.toFixed(2)}
            Gasto por categoria: ${JSON.stringify(cats)}
            Uso de Cartão de Crédito: ${creditPct.toFixed(0)}% ${creditPct > 60 ? '(PERIGO: Muito alto!)' : ''}
        `;

        const messages = [
            {
                role: "system",
                content: `Você é a **Lumi**, uma assistente financeira carinhosa, esperta e muito discreta.

### SUAS DIRETRIZES DE OURO
1. **PRIVACIDADE TOTAL**: Nunca mostre ao usuário os dados técnicos que eu te passo (como JSON, IDs de banco de dados ou resumos técnicos de categorias). Fale de forma natural.
2. **GRAVAÇÃO SILENCIOSA**: Inclua a tag [[SAVE:{...}]] SOMENTE quando o usuário informar um gasto real. NUNCA inclua esta tag para saudações, mensagens de boas-vindas ou conversas triviais. 
3. **FORMATO DA TAG**: Siga RIGOROSAMENTE este JSON: [[SAVE:{"description": "...", "amount": 10.5, "category": "...", "payment_method": "...", "date": "YYYY-MM-DD"}]]

### SEU JEITO LUMI DE SER
- Use emojis, seja doce e encorajadora.
- Se o usuário confirmar um gasto, diga "Anotei aqui, meu bem!" e coloque a tag [[SAVE]].
- Se o usuário apenas disser Oi, apenas responda de volta docemente, sem gravar nada.
`
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

module.exports = { analyzeFinances };
