/**
 * =============================================================================
 * TRANSACTION ENTITY (Domain Layer)
 * =============================================================================
 * Following DDD - Entity with business rules encapsulated
 */

class Transaction {
    constructor(data = {}) {
        this._id = data._id;
        this.user_id = data.user_id;
        this.amount = data.amount || 0;
        this.category = data.category || 'Outros';
        this.description = data.description || '';
        this.payment_method = data.payment_method || 'Dinheiro';
        this.date = data.date || new Date().toISOString().split('T')[0];
        this.installments = data.installments || 1;
        this.installment_index = data.installment_index || 1;
        this.group_id = data.group_id || null;
        this.imported = data.imported || false;
        this.importHash = data.importHash || null;
        this.autoCategorized = data.autoCategorized || false;
        this.createdAt = data.createdAt || new Date();
        this.timestamp = data.timestamp || Date.now();
    }

    // Business rules
    isParcelada() {
        return this.group_id !== null && this.installments > 1;
    }

    getParcelaAtual() {
        return `${this.installment_index}/${this.installments}`;
    }

    isDespesa() {
        return this.amount > 0;
    }

    isReceita() {
        return this.amount < 0;
    }

    toSummary() {
        return {
            id: this._id,
            amount: this.amount,
            category: this.category,
            description: this.description,
            payment_method: this.payment_method,
            date: this.date,
            group_id: this.group_id
        };
    }
}

module.exports = Transaction;