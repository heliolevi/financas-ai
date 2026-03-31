const User = require('../models/User');
const Transaction = require('../models/Transaction');

const getProactiveAlerts = async (userId) => {
    const user = await User.findById(userId);
    if (!user) return [];

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

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

    const alerts = [];

    if (user.creditCardLimit > 0 && user.creditCardUsed > 0) {
        const usage = (user.creditCardUsed / user.creditCardLimit) * 100;
        if (usage > 80) {
            alerts.push({ 
                type: 'danger', 
                title: 'Cartão em risco!', 
                message: `Você já usou ${usage.toFixed(0)}% do limite do cartão.`,
                action: 'pay_card'
            });
        } else if (usage > 60) {
            alerts.push({ 
                type: 'warning', 
                title: 'Atenção cartão', 
                message: `Uso do cartão em ${usage.toFixed(0)}%. Fique de olho!`,
                action: 'view_card'
            });
        }
    }

    if (user.monthlyBudget > 0) {
        const pctUsed = (totalWithFixed / user.monthlyBudget) * 100;
        if (pctUsed >= 100) {
            alerts.push({ 
                type: 'danger', 
                title: 'Orçamento excedido!', 
                message: `Você já usou R$ ${totalWithFixed.toFixed(2)} do orçamento de R$ ${user.monthlyBudget}.`,
                action: 'view_budget'
            });
        } else if (pctUsed >= 80) {
            alerts.push({ 
                type: 'warning', 
                title: 'Orçamento apertado', 
                message: `Já usou ${pctUsed.toFixed(0)}% do orçamento mensal.`,
                action: 'view_budget'
            });
        }
    }

    if (user.netIncome > 0) {
        const commitment = (totalWithFixed / user.netIncome) * 100;
        if (commitment > 90) {
            alerts.push({ 
                type: 'danger', 
                title: 'Renda comprometida!', 
                message: `${commitment.toFixed(0)}% da sua renda está comprometida este mês.`,
                action: 'view_profile'
            });
        }
    }

    const dayOfMonth = now.getDate();
    if (dayOfMonth === 1) {
        alerts.push({
            type: 'info',
            title: 'Novo mês, novas metas!',
            message: 'Configure suas metas para este mês.',
            action: 'set_goals'
        });
    }

    if (user.savingsGoal > 0 && user.savingsCurrent >= user.savingsGoal) {
        alerts.push({
            type: 'success',
            title: 'Meta alcançada! 🎉',
            message: 'Parabéns! Você atingiu sua meta de economia.',
            action: 'view_goals'
        });
    }

    return alerts;
};

module.exports = { getProactiveAlerts };