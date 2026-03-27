const Groq = require('groq-sdk');
const db = require('../config/database');
const dotenv = require('dotenv');

dotenv.config();

// Inicializa o cliente da Groq (IA)
const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY
});

// --- FUNÇÕES AUXILIARES (HELPERS) ---

/**
 * Salva uma mensagem no histórico para que a Lumi tenha "memória".
 */
const saveMessage = (userId, role, content) => {
    return new Promise((resolve, reject) => {
        db.run(`INSERT INTO messages (user_id, role, content) VALUES (?, ?, ?)`, [userId, role, content], (err) => {
            if (err) reject(err);
            else resolve();
        });
    });
};

/**
 * Recupera as últimas conversas para dar contexto à IA.
 */
const getHistory = (userId, limit = 10) => {
    return new Promise((resolve, reject) => {
        db.all(`SELECT role, content FROM messages WHERE user_id = ? ORDER BY timestamp DESC LIMIT ?`, [userId, limit], (err, rows) => {
            if (err) reject(err);
            else resolve(rows.reverse()); // Inverte para ficar na ordem cronológica
        });
    });
};

/**
 * Busca transações recentes para que a Lumi saiba o que o usuário já gastou.
 */
const getTransactions = (userId) => {
    return new Promise((resolve, reject) => {
        db.all(`SELECT id, amount, category, description, payment_method, date FROM transactions WHERE user_id = ? ORDER BY date DESC LIMIT 20`, [userId], (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
};

/**
 * Insere um novo gasto via IA.
 */
const recordTransaction = (userId, data) => {
    return new Promise((resolve, reject) => {
        const { amount, category, description, payment_method, date } = data;
        db.run(`INSERT INTO transactions (user_id, amount, category, description, payment_method, date) VALUES (?, ?, ?, ?, ?, ?)`,
            [userId, amount, category, description, payment_method, date],
            function(err) {
                if (err) reject(err);
                else resolve(this.lastID);
            }
        );
    });
};

/**
 * Remove um gasto identificado pela IA via ID.
 */
const deleteTransactionById = (userId, id) => {
    return new Promise((resolve, reject) => {
        db.run(`DELETE FROM transactions WHERE id = ? AND user_id = ?`, [id, userId], function(err) {
            if (err) reject(err);
            else resolve(this.changes);
        });
    });
};

// --- FUNÇÃO PRINCIPAL ---

/**
 * Lógica central da Lumi: 
 * 1. Recebe a mensagem do usuário.
 * 2. Junta com o histórico e dados do Dashboard.
 * 3. Envia para a Groq.
 * 4. Analisa a resposta em busca de tags mágicas [[SAVE]] ou [[DELETE]].
 */
const analyzeFinances = async (req, res) => {
    const userId = req.userId;
    const { message } = req.body;

    try {
        // 1. Salva a pergunta do usuário no banco
        await saveMessage(userId, 'user', message);

        // 2. ColetaContexto: Memória e Transações
        const history = await getHistory(userId);
        const transactions = await getTransactions(userId);
        
        // Dica: Calculamos os totais aqui para que a IA não precise fazer contas difíceis, 
        // ela apenas interpreta os resultados já mastigados.
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

        const today = new Date().toISOString().split('T')[0];

        // 3. Monta o Prompt do Sistema (A "Personalidade" da Lumi)
        const messages = [
            {
                role: "system",
                content: `Olá, eu sou a **Lumi**, sua assistente pessoal de finanças. 
                
Minha missão é trazer clareza e inteligência para o seu dinheiro. Eu ajudo você a registrar despesas e ANALISAR seus gastos de forma proativa. 

Sua principal função é ANOTAR gastos e alertar sobre o Dashboard. 

### REGRAS DE REGISTRO (PARA NOVOS GASTOS)
1. Quando o usuário disser que gastou algo, extraia: Valor, Categoria, Descrição, Forma de Pagamento e Data.
2. Peça confirmação: "Posso registrar [Valor] em [Descrição]?"
3. SOMENTE após o usuário confirmar, use a tag: [[SAVE:{"amount": valor, ...}]]
4. NUNCA use [[SAVE]] se o usuário estiver pedindo para APAGAR algo.

### REGRAS DE EXCLUSÃO (PARA REMOVER GASTOS EXISTENTES)
1. Se o usuário quiser apagar, remover ou cancelar um gasto já salvo, procure o ID no histórico abaixo.
2. Peça confirmação: "Tem certeza que deseja APAGAR o gasto de [Valor] em [Descrição]?"
3. SOMENTE após o usuário confirmar a exclusão, use a tag: [[DELETE:ID]]
4. NUNCA use [[DELETE]] se o usuário estiver pedindo para ADICIONAR algo.

### REGRAS DE ANÁLISE
1. Se perguntarem sobre o dashboard, use: ${dynamicContext}.
2. Seja amigável, educada e concisa. Use Português do Brasil.

Histórico para referência (use os IDs para exclusão): ${JSON.stringify(transactions.slice(0, 15))}`
            },
            ...history.map(msg => ({ role: msg.role, content: msg.content })),
        ];

        // 4. Envia para a API da Groq
        const completion = await groq.chat.completions.create({
            messages: messages,
            model: "llama-3.3-70b-versatile",
        });

        let aiResponse = completion.choices[0].message.content;
        let dataChanged = false;

        // 5. PROCESSAMENTO DE TAGS (Mutualmente Exclusivos)
        const deleteTagMatch = aiResponse.match(/\[\[DELETE:(.*?)\]\]/);
        const saveTagMatch = aiResponse.match(/\[\[SAVE:(.*?)\]\]/);

        if (deleteTagMatch) {
            // Prioridade para exclusão se houver conflito (raro)
            try {
                const idToDelete = deleteTagMatch[1].trim();
                if (idToDelete) {
                    await deleteTransactionById(userId, idToDelete);
                    dataChanged = true;
                    aiResponse = aiResponse.replace(/\[\[DELETE:.*?\]\]/g, "").trim();
                }
            } catch (e) {
                console.error("Erro ao deletar via IA:", e);
            }
        } else if (saveTagMatch) {
            // Registro apenas se não for exclusão
            try {
                const transactionData = JSON.parse(saveTagMatch[1]);
                await recordTransaction(userId, transactionData);
                dataChanged = true;
                aiResponse = aiResponse.replace(/\[\[SAVE:.*?\]\]/g, "").trim();
            } catch (e) {
                console.error("Erro ao salvar via IA:", e);
            }
        }

        // 7. Salva a resposta da Lumi no histórico para manter a memória fluindo
        await saveMessage(userId, 'assistant', aiResponse);

        res.status(200).json({ 
            response: aiResponse,
            transactionAdded: dataChanged // Este flag avisa o frontend para recarregar o Dashboard
        });

    } catch (error) {
        console.error('Groq AI Error:', error);
        res.status(500).json({ message: 'Erro ao processar sua solicitação na IA' });
    }
};

module.exports = { analyzeFinances };
