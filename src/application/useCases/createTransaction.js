/**
 * =============================================================================
 * CREATE TRANSACTION USE CASE (Application Layer)
 * =============================================================================
 * Following Clean Architecture - Use Case pattern
 * Single Responsibility: Creating transactions
 */

const Transaction = require('../../domain/entities/Transaction');
const { AppError } = require('../../shared/errors/AppError');

class CreateTransactionUseCase {
    constructor(transactionRepository, categorizer) {
        this.transactionRepository = transactionRepository;
        this.categorizer = categorizer;
    }

    async execute(userId, data) {
        const { amount, description, category, payment_method, date, installments = 1 } = data;

        // Business rule: Validate amount
        if (!amount || amount <= 0) {
            throw new AppError('Valor da transação deve ser maior que zero', 400);
        }

        // Auto-categorize if needed
        const finalCategory = category && category !== 'Outros' 
            ? category 
            : this.categorizer.categorize(description);

        // Create transaction entity
        const transactions = [];
        const baseDate = new Date(date + 'T12:00:00');
        const installmentAmount = amount / installments;
        const groupId = installments > 1 
            ? `GRP-${Date.now().toString(36)}` 
            : null;

        for (let i = 0; i < installments; i++) {
            const currentMonthDate = new Date(baseDate);
            currentMonthDate.setMonth(baseDate.getMonth() + i);
            const dateStr = currentMonthDate.toISOString().split('T')[0];

            const transaction = new Transaction({
                user_id: userId,
                amount: installmentAmount,
                category: finalCategory,
                description: `${description || 'Sem descrição'}${installments > 1 ? ` (${i + 1}/${installments})` : ''}`,
                payment_method,
                date: dateStr,
                installments,
                installment_index: i + 1,
                group_id: groupId,
                autoCategorized: category !== finalCategory
            });

            const created = await this.transactionRepository.create(transaction);
            transactions.push(created);
        }

        return {
            count: transactions.length,
            category: finalCategory,
            autoCategorized: category !== finalCategory,
            transactions: transactions.map(t => t.toSummary())
        };
    }
}

module.exports = CreateTransactionUseCase;