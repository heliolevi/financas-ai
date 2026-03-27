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

/**
 * Remove TODOS os gastos do usuário de uma vez.
 */
const deleteAllTransactions = (userId) => {
    return new Promise((resolve, reject) => {
        db.run(`DELETE FROM transactions WHERE user_id = ?`, [userId], function(err) {
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
 * 4. Analisa a resposta em busca de tags mágicas [[SAVE]], [[DELETE]] ou [[DELETE_ALL]].
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

        // 4. Envia para a API da Groq
        const completion = await groq.chat.completions.create({
            messages: messages,
            model: "llama-3.3-70b-versatile",
        });

        let aiResponse = completion.choices[0].message.content;
        let dataChanged = false;

        // 5. PROCESSAMENTO DE TAGS

        // Caso 1: Apagar Tudo
        if (aiResponse.includes("[[DELETE_ALL]]")) {
            await deleteAllTransactions(userId);
            dataChanged = true;
            aiResponse = aiResponse.replace("[[DELETE_ALL]]", "").trim();
        }

        // Caso 2: Apagar Múltiplos (Regex Global /g para pegar todas)
        const deleteMatches = aiResponse.matchAll(/\[\[DELETE:(.*?)\]\]/g);
        for (const match of deleteMatches) {
            const idToDelete = match[1].trim();
            if (idToDelete) {
                await deleteTransactionById(userId, idToDelete);
                dataChanged = true;
            }
        }
        aiResponse = aiResponse.replace(/\[\[DELETE:.*?\]\]/g, "").trim();

        // Caso 3: Salvar (Apenas se não houver delete_all)
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

        // 7. Salva a resposta da Lumi no histórico
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
