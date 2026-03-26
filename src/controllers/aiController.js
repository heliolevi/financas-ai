const Groq = require('groq-sdk');
const db = require('../config/database');
const dotenv = require('dotenv');

dotenv.config();

const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY
});

const analyzeFinances = async (req, res) => {
    const userId = req.userId;
    const { message } = req.body;

    try {
        // Fetch user transactions for context
        db.all(`SELECT amount, category, description, payment_method, date FROM transactions WHERE user_id = ?`, [userId], async (err, transactions) => {
            if (err) {
                return res.status(500).json({ message: 'Error fetching transactions for AI' });
            }

            const context = JSON.stringify(transactions);
            
            const completion = await groq.chat.completions.create({
                messages: [
                    {
                        role: "system",
                        content: "Você é um assistente financeiro pessoal. Analise as transações do usuário e responda em Português do Brasil. Seja conciso e dê dicas úteis. Se o usuário perguntar algo genérico, use o histórico de transações fornecido: " + context
                    },
                    {
                        role: "user",
                        content: message
                    }
                ],
                model: "llama-3.3-70b-versatile",
            });

            res.status(200).json({ response: completion.choices[0].message.content });
        });
    } catch (error) {
        console.error('Groq AI Error:', error);
        res.status(500).json({ message: 'Error processing AI request' });
    }
};

module.exports = { analyzeFinances };
