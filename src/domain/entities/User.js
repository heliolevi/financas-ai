/**
 * =============================================================================
 * USER ENTITY (Domain Layer)
 * =============================================================================
 * Following DDD - Entity with business rules encapsulated
 */

class User {
    constructor(data = {}) {
        this._id = data._id;
        this.username = data.username;
        this.password = data.password;
        this.grossIncome = data.grossIncome || 0;
        this.netIncome = data.netIncome || 0;
        this.bankName = data.bankName || '';
        this.bankBalance = data.bankBalance || 0;
        this.creditCardLimit = data.creditCardLimit || 0;
        this.creditCardUsed = data.creditCardUsed || 0;
        this.creditCardBill = data.creditCardBill || 0;
        this.creditCardDueDate = data.creditCardDueDate || null;
        this.fixedExpenses = data.fixedExpenses || [];
        this.monthlyBudget = data.monthlyBudget || 0;
        this.savingsGoal = data.savingsGoal || 0;
        this.savingsCurrent = data.savingsCurrent || 0;
        this.subscriptionStatus = data.subscriptionStatus || 'inactive';
        this.stripeCustomerId = data.stripeCustomerId || null;
        this.subscriptionId = data.subscriptionId || null;
        this.createdAt = data.createdAt || new Date();
        this.updatedAt = data.updatedAt || new Date();
    }

    // Business rules
    isPro() {
        return this.subscriptionStatus === 'active';
    }

    canAccessPremium() {
        const isCreator = this.username === 'helio.vieira' || this.username === 'admin';
        return this.isPro() || isCreator;
    }

    getCommitmentRate(monthlySpent) {
        if (this.netIncome <= 0) return 0;
        return ((monthlySpent + this.getFixedExpensesTotal()) / this.netIncome) * 100;
    }

    getFixedExpensesTotal() {
        return this.fixedExpenses.reduce((sum, exp) => sum + exp.amount, 0);
    }

    getCreditUsage() {
        if (this.creditCardLimit <= 0) return 0;
        return (this.creditCardUsed / this.creditCardLimit) * 100;
    }

    getSavingsProgress() {
        if (this.savingsGoal <= 0) return 0;
        return (this.savingsCurrent / this.savingsGoal) * 100;
    }

    toJSON() {
        return {
            id: this._id,
            username: this.username,
            grossIncome: this.grossIncome,
            netIncome: this.netIncome,
            bankName: this.bankName,
            bankBalance: this.bankBalance,
            creditCardLimit: this.creditCardLimit,
            creditCardUsed: this.creditCardUsed,
            creditCardBill: this.creditCardBill,
            creditCardDueDate: this.creditCardDueDate,
            fixedExpenses: this.fixedExpenses,
            monthlyBudget: this.monthlyBudget,
            savingsGoal: this.savingsGoal,
            savingsCurrent: this.savingsCurrent,
            subscriptionStatus: this.subscriptionStatus
        };
    }
}

module.exports = User;