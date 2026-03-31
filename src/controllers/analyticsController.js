/**
 * =============================================================================
 * CONTROLADOR DE ANALYTICS
 * =============================================================================
 * Responsável por: Previsão de gastos, detecção de assinaturas,
 * e insights gerados por IA.
 * =============================================================================
 */

const Transaction = require('../models/Transaction');
const User = require('../models/User');
const Groq = require('groq-sdk');
const dotenv = require('dotenv');

dotenv.config();

let groq = null;
if (process.env.GROQ_API_KEY) {
    groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
}

/**
 * Prevê gastos do mês atual baseando-se na média histórica.
 * Usa dados dos últimos 6 meses para calcular média e tendência.
 * 
 * @param {Object} req - userId do middleware
 * @param {Object} res - { prediction: { expectedMonthly, projectedCurrentMonth, ... }, historical, insights }
 */
const predictExpenses = async (req, res) => {
    try {
        const userId = req.userId;
        const user = await User.findById(userId);
        
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
        
        const transactions = await Transaction.find({
            user_id: userId,
            date: { $gte: sixMonthsAgo.toISOString().split('T')[0] }
        }).sort({ date: 1 });
        
        const monthlyTotals = {};
        transactions.forEach(t => {
            const month = t.date.slice(0, 7);
            monthlyTotals[month] = (monthlyTotals[month] || 0) + t.amount;
        });
        
        const monthlyCategories = {};
        transactions.forEach(t => {
            const month = t.date.slice(0, 7);
            if (!monthlyCategories[month]) monthlyCategories[month] = {};
            monthlyCategories[month][t.category] = (monthlyCategories[month][t.category] || 0) + t.amount;
        });
        
        const months = Object.keys(monthlyTotals).sort();
        const avgMonthly = months.length > 0 
            ? Object.values(monthlyTotals).reduce((a, b) => a + b, 0) / months.length 
            : 0;
        
        const lastMonth = months[months.length - 1];
        const lastMonthTotal = monthlyTotals[lastMonth] || 0;
        
        const avgByCategory = {};
        months.forEach(m => {
            Object.entries(monthlyCategories[m] || {}).forEach(([cat, val]) => {
                avgByCategory[cat] = (avgByCategory[cat] || 0) + val;
            });
        });
        Object.keys(avgByCategory).forEach(cat => {
            avgByCategory[cat] = avgByCategory[cat] / months.length;
        });
        
        const currentMonth = new Date();
        const currentMonthStr = currentMonth.toISOString().slice(0, 7);
        const currentSpent = monthlyTotals[currentMonthStr] || 0;
        
        const prediction = avgMonthly;
        const remainingDays = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate() - currentMonth.getDate();
        const avgDaily = currentSpent / currentMonth.getDate();
        const projectedTotal = currentSpent + (avgDaily * remainingDays);
        
        const fixedExpenses = user.fixedExpenses || [];
        const fixedTotal = fixedExpenses.reduce((sum, e) => sum + e.amount, 0);
        
        res.json({
            prediction: {
                expectedMonthly: prediction,
                projectedCurrentMonth: projectedTotal,
                currentSpent,
                remainingDays,
                avgDaily,
                fixedExpensesTotal: fixedTotal,
                totalProjected: projectedTotal + fixedTotal,
                userIncome: user.netIncome || 0,
                surplusDeficit: (user.netIncome || 0) - (projectedTotal + fixedTotal)
            },
            historical: {
                months: Object.keys(monthlyTotals),
                totals: Object.values(monthlyTotals),
                byCategory: avgByCategory
            },
            insights: await generateInsights(monthlyTotals, avgByCategory, user)
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

/**
 * Gera insights automáticos baseados nos dados históricos.
 * Analisa tendência, maiores despesas e saúde financeira.
 * 
 * @param {Object} monthlyTotals - { '2026-01': 1500, '2026-02': 1800, ... }
 * @param {Object} avgByCategory - { 'Alimentação': 500, 'Transporte': 300, ... }
 * @param {Object} user - Dados do usuário
 * @returns {Array} Array de { type, text }
 */
async function generateInsights(monthlyTotals, avgByCategory, user) {
    const insights = [];
    const months = Object.keys(monthlyTotals).sort();
    
    // Analisa tendência dos últimos 3 meses
    if (months.length >= 3) {
        const recent = monthlyTotals[months[months.length - 1]];
        const older = monthlyTotals[months[months.length - 3]];
        const trend = ((recent - older) / older * 100).toFixed(1);
        
        if (trend > 10) {
            insights.push({ type: 'warning', text: `Seus gastos subiram ${trend}% dibandinge aos últimos 3 meses. Cuidado!` });
        } else if (trend < -10) {
            insights.push({ type: 'success', text: `Parabéns! Você reduziu os gastos em ${Math.abs(trend)}% vs 3 meses atrás! 🎉` });
        }
    }
    
    // Maior categoria de gastos
    const sortedCats = Object.entries(avgByCategory).sort((a, b) => b[1] - a[1]);
    if (sortedCats.length > 0) {
        insights.push({ type: 'info', text: `Sua maior despesa média é ${sortedCats[0][0]} (R$ ${sortedCats[0][1].toFixed(2)}/mês)` });
    }
    
    // Alerta de comprometimento por fixas
    const fixedTotal = (user.fixedExpenses || []).reduce((s, e) => s + e.amount, 0);
    const income = user.netIncome || 0;
    if (income > 0 && fixedTotal > income * 0.5) {
        insights.push({ type: 'warning', text: `Suas despesas fixas representam ${((fixedTotal/income)*100).toFixed(0)}% da renda. Tente reduzir para menos de 50%.` });
    }
    
    return insights;
};

/**
 * Detecta assinaturas recorrentes nas transações do usuário.
 * Usa palavras-chave e padrão de valores similares para identificar.
 * 
 * @param {Object} req - userId do middleware
 * @param {Object} res - { subscriptions: [...], summary: { total, monthlyTotal, yearlyEstimate } }
 */
const detectSubscriptions = async (req, res) => {
    try {
        const userId = req.userId;
        
        const transactions = await Transaction.find({
            user_id: userId
        }).sort({ date: -1 });
        
        const descriptions = {};
        transactions.forEach(t => {
            const desc = t.description.toLowerCase().replace(/\s*\(\d+\/\d+\)/g, '').trim();
            if (!descriptions[desc]) {
                descriptions[desc] = [];
            }
            descriptions[desc].push(t);
        });
        
        const subscriptions = [];
        const keywords = ['netflix', 'spotify', 'amazon', 'prime', 'disney', 'hbo', 'apple', 'gym', 'academia', 'crossfit', 'pilates', 'yoga', 'plano', 'seguro', 'celular', 'internet', 'luz', 'água', 'gás', 'aluguel', 'condomínio', 'ifood', 'rappi', 'uber', '99', 'magazine', 'assaí', 'carrefour', 'extra', 'pipoca', 'cinemark', 'ingresso', 'steam', 'playstation', 'xbox', 'nintendo', 'linkedin', 'coursera', 'udemy', 'alura', 'cultura'];
        
        for (const [desc, txs] of Object.entries(descriptions)) {
            if (txs.length < 2) continue;
            
            const hasKeyword = keywords.some(k => desc.includes(k));
            const amounts = txs.map(t => t.amount);
            const avgAmount = amounts.reduce((a, b) => a + b, 0) / amounts.length;
            const isRecurring = amounts.every(a => Math.abs(a - avgAmount) < 1);
            
            if (hasKeyword || (txs.length >= 3 && isRecurring)) {
                const sortedDates = txs.map(t => t.date).sort();
                const lastDate = new Date(sortedDates[sortedDates.length - 1]);
                const now = new Date();
                const daysSinceLast = Math.floor((now - lastDate) / (1000 * 60 * 60 * 24));
                
                subscriptions.push({
                    name: txs[0].description,
                    category: txs[0].category,
                    avgAmount: avgAmount,
                    frequency: txs.length >= 4 ? 'monthly' : txs.length >= 2 ? 'recurring' : 'occasional',
                    lastCharge: sortedDates[sortedDates.length - 1],
                    daysSinceLast,
                    nextEstimated: daysSinceLast > 30 ? 'overdue' : 30 - daysSinceLast,
                    occurrences: txs.length
                });
            }
        }
        
        const totalMonthly = subscriptions
            .filter(s => s.frequency === 'monthly')
            .reduce((sum, s) => sum + s.avgAmount, 0);
        
        res.json({
            subscriptions: subscriptions.sort((a, b) => b.avgAmount - a.avgAmount),
            summary: {
                total: subscriptions.length,
                monthlyTotal: totalMonthly,
                yearlyEstimate: totalMonthly * 12
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

/**
 * Gera insight rápido via IA (alternativa ao proactive insight).
 * Útil para a aba de Analytics.
 * 
 * @param {Object} req - userId do middleware
 * @param {Object} res - { insight: string }
 */
const getAIInsight = async (req, res) => {
    if (!groq) {
        return res.status(503).json({ error: 'Serviço de IA indisponível.' });
    }

    try {
        const userId = req.userId;
        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });
        
        const transactions = await Transaction.find({ user_id: userId })
            .sort({ date: -1 })
            .limit(50);
        
        const summary = transactions.map(t => 
            `${t.date}: ${t.description} - R$ ${t.amount} (${t.category})`
        ).join('\n');
        
        const completion = await groq.chat.completions.create({
            messages: [
                {
                    role: "system",
                    content: `Você é a **Lumi**, assistente financeira analítica. Forneça UM insight rápido, acionável e direto (máx 2 frases) baseado nos dados do usuário. Seja positiva quando possível, mas alertando riscos. Use emojis quando apropriado.`
                },
                {
                    role: "user",
                    content: `Analise我的 últimas transações:\n${summary}\n\nUsuário: ${user.username}\nRenda: R$ ${user.netIncome || 0}\nMeta economia: R$ ${user.savingsGoal || 0}`
                }
            ],
            model: "llama-3.3-70b-versatile",
            max_tokens: 150
        });
        
        res.json({ insight: completion.choices[0].message.content });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

module.exports = {
    predictExpenses,
    detectSubscriptions,
    getAIInsight
};
