const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true, index: true },
    password: { type: String, required: true },
    stripeCustomerId: { type: String },
    subscriptionStatus: { type: String, default: 'inactive' },
    
    // Perfil Financeiro
    grossIncome: { type: Number, default: 0, min: 0, validate: { validator: Number.isFinite, message: 'Renda bruta inválida' }},
    netIncome: { type: Number, default: 0, min: 0, validate: [{ validator: function(v) { return v <= this.grossIncome; }, message: 'Renda líquida não pode ser maior que a bruta' }, { validator: Number.isFinite, message: 'Renda líquida inválida' }]},
    bankName: { type: String, default: '', maxlength: 100 },
    bankBalance: { type: Number, default: 0, min: 0 },
    creditCardLimit: { type: Number, default: 0, min: 0 },
    creditCardUsed: { type: Number, default: 0, min: 0, validate: { validator: function(v) { return v <= this.creditCardLimit || this.creditCardLimit === 0; }, message: 'Valor usado não pode exceder o limite do cartão' }},
    creditCardBill: { type: Number, default: 0, min: 0 },
    creditCardDueDate: { type: Number, default: null, min: 1, max: 31 },
    fixedExpenses: [{
        name: { type: String, required: true, maxlength: 100 },
        amount: { type: Number, required: true, min: 0 },
        dueDate: { type: Number, required: true, min: 1, max: 31 }
    }],
    
    // Metas e Orçamento
    monthlyBudget: { type: Number, default: 0, min: 0 },
    savingsGoal: { type: Number, default: 0, min: 0 },
    savingsCurrent: { type: Number, default: 0, min: 0 },
    
    // Notificações
    notificationsEnabled: { type: Boolean, default: true },
    emailNotification: { type: Boolean, default: false },
    pushNotification: { type: Boolean, default: false },
    budgetAlertThreshold: { type: Number, default: 80, min: 0, max: 100 }
});

userSchema.pre('save', function(next) {
    if (this.netIncome > this.grossIncome) {
        this.netIncome = this.grossIncome;
    }
    if (this.creditCardUsed > this.creditCardLimit) {
        this.creditCardUsed = this.creditCardLimit;
    }
    next();
});

// Middleware para comparar senhas (facilita no controller)
userSchema.methods.comparePassword = function(candidatePassword) {
    return bcrypt.compareSync(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
