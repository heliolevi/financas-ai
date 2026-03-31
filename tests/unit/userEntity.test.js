/**
 * =============================================================================
 * UNIT TESTS - User Entity (TDD)
 * =============================================================================
 * Following TDD principles - tests written before implementation
 */

const User = require('../../src/domain/entities/User');

describe('User Entity', () => {
    describe('Instantiation', () => {
        test('should create user with default values', () => {
            const user = new User();
            expect(user.grossIncome).toBe(0);
            expect(user.netIncome).toBe(0);
            expect(user.subscriptionStatus).toBe('inactive');
        });

        test('should create user with provided data', () => {
            const user = new User({
                username: 'testuser',
                grossIncome: 5000,
                netIncome: 4000,
                subscriptionStatus: 'active'
            });
            expect(user.username).toBe('testuser');
            expect(user.grossIncome).toBe(5000);
            expect(user.subscriptionStatus).toBe('active');
        });
    });

    describe('Business Rules', () => {
        test('isPro() should return true when subscription is active', () => {
            const user = new User({ subscriptionStatus: 'active' });
            expect(user.isPro()).toBe(true);
        });

        test('isPro() should return false when subscription is not active', () => {
            const user = new User({ subscriptionStatus: 'inactive' });
            expect(user.isPro()).toBe(false);
        });

        test('canAccessPremium() should return true for pro users', () => {
            const user = new User({ username: 'regular', subscriptionStatus: 'active' });
            expect(user.canAccessPremium()).toBe(true);
        });

        test('canAccessPremium() should return true for creator/admin', () => {
            const user = new User({ username: 'helio.vieira', subscriptionStatus: 'inactive' });
            expect(user.canAccessPremium()).toBe(true);
        });

        test('getFixedExpensesTotal() should calculate total correctly', () => {
            const user = new User({
                fixedExpenses: [
                    { name: 'Aluguel', amount: 1500 },
                    { name: 'Internet', amount: 100 }
                ]
            });
            expect(user.getFixedExpensesTotal()).toBe(1600);
        });

        test('getCreditUsage() should calculate percentage correctly', () => {
            const user = new User({
                creditCardLimit: 2000,
                creditCardUsed: 500
            });
            expect(user.getCreditUsage()).toBe(25);
        });

        test('getCreditUsage() should return 0 when no limit', () => {
            const user = new User({ creditCardLimit: 0, creditCardUsed: 100 });
            expect(user.getCreditUsage()).toBe(0);
        });

        test('getSavingsProgress() should calculate percentage correctly', () => {
            const user = new User({
                savingsGoal: 1000,
                savingsCurrent: 500
            });
            expect(user.getSavingsProgress()).toBe(50);
        });
    });

    describe('toJSON()', () => {
        test('should return clean object without password', () => {
            const user = new User({
                _id: '123',
                username: 'test',
                password: 'secret',
                grossIncome: 5000
            });
            const json = user.toJSON();
            expect(json.password).toBeUndefined();
            expect(json.username).toBe('test');
        });
    });
});