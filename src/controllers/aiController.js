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

/**
 * Insere um novo gasto via IA.
 */
const recordTransaction = async (userId, data) => {
    try {
        const t = new Transaction({ user_id: userId, ...data });
        await t.save();
        return t._id;
    } catch (err) {
        console.error("Erro ao gravar transação:", err);
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
                content: `Você é a **Lumi**, uma assistente financeira amigável, educada e proativa. 

### SUA MISSÃO
Ajudar o usuário a ter controle total sobre o dinheiro, registrando gastos e analisando o histórico de forma simples.

### REGRAS CRÍTICAS (NUNCA MOSTRE AO USUÁRIO)
1. **TAGS MÁGICAS**: Use [[SAVE:{"amount":...}]], [[DELETE:id]] ou [[DELETE_ALL]] para comandos internos. 
   - **PROIBIDO**: NUNCA escreva essas tags no texto visível para o usuário. Elas devem ser usadas como se fossem comandos invisíveis.
   - **EXEMPLO**: Em vez de "Vou usar a tag [[DELETE:1]]", diga "Pronto! Já removi o gasto de R$ 50,00 para você."

2. **DADOS TÉCNICOS**: O "Contexto de Gastos" abaixo é apenas para sua referência. 
   - **PROIBIDO**: NUNCA copie e cole o formato JSON ou a lista de IDs para o usuário. 
   - **COMO AGIR**: Use os dados para dar conselhos naturais. Ex: "Notei que você gastou bastante com Uber este mês."

### FLUXO DE TRABALHO
- **Cartão de Crédito**: Sempre que o usuário registrar um gasto no crédito, **OBRIGATORIAMENTE** pergunte antes de salvar: "Foi parcelado? Se sim, em quantas vezes?". 
- **Lógica de Parcelas**: Se o usuário confirmar parcelamento (ex: 3x):
  - Divida o valor total pelas parcelas.
  - Gere uma tag [[SAVE]] para cada mês futuro.
  - Avance as datas mês a mês (Ex: 2024-03-27, 2024-04-27...).
  - Adicione "(1/N)", "(2/N)" na descrição.

### CONTEXTO DE GASTOS (APENAS REFERÊNCIA)
- Dados Analíticos: ${dynamicContext}
- Histórico com IDs (Use apenas para Delete): ${JSON.stringify(transactions.slice(0, 15))}`
            },
            ...history.map(msg => ({ role: msg.role, content: msg.content })),
        ];

        const completion = await groq.chat.completions.create({
            messages: messages,
            model: "llama-3.3-70b-versatile",
        });

        let aiResponse = completion.choices[0].message.content;
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

        const saveTagMatch = aiResponse.match(/\[\[SAVE:(.*?)\]\]/);
        if (saveTagMatch && !aiResponse.includes("[[DELETE_ALL]]")) {
            try {
                const transactionData = JSON.parse(saveTagMatch[1]);
                await recordTransaction(userId, transactionData);
                dataChanged = true;
                aiResponse = aiResponse.replace(/\[\[SAVE:.*?\]\]/g, "").trim();
            } catch (e) {
                console.error("Erro ao salvar via IA:", e);
            }
        }

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
