/**
 * =============================================================================
 * SERVIÇO DE ANALYTICS DA LUMI
 * =============================================================================
 * Responsável por: Análises avançadas usadas no chat com IA.
 * Inclui: comparativo mensal, previsão, sugestões de corte, alertas reativos.
 * =============================================================================
 */

const Transaction = require('../models/Transaction');

/**
 * Compara gastos do mês atual vs mês anterior.
 * 
 * @param {string} userId - ID do usuário
 * @returns {Object} { current, previous, growth, analysis }
 */
const getMonthlyComparison = async (userId) => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    let prevMonth = currentMonth - 1;
    let prevYear = currentYear;
    if (prevMonth === 0) {
        prevMonth = 12;
        prevYear = currentYear - 1;
    }

    const currentStart = `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`;
    const currentLastDay = new Date(currentYear, currentMonth, 0).getDate();
    const currentEnd = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${currentLastDay}`;

    const prevStart = `${prevYear}-${String(prevMonth).padStart(2, '0')}-01`;
    const prevLastDay = new Date(prevYear, prevMonth, 0).getDate();
    const prevEnd = `${prevYear}-${String(prevMonth).padStart(2, '0')}-${prevLastDay}`;

    const currentTransactions = await Transaction.find({
        user_id: userId,
        date: { $gte: currentStart, $lte: currentEnd }
    });

    const prevTransactions = await Transaction.find({
        user_id: userId,
        date: { $gte: prevStart, $lte: prevEnd }
    });

    const currentTotal = currentTransactions.reduce((sum, t) => sum + t.amount, 0);
    const prevTotal = prevTransactions.reduce((sum, t) => sum + t.amount, 0);

    const currentByCategory = {};
    currentTransactions.forEach(t => {
        currentByCategory[t.category] = (currentByCategory[t.category] || 0) + t.amount;
    });

    const prevByCategory = {};
    prevTransactions.forEach(t => {
        prevByCategory[t.category] = (prevByCategory[t.category] || 0) + t.amount;
    });

    const growthPercent = prevTotal > 0 ? ((currentTotal - prevTotal) / prevTotal) * 100 : 0;

    return {
        current: { total: currentTotal, byCategory: currentByCategory, count: currentTransactions.length },
        previous: { total: prevTotal, byCategory: prevByCategory, count: prevTransactions.length },
        growth: growthPercent,
        analysis: analyzeGrowth(growthPercent, currentByCategory, prevByCategory)
    };
};

/**
 * Analisa crescimento de gastos e gera alertas.
 * 
 * @param {number} growth - Porcentagem de crescimento
 * @param {Object} currentByCat - Gastos por categoria mês atual
 * @param {Object} prevByCat - Gastos por categoria mês anterior
 * @returns {Array} Array de análises
 */
const analyzeGrowth = (growth, currentByCat, prevByCat) => {
    const analysis = [];
    
    if (growth > 20) {
        analysis.push({ type: 'danger', message: `Seus gastos subiram ${growth.toFixed(1)}% em relação ao mês passado. precisamos analizar os motivos.` });
    } else if (growth > 0) {
        analysis.push({ type: 'warning', message: `Gastos tiveram leve alta de ${growth.toFixed(1)}%.` });
    } else if (growth < -10) {
        analysis.push({ type: 'success', message: `Parabéns! Você reduziu seus gastos em ${Math.abs(growth).toFixed(1)}% em relação ao mês passado.` });
    }

    for (const cat in currentByCat) {
        const current = currentByCat[cat] || 0;
        const previous = prevByCat[cat] || 0;
        if (previous > 0) {
            const catGrowth = ((current - previous) / previous) * 100;
            if (catGrowth > 50) {
                analysis.push({ type: 'warning', message: `Categoria '${cat}' cresceu ${catGrowth.toFixed(1)}% vs mês anterior.` });
            }
        }
    }

    return analysis;
};

/**
 * Prevê gastos do mês baseado na média diária atual.
 * 
 * @param {string} userId - ID do usuário
 * @param {number} monthlyBudget - Orçamento mensal definido
 * @returns {Object} { currentTotal, dailyAverage, projectedTotal, status, message }
 */
const getSpendingForecast = async (userId, monthlyBudget) => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const currentDay = now.getDate();

    const start = `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`;
    const lastDay = new Date(currentYear, currentMonth, 0).getDate();
    const end = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${lastDay}`;

    const currentTransactions = await Transaction.find({
        user_id: userId,
        date: { $gte: start, $lte: end }
    });

    const currentTotal = currentTransactions.reduce((sum, t) => sum + t.amount, 0);
    const dailyAverage = currentDay > 0 ? currentTotal / currentDay : 0;
    const projectedTotal = dailyAverage * lastDay;
    const remainingDays = lastDay - currentDay;
    const remainingBudget = monthlyBudget - currentTotal;

    const last3Months = [];
    for (let i = 1; i <= 3; i++) {
        let m = currentMonth - i;
        let y = currentYear;
        if (m <= 0) {
            m += 12;
            y -= 1;
        }
        const s = `${y}-${String(m).padStart(2, '0')}-01`;
        const ld = new Date(y, m, 0).getDate();
        const e = `${y}-${String(m).padStart(2, '0')}-${ld}`;
        
        const txs = await Transaction.find({
            user_id: userId,
            date: { $gte: s, $lte: e }
        });
        last3Months.push(txs.reduce((sum, t) => sum + t.amount, 0));
    }

    const avgLast3Months = last3Months.length > 0 ? last3Months.reduce((a, b) => a + b, 0) / last3Months.length : 0;

    let status = 'on_track';
    let message = '';
    
    if (monthlyBudget > 0) {
        const pctUsed = (currentTotal / monthlyBudget) * 100;
        const projectedPct = (projectedTotal / monthlyBudget) * 100;
        
        if (pctUsed >= 100) {
            status = 'exceeded';
            message = 'Você já ultrapassou seu orçamento mensal!';
        } else if (projectedPct > 100) {
            status = 'warning';
            message = `Projeção: você vai ultrapassar o orçamento em R$ ${(projectedTotal - monthlyBudget).toFixed(2)}. Considere reduzir R$ ${(dailyAverage * remainingDays - remainingBudget).toFixed(2)}/dia.`;
        } else if (pctUsed >= 80) {
            status = 'caution';
            message = `Já usou ${pctUsed.toFixed(0)}% do orçamento. média diária: R$ ${dailyAverage.toFixed(2)}.`;
        } else {
            message = `Gastos dentro do esperado. média diária: R$ ${dailyAverage.toFixed(2)}.`;
        }
    } else {
        if (avgLast3Months > 0) {
            const diff = ((currentTotal - avgLast3Months) / avgLast3Months) * 100;
            if (diff > 20) {
                status = 'warning';
                message = `Seus gastos estão ${diff.toFixed(1)}% acima da média dos últimos 3 meses (R$ ${avgLast3Months.toFixed(2)}).`;
            }
        }
    }

    return {
        currentTotal,
        dailyAverage,
        projectedTotal,
        remainingDays,
        avgLast3Months,
        monthlyBudget,
        status,
        message
    };
};

