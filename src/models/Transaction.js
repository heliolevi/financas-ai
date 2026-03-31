/**
 * =============================================================================
 * MODELO DE TRANSAÇÃO (MONGODB SCHEMA)
 * =============================================================================
 * Armazena cada transação financeira do usuário (gastos, compras parceladas).
 * Inclui campos para detecção de duplicatas e categorização automática.
 * =============================================================================
 */

const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
    // Referência ao usuário dono da transação
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    
    // Dados da transação
    amount: { type: Number, required: true },
    category: { type: String, required: true },
    description: { type: String },
    payment_method: { type: String, required: true },
    date: { type: String, required: true },
    
    // Parcelamento
    installments: { type: Number, default: 1 },
    installment_index: { type: Number, default: 1 },
    group_id: { type: String },  // Agrupa parcelas da mesma compra
    
    // Metadados
    timestamp: { type: Date, default: Date.now },
    autoCategorized: { type: Boolean, default: false },
    importHash: { type: String, index: true }  // Hash para evitar duplicatas na importação
});

module.exports = mongoose.model('Transaction', transactionSchema);
