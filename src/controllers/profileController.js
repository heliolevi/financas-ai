const User = require('../models/User');
const Transaction = require('../models/Transaction');

const getProfile = async (req, res) => {
    try {
        const user = await User.findById(req.userId).select('-password');
        if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });
        res.json(user);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const updateProfile = async (req, res) => {
    try {
        const { 
            grossIncome, netIncome, bankName, bankBalance,
            creditCardLimit, creditCardUsed, creditCardBill, creditCardDueDate,
            fixedExpenses, monthlyBudget, savingsGoal, savingsCurrent,
            notificationsEnabled, emailNotification, pushNotification, budgetAlertThreshold
        } = req.body;

        const updateData = {};
        if (grossIncome !== undefined) updateData.grossIncome = grossIncome;
        if (netIncome !== undefined) updateData.netIncome = netIncome;
        if (bankName !== undefined) updateData.bankName = bankName;
        if (bankBalance !== undefined) updateData.bankBalance = bankBalance;
        if (creditCardLimit !== undefined) updateData.creditCardLimit = creditCardLimit;
        if (creditCardUsed !== undefined) updateData.creditCardUsed = creditCardUsed;
        if (creditCardBill !== undefined) updateData.creditCardBill = creditCardBill;
        if (creditCardDueDate !== undefined) updateData.creditCardDueDate = creditCardDueDate;
        if (fixedExpenses !== undefined) updateData.fixedExpenses = fixedExpenses;
        if (monthlyBudget !== undefined) updateData.monthlyBudget = monthlyBudget;
        if (savingsGoal !== undefined) updateData.savingsGoal = savingsGoal;
        if (savingsCurrent !== undefined) updateData.savingsCurrent = savingsCurrent;
        if (notificationsEnabled !== undefined) updateData.notificationsEnabled = notificationsEnabled;
        if (emailNotification !== undefined) updateData.emailNotification = emailNotification;
        if (pushNotification !== undefined) updateData.pushNotification = pushNotification;
        if (budgetAlertThreshold !== undefined) updateData.budgetAlertThreshold = budgetAlertThreshold;

        const user = await User.findByIdAndUpdate(
            req.userId,
            { $set: updateData },
            { new: true, runValidators: true }
        ).select('-password');

        res.json(user);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

const getDashboardData = async (req, res) => {
    try {
        const user = await User.findById(req.userId).select('-password');
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

        const transactions = await Transaction.find({
            user_id: req.userId,
            date: { $gte: startOfMonth, $lte: endOfMonth }
        });

        const totalSpent = transactions.reduce((sum, t) => sum + t.amount, 0);
        
        const byCategory = {};
        transactions.forEach(t => {
            byCategory[t.category] = (byCategory[t.category] || 0) + t.amount;
        });

        const byPayment = {};
        transactions.forEach(t => {
            byPayment[t.payment_method] = (byPayment[t.payment_method] || 0) + t.amount;
        });

        const fixedTotal = user.fixedExpenses ? user.fixedExpenses.reduce((acc, e) => acc + e.amount, 0) : 0;
        const totalWithFixed = totalSpent + fixedTotal;
        
        const budgetUsed = user.monthlyBudget > 0 ? (totalWithFixed / user.monthlyBudget) * 100 : 0;
        const savingsProgress = user.savingsGoal > 0 ? (user.savingsCurrent / user.savingsGoal) * 100 : 0;
        
        const commitmentRate = user.netIncome > 0 ? ((fixedTotal + totalSpent) / user.netIncome) * 100 : 0;
        const creditUsage = user.creditCardLimit > 0 ? (user.creditCardUsed / user.creditCardLimit) * 100 : 0;

        res.json({
            user: {
                username: user.username,
                grossIncome: user.grossIncome,
                netIncome: user.netIncome,
                bankName: user.bankName,
                bankBalance: user.bankBalance,
                creditCardLimit: user.creditCardLimit,
                creditCardUsed: user.creditCardUsed,
                creditCardBill: user.creditCardBill,
                creditCardDueDate: user.creditCardDueDate,
                fixedExpenses: user.fixedExpenses,
                monthlyBudget: user.monthlyBudget,
                savingsGoal: user.savingsGoal,
                savingsCurrent: user.savingsCurrent,
                notificationsEnabled: user.notificationsEnabled,
                budgetAlertThreshold: user.budgetAlertThreshold
            },
            stats: {
                totalSpent,
                fixedTotal,
                totalWithFixed,
                budgetUsed,
                savingsProgress,
                commitmentRate,
                creditUsage,
                byCategory,
                byPayment,
                transactionCount: transactions.length
            },
            alerts: generateAlerts(user, totalWithFixed, creditUsage, commitmentRate)
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

function generateAlerts(user, totalWithFixed, creditUsage, commitmentRate) {
    const alerts = [];
    
    if (user.creditCardLimit > 0 && creditUsage > 70) {
        alerts.push({ type: 'danger', message: `Uso do cartão está em ${creditUsage.toFixed(0)}%! Considere reduzir.` });
    } else if (user.creditCardLimit > 0 && creditUsage > 50) {
        alerts.push({ type: 'warning', message: `Cartão está em ${creditUsage.toFixed(0)}%. Atenção!` });
    }

    if (user.monthlyBudget > 0 && totalWithFixed > user.monthlyBudget) {
        alerts.push({ type: 'danger', message: 'Você ultrapassou o orçamento mensal!' });
    } else if (user.monthlyBudget > 0 && totalWithFixed > user.monthlyBudget * (user.budgetAlertThreshold / 100)) {
        alerts.push({ type: 'warning', message: `Você já usou ${((totalWithFixed / user.monthlyBudget) * 100).toFixed(0)}% do orçamento.` });
    }

    if (commitmentRate > 75) {
        alerts.push({ type: 'danger', message: `Comprometimento de renda crítico: ${commitmentRate.toFixed(0)}%` });
    } else if (commitmentRate > 50) {
        alerts.push({ type: 'warning', message: `Comprometimento de renda alto: ${commitmentRate.toFixed(0)}%` });
    }

    if (user.savingsGoal > 0 && user.savingsCurrent < user.savingsGoal * 0.25 && new Date().getDate() > 10) {
        alerts.push({ type: 'warning', message: 'Menos de 25% da meta de economia. Aumente os esforços!' });
    }

    return alerts;
}

const addFixedExpense = async (req, res) => {
    try {
        const { name, amount, dueDate } = req.body;
        const user = await User.findById(req.userId);
        user.fixedExpenses.push({ name, amount, dueDate });
        await user.save();
        res.json(user.fixedExpenses);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

const removeFixedExpense = async (req, res) => {
    try {
        const { index } = req.params;
        const user = await User.findById(req.userId);
        user.fixedExpenses.splice(index, 1);
        await user.save();
        res.json(user.fixedExpenses);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

const updateSavings = async (req, res) => {
    try {
        const { savingsCurrent } = req.body;
        const user = await User.findByIdAndUpdate(
            req.userId,
            { $set: { savingsCurrent } },
            { new: true }
        ).select('-password');
        res.json(user);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

module.exports = {
    getProfile,
    updateProfile,
    getDashboardData,
    addFixedExpense,
    removeFixedExpense,
    updateSavings
};
