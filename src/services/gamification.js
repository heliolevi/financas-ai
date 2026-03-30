const achievements = [
    { id: 'first_expense', name: 'Primeiro Passo', desc: 'Registre sua primeira despesa', icon: '🎯', condition: (stats) => stats.transactionCount >= 1 },
    { id: 'ten_expenses', name: 'Começando Bem', desc: 'Registre 10 despesas', icon: '📝', condition: (stats) => stats.transactionCount >= 10 },
    { id: 'fifty_expenses', name: 'Organizado', desc: 'Registre 50 despesas', icon: '🏆', condition: (stats) => stats.transactionCount >= 50 },
    { id: 'hundred_expenses', name: 'Mestre Financeiro', desc: 'Registre 100 despesas', icon: '👑', condition: (stats) => stats.transactionCount >= 100 },
    
    { id: 'first_income', name: 'Seguindo o Fluxo', desc: 'Receba dinheiro pela primeira vez', icon: '💰', condition: (stats) => stats.totalIncome > 0 },
    
    { id: 'profile_complete', name: 'Conhecendo Você', desc: 'Complete seu perfil financeiro', icon: '📋', condition: (stats) => stats.profileComplete },
    
    { id: 'goal_25', name: 'Quarto do caminho', desc: 'Alcance 25% da meta de economia', icon: '🎯', condition: (stats) => stats.savingsProgress >= 25 },
    { id: 'goal_50', name: 'Metade do caminho', desc: 'Alcance 50% da meta de economia', icon: '🚀', condition: (stats) => stats.savingsProgress >= 50 },
    { id: 'goal_100', name: 'Missão Cumprida', desc: 'Alcance 100% da meta', icon: '🏅', condition: (stats) => stats.savingsProgress >= 100 },
    
    { id: 'under_budget', name: 'Within Limits', desc: 'Termine o mês dentro do orçamento', icon: '✅', condition: (stats) => stats.budgetUsed <= 100 },
    { id: 'saved_money', name: 'Economizador', desc: 'Economize mais de R$ 100 em um mês', icon: '💎', condition: (stats) => stats.savingsCurrent > 100 },
    
    { id: 'first_subscription', name: 'Assinante', desc: 'Torne-se Lumi Pro', icon: '⭐', condition: (stats) => stats.isPro },
    { id: 'import_data', name: 'Importador', desc: 'Importe transações do banco', icon: '📥', condition: (stats) => stats.hasImported },
    
    { id: 'chat_with_lumi', name: 'Conversador', desc: 'Converse 5 vezes com a Lumi', icon: '💬', condition: (stats) => stats.chatCount >= 5 },
    { id: 'ai_insights', name: 'Analista', desc: 'Receba 3 insights da IA', icon: '🧠', condition: (stats) => stats.insightCount >= 3 },
    
    { id: 'streak_7', name: 'Consistente', desc: '7 dias registrando gastos', icon: '🔥', condition: (stats) => stats.streakDays >= 7 },
    { id: 'streak_30', name: 'Hábito Financeiro', desc: '30 dias registrando gastos', icon: '💪', condition: (stats) => stats.streakDays >= 30 },
    
    { id: 'low_card', name: 'Cartão Controlado', desc: 'Use menos de 30% do cartão', icon: '💳', condition: (stats) => stats.creditUsage < 30 },
    { id: 'no_debt', name: 'Sem Dívidas', desc: 'Não use cheque especial', icon: '🛡️', condition: (stats) => stats.bankBalance > 0 }
];

function calculateAchievements(userStats) {
    const unlocked = [];
    const available = [];
    
    for (const achievement of achievements) {
        if (achievement.condition(userStats)) {
            unlocked.push(achievement);
        } else {
            available.push(achievement);
        }
    }
    
    return { unlocked, available, progress: (unlocked.length / achievements.length) * 100 };
}

function getNextAchievements(userStats, count = 3) {
    return achievements
        .filter(a => !a.condition(userStats))
        .slice(0, count);
}

function checkNewAchievements(oldStats, newStats) {
    const newAchievements = [];
    
    for (const achievement of achievements) {
        if (!achievement.condition(oldStats) && achievement.condition(newStats)) {
            newAchievements.push(achievement);
        }
    }
    
    return newAchievements;
}

module.exports = {
    achievements,
    calculateAchievements,
    getNextAchievements,
    checkNewAchievements
};
