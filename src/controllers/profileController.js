/**
 * =============================================================================
 * CONTROLADOR DE PERFIL
 * =============================================================================
 * Responsável por: Get/Update do perfil financeiro, dashboard,
 * gerenciamento de despesas fixas, metas de economia e alertas.
 * =============================================================================
 */

const User = require('../models/User');
const Transaction = require('../models/Transaction');

/**
 * Retorna os dados completos do perfil do usuário (sem a senha).
 * @param {Object} req - userId do middleware
 * @param {Object} res - Dados do usuário
 */
const getProfile = async (req, res) => {
    try {
        const user = await User.findById(req.userId).select('-password');
        if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });
        res.json(user);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

/**
 * Atualiza dados do perfil financeiro com validações rigorosas.
 * Campos: renda, banco, cartão, despesas fixas, orçamento, metas, notificações.
 * 
 * @param {Object} req - body com campos a atualizar
 * @param {Object} res - Usuário atualizado
 */
const updateProfile = async (req, res) => {
    try {
        const { 
            grossIncome, netIncome, bankName, bankBalance,
            creditCardLimit, creditCardUsed, creditCardBill, creditCardDueDate,
            fixedExpenses, monthlyBudget, savingsGoal, savingsCurrent,
            notificationsEnabled, emailNotification, pushNotification, budgetAlertThreshold
        } = req.body;

        const existingUser = await User.findById(req.userId);
        if (!existingUser) return res.status(404).json({ error: 'Usuário não encontrado' });

        const updateData = {};
        
        // ==========================================
        // VALIDAÇÕES E NORMALIZAÇÃO
        // ==========================================
        
        // Renda bruta
        if (grossIncome !== undefined) {
            const grossValue = Math.max(0, Number(grossIncome) || 0);
            updateData.grossIncome = grossValue;
            
            if (netIncome !== undefined && Number(netIncome) > grossValue) {
                return res.status(400).json({ error: 'Renda líquida não pode ser maior que a renda bruta' });
            }
        }
        
        // Renda líquida
        if (netIncome !== undefined) {
            const netValue = Math.max(0, Number(netIncome) || 0);
            const grossValue = updateData.grossIncome !== undefined ? updateData.grossIncome : existingUser.grossIncome;
            
            if (grossValue !== undefined && netValue > grossValue) {
                return res.status(400).json({ error: 'Renda líquida não pode ser maior que a renda bruta' });
            }
            updateData.netIncome = netValue;
        }
        
        // Dados bancários
        if (bankName !== undefined) updateData.bankName = String(bankName).slice(0, 100);
        if (bankBalance !== undefined) updateData.bankBalance = Number(bankBalance) || 0;
        
        // Cartão de crédito
        if (creditCardLimit !== undefined) updateData.creditCardLimit = Math.max(0, Number(creditCardLimit) || 0);
        if (creditCardUsed !== undefined) updateData.creditCardUsed = Math.max(0, Math.min(Number(creditCardUsed) || 0, creditCardLimit || Infinity));
        if (creditCardBill !== undefined) updateData.creditCardBill = Math.max(0, Number(creditCardBill) || 0);
        
        // Vencimento do cartão (1-31)
        if (creditCardDueDate !== undefined && creditCardDueDate !== null && creditCardDueDate !== '') {
            const dueDate = parseInt(creditCardDueDate, 10);
            if (!isNaN(dueDate) && dueDate >= 1 && dueDate <= 31) {
                updateData.creditCardDueDate = dueDate;
            }
        }
        
        // Despesas fixas (array de objetos)
        if (fixedExpenses !== undefined) {
            const validExpenses = (fixedExpenses || [])
                .filter(e => e && e.name && e.amount > 0 && e.dueDate >= 1 && e.dueDate <= 31)
                .map(e => ({
                    name: String(e.name).slice(0, 100),
                    amount: Math.max(0, Number(e.amount)),
                    dueDate: Math.max(1, Math.min(31, Number(e.dueDate)))
                }));
            updateData.fixedExpenses = validExpenses;
        }
        
        // Metas e orçamento
        if (monthlyBudget !== undefined) updateData.monthlyBudget = Math.max(0, Number(monthlyBudget) || 0);
        if (savingsGoal !== undefined) updateData.savingsGoal = Math.max(0, Number(savingsGoal) || 0);
        if (savingsCurrent !== undefined) updateData.savingsCurrent = Math.max(0, Number(savingsCurrent) || 0);
        
        // Notificações
        if (notificationsEnabled !== undefined) updateData.notificationsEnabled = Boolean(notificationsEnabled);
        if (emailNotification !== undefined) updateData.emailNotification = Boolean(emailNotification);
        if (pushNotification !== undefined) updateData.pushNotification = Boolean(pushNotification);
        if (budgetAlertThreshold !== undefined) updateData.budgetAlertThreshold = Math.max(0, Math.min(100, Number(budgetAlertThreshold) || 80));

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

/**
 * Retorna dados agregados para o dashboard:
 * - Total gasto no mês
 - Despesas fixas
 - Uso do orçamento
 - Alertas gerados automaticamente
 * 
 * @param {Object} req - userId do middleware
 * @param {Object} res - Dados agregados do dashboard
 */
const getDashboardData = async (req, res) => {
    try {
        const user = await User.findById(req.userId).select('-password');
        
        // Período atual (mês/ano)
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const startOfMonth = `${year}-${month}-01`;
        const lastDay = new Date(year, now.getMonth() + 1, 0).getDate();
        const endOfMonth = `${year}-${month}-${lastDay}`;

        // Transações do mês
        const transactions = await Transaction.find({
            user_id: req.userId,
            date: { $gte: startOfMonth, $lte: endOfMonth }
        });

        // Cálculos
        const totalSpent = transactions.reduce((sum, t) => sum + t.amount, 0);
        
        const byCategory = {};
        transactions.forEach(t => {
            byCategory[t.category] = (byCategory[t.category] || 0) + t.amount;
        });

        const byPayment = {};
        transactions.forEach(t => {
            byPayment[t.payment_method] = (byPayment[t.payment_method] || 0) + t.amount;
        });

        // Fixas + Variáveis
        const fixedTotal = user.fixedExpenses ? user.fixedExpenses.reduce((acc, e) => acc + e.amount, 0) : 0;
        const totalWithFixed = totalSpent + fixedTotal;
        
        // Porcentagens
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

/**
 * Gera alertas automáticos baseados na situação financeira do usuário.
 * Tipos: danger (crítico), warning (atenção), success (positivo)
 * 
 * @param {Object} user - Dados do usuário
 * @param {number} totalWithFixed - Total gasto + fixas
 * @param {number} creditUsage - % uso do cartão
 * @param {number} commitmentRate - % comprometimento de renda
 * @returns {Array} Array de alertas
 */
function generateAlerts(user, totalWithFixed, creditUsage, commitmentRate) {
    const alerts = [];
    
    // Alerta de cartão de crédito
    if (user.creditCardLimit > 0 && creditUsage > 70) {
        alerts.push({ type: 'danger', message: `Uso do cartão está em ${creditUsage.toFixed(0)}%! Considere reduzir.` });
    } else if (user.creditCardLimit > 0 && creditUsage > 50) {
        alerts.push({ type: 'warning', message: `Cartão está em ${creditUsage.toFixed(0)}%. Atenção!` });
    }

    // Alerta de orçamento
    if (user.monthlyBudget > 0 && totalWithFixed > user.monthlyBudget) {
        alerts.push({ type: 'danger', message: 'Você ultrapassou o orçamento mensal!' });
    } else if (user.monthlyBudget > 0 && totalWithFixed > user.monthlyBudget * (user.budgetAlertThreshold / 100)) {
        alerts.push({ type: 'warning', message: `Você já usou ${((totalWithFixed / user.monthlyBudget) * 100).toFixed(0)}% do orçamento.` });
    }

    // Alerta de comprometimento de renda
    if (commitmentRate > 75) {
        alerts.push({ type: 'danger', message: `Comprometimento de renda crítico: ${commitmentRate.toFixed(0)}%` });
    } else if (commitmentRate > 50) {
        alerts.push({ type: 'warning', message: `Comprometimento de renda alto: ${commitmentRate.toFixed(0)}%` });
    }

    // Alerta de meta de economia
    if (user.savingsGoal > 0 && user.savingsCurrent < user.savingsGoal * 0.25 && new Date().getDate() > 10) {
        alerts.push({ type: 'warning', message: 'Menos de 25% da meta de economia. Aumente os esforços!' });
    }

    return alerts;
}

/**
 * Adiciona uma nova despesa fixa ao perfil do usuário.
 * @param {Object} req - body: { name, amount, dueDate }
 * @param {Object} res - Array de despesas fixas atualizadas
 */
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

/**
 * Remove uma despesa fixa pelo índice do array.
 * @param {Object} req - params: { index }
 * @param {Object} res - Array de despesas fixas atualizadas
 */
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

/**
 * Atualiza o valor atual economizado (progresso da meta).
 * @param {Object} req - body: { savingsCurrent }
 * @param {Object} res - Usuário com savingsCurrent atualizado
 */
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
