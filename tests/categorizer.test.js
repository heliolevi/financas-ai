const { categorize, suggestCategory, categoryRules } = require('../src/services/categorizer');

describe('Categorizador de Transações', () => {
    describe('categorize', () => {
        test('deve categorizar iFood como Alimentação', () => {
            expect(categorize('iFood - Jantar')).toBe('Alimentação');
        });

        test('deve categorizar Uber como Transporte', () => {
            expect(categorize('Uber - Corrida')).toBe('Transporte');
        });

        test('deve categorizar Netflix como Lazer', () => {
            expect(categorize('Netflix mensal')).toBe('Lazer');
        });

        test('deve categorizar Aluguel como Moradia', () => {
            expect(categorize('Aluguel Março')).toBe('Moradia');
        });

        test('deve categorizar Farmácia como Saúde', () => {
            expect(categorize('Farmácia Pague Menos')).toBe('Saúde');
        });

        test('deve categorizar Curso como Educação', () => {
            expect(categorize('Curso de Inglês')).toBe('Educação');
        });

        test('deve retornar Outros para descrição desconhecida', () => {
            expect(categorize('Compra aleatória XYZ')).toBe('Outros');
        });

        test('deve retornar Outros para descrição vazia', () => {
            expect(categorize('')).toBe('Outros');
        });

        test('deve retornar Outros para descrição null', () => {
            expect(categorize(null)).toBe('Outros');
        });

        test('deve categorizar pizza como Alimentação', () => {
            expect(categorize('Pizza Hut')).toBe('Alimentação');
        });

        test('deve categorizar posto de gasolina como Transporte', () => {
            expect(categorize('Posto Shell')).toBe('Transporte');
        });
    });

    describe('suggestCategory', () => {
        test('deve retornar categoria sugerida com confiança alta', () => {
            const result = suggestCategory('iFood');
            expect(result.suggested).toBe('Alimentação');
            expect(result.confidence).toBe(0.9);
        });

        test('deve retornar categoria Outros com confiança baixa', () => {
            const result = suggestCategory('coisa nenhuma');
            expect(result.suggested).toBe('Outros');
            expect(result.confidence).toBe(0.5);
        });
    });

    describe('categoryRules', () => {
        test('deve ter regras para todas as categorias principais', () => {
            expect(categoryRules).toHaveProperty('Alimentação');
            expect(categoryRules).toHaveProperty('Transporte');
            expect(categoryRules).toHaveProperty('Lazer');
            expect(categoryRules).toHaveProperty('Moradia');
            expect(categoryRules).toHaveProperty('Saúde');
            expect(categoryRules).toHaveProperty('Educação');
            expect(categoryRules).toHaveProperty('Outros');
        });

        test('deve ter palavras-chave para Alimentação', () => {
            expect(categoryRules.Alimentação).toContain('ifood');
            expect(categoryRules.Alimentação).toContain('supermercado');
        });

        test('deve ter palavras-chave para Transporte', () => {
            expect(categoryRules.Transporte).toContain('uber');
            expect(categoryRules.Transporte).toContain('combustível');
        });
    });
});
