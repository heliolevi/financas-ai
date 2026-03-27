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
        db.all(`SELECT amount, category, description, payment_method, date FROM transactions WHERE user_id = ? ORDER BY date DESC LIMIT 20`, [userId], (err, rows) => {
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

const analyzeFinances = async (req, res) => {
    const userId = req.userId;
    const { message } = req.body;

    try {
        // 1. Save user message
        await saveMessage(userId, 'user', message);

        // 2. Fetch history and context
        const history = await getHistory(userId);
        const transactions = await getTransactions(userId);
        const context = JSON.stringify(transactions);
        const today = new Date().toISOString().split('T')[0];

        // 3. Prepare prompt
        const messages = [
            {
                role: "system",
                content: `Você é o "Anotador Financeiro", um assistente pessoal que ajuda o usuário a registrar despesas de forma rápida e organizada. 
                
Sua principal função é ANOTAR gastos. Quando o usuário disser que gastou algo, você deve extrair ou perguntar por:
- Valor (R$)
- Categoria (opções: Alimentação, Transporte, Lazer, Moradia, Saúde, Educação, Outros)
- Descrição (ex: Almoço, Uber, Aluguel)
- Forma de Pagamento (opções: Dinheiro, Cartão de Crédito, Cartão de Débito, Pix)
- Data (use "${today}" se o usuário disser "hoje" ou não especificar).

Regras:
1. Seja amigável, conciso e use Português do Brasil.
2. Se faltarem informações, peça-as uma por uma ou de forma agrupada para facilitar.
3. Quando tiver TODOS os dados, peça uma confirmação clara: "Posso registrar [Valor] em [Categoria] ([Descrição]) via [Forma de Pagamento]?"
4. SOMENTE após o usuário confirmar (dizendo "sim", "pode", "ok", etc), você deve gerar o registro.
5. IMPORTANTE: Para efetivar o registro após a confirmação, adicione EXATAMENTE esta tag ao final da sua resposta: [[SAVE:{"amount": valor_num, "category": "nome_cat", "description": "desc", "payment_method": "metodo", "date": "YYYY-MM-DD"}]]

Histórico de Gastos Recentes: ${context}`
            },
            ...history.map(msg => ({ role: msg.role, content: msg.content })),
        ];

        // 4. Call AI
        const completion = await groq.chat.completions.create({
            messages: messages,
            model: "llama-3.3-70b-versatile",
        });

        let aiResponse = completion.choices[0].message.content;
        let transactionAdded = false;

        // 5. Parse for auto-registration tag
        const saveTagMatch = aiResponse.match(/\[\[SAVE:(.*?)\]\]/);
        if (saveTagMatch) {
            try {
                const transactionData = JSON.parse(saveTagMatch[1]);
                await recordTransaction(userId, transactionData);
                transactionAdded = true;
                // Clean the tag from the text shown to user
                aiResponse = aiResponse.replace(/\[\[SAVE:.*?\]\]/, "").trim();
            } catch (e) {
                console.error("Error parsing/saving transaction from AI:", e);
            }
        }

        // 6. Save AI response to history
        await saveMessage(userId, 'assistant', aiResponse);

        res.status(200).json({ 
            response: aiResponse,
            transactionAdded: transactionAdded
        });

    } catch (error) {
        console.error('Groq AI Error:', error);
        res.status(500).json({ message: 'Error processing AI request' });
    }
};

module.exports = { analyzeFinances };
