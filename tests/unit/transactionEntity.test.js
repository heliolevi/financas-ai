/**
 * =============================================================================
 * UNIT TESTS - Transaction Entity (TDD)
 * =============================================================================
 */

const Transaction = require('../../src/domain/entities/Transaction');

describe('Transaction Entity', () => {
    describe('Instantiation', () => {
        test('should create transaction with default values', () => {
            const t = new Transaction();
            expect(t.amount).toBe(0);
            expect(t.category).toBe('Outros');
            expect(t.payment_method).toBe('Dinheiro');
            expect(t.installments).toBe(1);
        });

        test('should create transaction with provided data', () => {
            const t = new Transaction({
                amount: 150.50,
                category: 'Alimentação',
                description: 'Supermercado',
                payment_method: 'Cartão de Crédito'
            });
            expect(t.amount).toBe(150.50);
            expect(t.category).toBe('Alimentação');
            expect(t.description).toBe('Supermercado');
        });
    });

    describe('Business Rules', () => {
        test('isParcelada() should return true when has group_id and installments > 1', () => {
            const t = new Transaction({ group_id: 'GRP-123', installments: 3 });
            expect(t.isParcelada()).toBe(true);
        });

        test('isParcelada() should return false when not parcelada', () => {
            const t = new Transaction({ group_id: null, installments: 1 });
            expect(t.isParcelada()).toBe(false);
        });

        test('getParcelaAtual() should return correct format', () => {
            const t = new Transaction({ installments: 3, installment_index: 2 });
            expect(t.getParcelaAtual()).toBe('2/3');
        });

        test('isDespesa() should return true for positive amounts', () => {
            const t = new Transaction({ amount: 100 });
            expect(t.isDespesa()).toBe(true);
        });

        test('toSummary() should return simplified object', () => {
            const t = new Transaction({
                _id: '123',
                amount: 50,
                category: 'Lazer',
                description: 'Cinema',
                payment_method: 'Pix',
                date: '2026-03-31',
                group_id: null
            });
            const summary = t.toSummary();
            expect(summary.id).toBe('123');
            expect(summary.amount).toBe(50);
            expect(summary._id).toBeUndefined();
        });
    });
});