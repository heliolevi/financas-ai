const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true, index: true },
    password: { type: String, required: true },
    stripeCustomerId: { type: String },
    subscriptionStatus: { type: String, default: 'inactive' },
    
    // Perfil Financeiro
    grossIncome: { type: Number, default: 0 },
    netIncome: { type: Number, default: 0 },
    bankName: { type: String, default: '' },
    bankBalance: { type: Number, default: 0 },
    creditCardLimit: { type: Number, default: 0 },
    creditCardUsed: { type: Number, default: 0 },
    creditCardBill: { type: Number, default: 0 },
    creditCardDueDate: { type: Number, default: 0 },
    fixedExpenses: [{
        name: { type: String },
        amount: { type: Number },
        dueDate: { type: Number }
    }]
});

// Middleware para comparar senhas (facilita no controller)
userSchema.methods.comparePassword = function(candidatePassword) {
    return bcrypt.compareSync(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
