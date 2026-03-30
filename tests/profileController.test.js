const generateAlerts = (user, totalWithFixed, creditUsage, commitmentRate) => {
    const alerts = [];
    
    if (user.creditCardLimit > 0 && creditUsage > 70) {
        alerts.push({ type: 'danger', message: `Uso do cartão está em ${creditUsage.toFixed(0)}%! Considere reduzir.` });
    } else if (user.creditCardLimit > 0 && creditUsage > 50) {
        alerts.push({ type: 'warning', message: `Cartão está em ${creditUsage.toFixed(0)}%. Atenção!` });
    }

    if (user.monthlyBudget > 0 && totalWithFixed > user.monthlyBudget) {
        alerts.push({ type: 'danger', message: 'Você ultrapassou o orçamento mensal!' });
    } else if (user.monthlyBudget > 0 && totalWithFixed > user.monthlyBudget * (user.budgetAlertThreshold / 100)) {
        alerts.push({ type: 'warning', message: `Você já用了 ${((totalWithFixed / user.monthlyBudget) * 100).toFixed(0)}% do orçamento.` });
    }

    if (commitmentRate > 75) {
        alerts.push({ type: 'danger', message: `Comprometimento de renda crítico: ${commitmentRate.toFixed(0)}%` });
    } else if (commitmentRate > 50) {
        alerts.push({ type: 'warning', message: `Comprometimento de renda alto: ${commitmentRate.toFixed(0)}%` });
    }

    return alerts;
};

describe('Funções de Alerta', () => {
    describe('generateAlerts', () => {
        test('deve gerar alerta de perigo quando cartão usado > 70%', () => {
            const user = { creditCardLimit: 1000, monthlyBudget: 0, budgetAlertThreshold: 80 };
            const alerts = generateAlerts(user, 0, 75, 0);
            expect(alerts).toHaveLength(1);
            expect(alerts[0].type).toBe('danger');
            expect(alerts[0].message).toContain('75%');
        });

        test('deve gerar alerta de atenção quando cartão usado > 50%', () => {
            const user = { creditCardLimit: 1000, monthlyBudget: 0, budgetAlertThreshold: 80 };
            const alerts = generateAlerts(user, 0, 55, 0);
            expect(alerts).toHaveLength(1);
            expect(alerts[0].type).toBe('warning');
        });

        test('deve gerar alerta de orçamento excedido', () => {
            const user = { creditCardLimit: 0, monthlyBudget: 1000, budgetAlertThreshold: 80 };
            const alerts = generateAlerts(user, 1200, 0, 0);
            expect(alerts).toHaveLength(1);
            expect(alerts[0].type).toBe('danger');
            expect(alerts[0].message).toContain('orçamento');
        });

        test('deve gerar alerta de comprometimento crítico > 75%', () => {
            const user = { creditCardLimit: 0, monthlyBudget: 0, budgetAlertThreshold: 80 };
            const alerts = generateAlerts(user, 0, 0, 80);
            expect(alerts).toHaveLength(1);
            expect(alerts[0].type).toBe('danger');
            expect(alerts[0].message).toContain('80%');
        });

        test('deve gerar alerta de comprometimento alto > 50%', () => {
            const user = { creditCardLimit: 0, monthlyBudget: 0, budgetAlertThreshold: 80 };
            const alerts = generateAlerts(user, 0, 0, 60);
            expect(alerts).toHaveLength(1);
            expect(alerts[0].type).toBe('warning');
        });

        test('não deve gerar alertas quando tudo ok', () => {
            const user = { creditCardLimit: 5000, monthlyBudget: 5000, budgetAlertThreshold: 80 };
            const alerts = generateAlerts(user, 1000, 10, 30);
            expect(alerts).toHaveLength(0);
        });

        test('deve gerar múltiplos alertas quando necessário', () => {
            const user = { creditCardLimit: 1000, monthlyBudget: 1000, budgetAlertThreshold: 80 };
            const alerts = generateAlerts(user, 1500, 80, 85);
            expect(alerts.length).toBeGreaterThanOrEqual(2);
        });
    });
});
