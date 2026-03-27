const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    amount: { type: Number, required: true },
    category: { type: String, required: true },
    description: { type: String },
    payment_method: { type: String, required: true },
    date: { type: String, required: true }, // Mantendo String para formato YYYY-MM-DD
    installments: { type: Number, default: 1 },
    installment_index: { type: Number, default: 1 },
    timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Transaction', transactionSchema);