/**
 * Sugere onde cortar gastos baseado em padrões anormais.
 * Compara mês atual vs média dos últimos 3 meses.
 * 
 * @param {string} userId - ID do usuário
 * @returns {Array} Array de sugestões de corte
 */
const getSmartCutSuggestions = async (userId) => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    const last3Months = {};
    for (let i = 1; i <= 3; i++) {
        let m = currentMonth - i;
        let y = currentYear;
        if (m <= 0) {
            m += 12;
            y -= 1;
        }
        const s = `${y}-${String(m).padStart(2, '0')}-01`;
        const ld = new Date(y, m, 0).getDate();
        const e = `${y}-${String(m).padStart(2, '0')}-${ld}`;
        
        const txs = await Transaction.find({
            user_id: userId,
            date: { $gte: s, $lte: e }
        });
        
        txs.forEach(t => {
            last3Months[t.category] = (last3Months[t.category] || 0) + t.amount;
        });
    }

    const avgByCategory = {};
    for (const cat in last3Months) {
        avgByCategory[cat] = last3Months[cat] / 3;
    }

    const currentStart = `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`;
    const currentLastDay = new Date(currentYear, currentMonth, 0).getDate();
    const currentEnd = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${currentLastDay}`;

    const currentTransactions = await Transaction.find({
        user_id: userId,
        date: { $gte: currentStart, $lte: currentEnd }
    });

    const currentByCategory = {};
    currentTransactions.forEach(t => {
        currentByCategory[t.category] = (currentByCategory[t.category] || 0) + t.amount;
    });

    const suggestions = [];
    const unnecessaryCategories = ['Lazer', 'Fast Food', 'Delivery', 'Assinaturas', 'Compras Online', 'Outros'];
    
    for (const cat in currentByCategory) {
        if (unnecessaryCategories.includes(cat)) {
            const current = currentByCategory[cat] || 0;
            const avg = avgByCategory[cat] || 0;
            
            if (avg > 0 && current > avg * 1.3) {
                const excess = current - avg;
                suggestions.push({
                    category: cat,
                    currentSpent: current,
                    monthlyAvg: avg,
                    excess,
                    suggestion: `Você gastou R$ ${excess.toFixed(2)} a mais que sua média em ${cat}. considere reduzir.`
                });
            }
        }
    }

    return suggestions.sort((a, b) => b.excess - a.excess).slice(0, 3);
};

const checkReactiveAlerts = async (user, fixedTotal = 0) => {
    const alerts = [];
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    const start = `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`;
    const lastDay = new Date(currentYear, currentMonth, 0).getDate();
    const end = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${lastDay}`;

    const transactions = await Transaction.find({
        user_id: user._id,
        date: { $gte: start, $lte: end }
    });

    const totalSpent = transactions.reduce((sum, t) => sum + t.amount, 0) + (fixedTotal || 0);

    if (user.creditCardLimit > 0 && user.creditCardUsed > 0) {
        const usage = (user.creditCardUsed / user.creditCardLimit) * 100;
        if (usage > 80) {
            alerts.push({ type: 'danger', title: 'Cartão em risco!', message: `Você já usou ${usage.toFixed(0)}% do limite do cartão. Pague a fatura urgentemente.` });
        } else if (usage > 60) {
            alerts.push({ type: 'warning', title: 'Atenção cartão', message: `Uso do cartão em ${usage.toFixed(0)}%. Fique de olho!` });
        }
    }

    if (user.monthlyBudget > 0) {
        const pctUsed = (totalSpent / user.monthlyBudget) * 100;
        if (pctUsed >= 100) {
            alerts.push({ type: 'danger', title: 'Orçamento excedido!', message: `Você já usou R$ ${totalSpent.toFixed(2)} do orçamento de R$ ${user.monthlyBudget}.` });
        } else if (pctUsed >= 80) {
            alerts.push({ type: 'warning', title: 'Orçamento apertado', message: `Já usou ${pctUsed.toFixed(0)}% do orçamento mensal.` });
        }
    }

    if (user.netIncome > 0) {
        const commitment = ((totalSpent + fixedTotal) / user.netIncome) * 100;
        if (commitment > 90) {
            alerts.push({ type: 'danger', title: 'Renda comprometida!', message: `${commitment.toFixed(0)}% da sua renda já está comprometida este mês.` });
        }
    }

    return alerts;
};

module.exports = {
    getMonthlyComparison,
    getSpendingForecast,
    getSmartCutSuggestions,
    checkReactiveAlerts
};