const User = require('../models/User');
const Transaction = require('../models/Transaction');

const getDailySummary = async (req, res) => {
    try {
        const userId = req.userId;
        const user = await User.findById(userId);
        
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth() + 1;
        const day = now.getDate();

        const start = `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`;
        const lastDay = new Date(currentYear, currentMonth, 0).getDate();
        const end = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${lastDay}`;

        const transactions = await Transaction.find({
            user_id: userId,
            date: { $gte: start, $lte: end }
        });

        const totalSpent = transactions.reduce((sum, t) => sum + t.amount, 0);
        const fixedTotal = user.fixedExpenses ? user.fixedExpenses.reduce((sum, e) => sum + e.amount, 0) : 0;
        const totalWithFixed = totalSpent + fixedTotal;

        const todayTransactions = transactions.filter(t => t.date === now.toISOString().split('T')[0]);
        const todaySpent = todayTransactions.reduce((sum, t) => sum + t.amount, 0);

        const byCategory = {};
        transactions.forEach(t => {
            byCategory[t.category] = (byCategory[t.category] || 0) + t.amount;
        });

        const categoryList = Object.entries(byCategory)
            .map(([cat, amount]) => ({ category: cat, amount }))
            .sort((a, b) => b.amount - a.amount);

        let status = 'on_track';
        let message = '';

        if (user.monthlyBudget > 0) {
            const pctUsed = (totalWithFixed / user.monthlyBudget) * 100;
            if (pctUsed >= 100) {
                status = 'exceeded';
                message = 'Orçamento excedido!';
            } else if (pctUsed >= 80) {
                status = 'warning';
                message = `${pctUsed.toFixed(0)}% do orçamento usado`;
            } else {
                message = `${pctUsed.toFixed(0)}% do orçamento usado`;
            }
        }

        res.json({
            date: now.toLocaleDateString('pt-BR'),
            day,
            totalSpent,
            fixedTotal,
            totalWithFixed,
            todaySpent,
            budget: user.monthlyBudget || 0,
            budgetUsed: user.monthlyBudget > 0 ? (totalWithFixed / user.monthlyBudget) * 100 : 0,
            categories: categoryList.slice(0, 5),
            status,
            message
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

module.exports = { getDailySummary };