const Groq = require('groq-sdk');
const db = require('../config/database');
const dotenv = require('dotenv');

dotenv.config();

const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY
});

// Helper to save message to database
const saveMessage = (userId, role, content) => {
    return new Promise((resolve, reject) => {
        db.run(`INSERT INTO messages (user_id, role, content) VALUES (?, ?, ?)`, [userId, role, content], (err) => {
            if (err) reject(err);
            else resolve();
        });
    });
};

// Helper to get message history
const getHistory = (userId, limit = 10) => {
    return new Promise((resolve, reject) => {
        db.all(`SELECT role, content FROM messages WHERE user_id = ? ORDER BY timestamp DESC LIMIT ?`, [userId, limit], (err, rows) => {
            if (err) reject(err);
            else resolve(rows.reverse());
        });
    });
};

// Helper to get user transactions for context
const getTransactions = (userId) => {
    return new Promise((resolve, reject) => {
        db.all(`SELECT id, amount, category, description, payment_method, date FROM transactions WHERE user_id = ? ORDER BY date DESC LIMIT 20`, [userId], (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
};

// Helper to record a transaction
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

// Helper to delete a transaction
const deleteTransactionById = (userId, id) => {
    return new Promise((resolve, reject) => {
        db.run(`DELETE FROM transactions WHERE id = ? AND user_id = ?`, [id, userId], function(err) {
            if (err) reject(err);
            else resolve(this.changes);
        });
    });
};

const analyzeFinances = async (req, res) => {
    const userId = req.userId;
    const { message } = req.body;

    try {
        // 1. Save user message
        await saveMessage(userId, 'user', message);

        // 2. Fetch history and context
        const history = await getHistory(userId);
        const transactions = await getTransactions(userId);
        
        // Calculate dynamic stats for AI context
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

        // 3. Prepare prompt
        const messages = [
            {
                role: "system",
                content: `Olá, eu sou a **Lumi**, sua assistente pessoal de finanças. 
                
Minha missão é trazer clareza e inteligência para o seu dinheiro. Eu ajudo você a registrar despesas e ANALISAR seus gastos de forma proativa. 

Sua principal função é ANOTAR gastos e alertar sobre o Dashboard. 

Regras de Registro:
1. Quando o usuário disser que gastou algo, extraia: Valor, Categoria, Descrição, Forma de Pagamento e Data.
2. Se faltarem informações, peça-as de forma agrupada.
3. Peça confirmação antes de salvar.
4. Para salvar após confirmação, use a tag: [[SAVE:{"amount": valor_num, "category": "nome_cat", "description": "desc", "payment_method": "metodo", "date": "YYYY-MM-DD"}]]

Regras de Exclusão:
1. Se o usuário quiser apagar, remover ou cancelar um gasto, identifique o ID correspondente no histórico abaixo.
2. Peça confirmação: "Tem certeza que deseja apagar o gasto de [Valor] em [Descrição]?"
3. Para excluir após confirmação, use a tag: [[DELETE:ID_DA_TRANSACAO]]

Regras de Análise:
1. Se perguntarem sobre o dashboard, use: ${dynamicContext}.
2. Seja amigável, educada e concisa. Use Português do Brasil.

Histórico para referência (com IDs): ${JSON.stringify(transactions.slice(0, 15))}`
            },
            ...history.map(msg => ({ role: msg.role, content: msg.content })),
        ];

        // 4. Call AI
        const completion = await groq.chat.completions.create({
            messages: messages,
            model: "llama-3.3-70b-versatile",
        });

        let aiResponse = completion.choices[0].message.content;
        let dataChanged = false;

        // 5. Parse for auto-registration tag
        const saveTagMatch = aiResponse.match(/\[\[SAVE:(.*?)\]\]/);
        if (saveTagMatch) {
            try {
                const transactionData = JSON.parse(saveTagMatch[1]);
                await recordTransaction(userId, transactionData);
                dataChanged = true;
                aiResponse = aiResponse.replace(/\[\[SAVE:.*?\]\]/, "").trim();
            } catch (e) {
                console.error("Error parsing/saving transaction from AI:", e);
            }
        }

        // 6. Parse for deletion tag
        const deleteTagMatch = aiResponse.match(/\[\[DELETE:(.*?)\]\]/);
        if (deleteTagMatch) {
            try {
                const idToDelete = deleteTagMatch[1];
                await deleteTransactionById(userId, idToDelete);
                dataChanged = true;
                aiResponse = aiResponse.replace(/\[\[DELETE:.*?\]\]/, "").trim();
            } catch (e) {
                console.error("Error parsing/deleting transaction from AI:", e);
            }
        }

        // 7. Save AI response to history
        await saveMessage(userId, 'assistant', aiResponse);

        res.status(200).json({ 
            response: aiResponse,
            transactionAdded: dataChanged // Re-using this flag to trigger refresh
        });

    } catch (error) {
        console.error('Groq AI Error:', error);
        res.status(500).json({ message: 'Error processing AI request' });
    }
};

module.exports = { analyzeFinances };
