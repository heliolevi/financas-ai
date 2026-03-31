const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    amount: { type: Number, required: true },
    category: { type: String, required: true },
    description: { type: String },
    payment_method: { type: String, required: true },
    date: { type: String, required: true },
    installments: { type: Number, default: 1 },
    installment_index: { type: Number, default: 1 },
    group_id: { type: String },
    timestamp: { type: Date, default: Date.now },
    autoCategorized: { type: Boolean, default: false },
    importHash: { type: String, index: true }
});

module.exports = mongoose.model('Transaction', transactionSchema);
