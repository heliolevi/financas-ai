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
    const userId = req.userId;
    const { message } = req.body;

    try {
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
                content: `Olá, eu sou a **Lumi**, sua assistente pessoal de finanças. 
                
Sua missão é dar controle total ao usuário sobre seus gastos. 

### REGRAS DE REGISTRO
1. Use [[SAVE:{"amount":...}]] apenas após confirmação.

### REGRAS DE EXCLUSÃO (MÚLTIPLAS OU TUDO)
1. **Vários gastos**: Se o usuário quiser apagar vários itens, você pode colocar várias tags [[DELETE:id]] na mesma resposta.
2. **Apagar TUDO**: Se o usuário quiser zerar a conta ou apagar todo o histórico, use a tag [[DELETE_ALL]].
3. **Confirmação**: SEMPRE peça confirmação antes de apagar, especialmente para "Apagar Tudo". Ex: "Tem certeza que deseja zerar todo o seu histórico?"

### REGRAS DE ANÁLISE
1. Use os dados: ${dynamicContext}.
2. Seja amigável e concisa em Português do Brasil.

Histórico com IDs: ${JSON.stringify(transactions.slice(0, 15))}`
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
