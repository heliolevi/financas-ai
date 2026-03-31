/**
 * =============================================================================
 * MODELO DE USUÁRIO (MONGODB SCHEMA)
 * =============================================================================
 * Armazena dados do usuário, perfil financeiro, metas e configurações.
 * Campos sensíveis são protegidos e validados antes da persistência.
 * =============================================================================
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    // Dados de autenticação
    username: { type: String, required: true, unique: true, index: true },
    password: { type: String, required: true },
    
    // Dados do Stripe (assinatura)
    stripeCustomerId: { type: String },
    subscriptionStatus: { type: String, default: 'inactive' },
    
    // ==========================================
    // PERFIL FINANCEIRO
    // ==========================================
    grossIncome: { type: Number, default: 0, min: 0 },      // Renda bruta mensal
    netIncome: { type: Number, default: 0, min: 0 },      // Renda líquida mensal
    bankName: { type: String, default: '', maxlength: 100 }, // Nome do banco
    bankBalance: { type: Number, default: 0, min: 0 },     // Saldo atual
    
    // Cartão de crédito
    creditCardLimit: { type: Number, default: 0, min: 0 },
    creditCardUsed: { type: Number, default: 0, min: 0 },
    creditCardBill: { type: Number, default: 0, min: 0 },
    creditCardDueDate: { type: Number, default: null },   // Dia do vencimento (1-31)
    
    // Despesas fixas mensais
    fixedExpenses: [{
        name: { type: String, required: true, maxlength: 100 },
        amount: { type: Number, required: true, min: 0 },
        dueDate: { type: Number, required: true, min: 1, max: 31 }
    }],
    
    // ==========================================
    // METAS E ORÇAMENTO
    // ==========================================
    monthlyBudget: { type: Number, default: 0, min: 0 },   // Limite mensal
    savingsGoal: { type: Number, default: 0, min: 0 },     // Meta de economia
    savingsCurrent: { type: Number, default: 0, min: 0 },  // Economia atual
    
    // ==========================================
    // NOTIFICAÇÕES
    // ==========================================
    notificationsEnabled: { type: Boolean, default: true },
    emailNotification: { type: Boolean, default: false },
    pushNotification: { type: Boolean, default: false },
    budgetAlertThreshold: { type: Number, default: 80, min: 0, max: 100 } // % para alerta
});

/**
 * Hook pré-gravação: valida e normaliza dados.
 * Sintaxe corrigida para Mongoose 9.x
 */
userSchema.pre('save', function() {
    // Garante que renda líquida não seja maior que bruta
    if (this.netIncome > this.grossIncome) {
        this.netIncome = this.grossIncome;
    }
    // Garante que usado não exceda o limite
    if (this.creditCardUsed > this.creditCardLimit) {
        this.creditCardUsed = this.creditCardLimit;
    }
    // Não precisa chamar next() no Mongoose 9+
});

/**
 * Compara a senha informada com o hash armazenado.
 * @param {string} candidatePassword - Senha em texto puro
 * @returns {boolean} True se a senha estiver correta
 */
userSchema.methods.comparePassword = function(candidatePassword) {
    return bcrypt.compareSync(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
