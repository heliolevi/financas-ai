/**
 * =============================================================================
 * VALIDATORS (Joi Schemas)
 * =============================================================================
 * Following Clean Code - validation should be declarative and reusable
 */

const Joi = require('joi');

const authSchemas = {
    register: Joi.object({
        username: Joi.string().min(3).max(50).required().messages({
            'string.min': 'Nome de usuário deve ter no mínimo 3 caracteres',
            'string.max': 'Nome de usuário deve ter no máximo 50 caracteres',
            'any.required': 'Nome de usuário é obrigatório'
        }),
        password: Joi.string().min(6).max(100).required().messages({
            'string.min': 'Senha deve ter no mínimo 6 caracteres',
            'string.max': 'Senha deve ter no máximo 100 caracteres',
            'any.required': 'Senha é obrigatória'
        })
    }),

    login: Joi.object({
        username: Joi.string().required(),
        password: Joi.string().required()
    })
};

const transactionSchemas = {
    create: Joi.object({
        amount: Joi.number().positive().required().messages({
            'number.positive': 'Valor deve ser maior que zero',
            'any.required': 'Valor é obrigatório'
        }),
        description: Joi.string().max(200).allow(''),
        category: Joi.string().valid(
            'Alimentação', 'Transporte', 'Lazer', 'Compras', 
            'Contas', 'Saúde', 'Educação', 'Outros'
        ),
        payment_method: Joi.string().valid(
            'Cartão de Crédito', 'Dinheiro', 'Débito', 'Pix', 'Transferência'
        ).required(),
        date: Joi.date().iso().required(),
        installments: Joi.number().integer().min(1).max(24).default(1)
    }),

    update: Joi.object({
        amount: Joi.number().positive(),
        description: Joi.string().max(200),
        category: Joi.string().valid(
            'Alimentação', 'Transporte', 'Lazer', 'Compras', 
            'Contas', 'Saúde', 'Educação', 'Outros'
        ),
        payment_method: Joi.string().valid(
            'Cartão de Crédito', 'Dinheiro', 'Débito', 'Pix', 'Transferência'
        )
    })
};

const profileSchemas = {
    update: Joi.object({
        grossIncome: Joi.number().min(0).default(0),
        netIncome: Joi.number().min(0).default(0),
        bankName: Joi.string().max(100).allow(''),
        bankBalance: Joi.number().default(0),
        creditCardLimit: Joi.number().min(0).default(0),
        creditCardUsed: Joi.number().min(0).default(0),
        creditCardBill: Joi.number().min(0).default(0),
        creditCardDueDate: Joi.number().integer().min(1).max(31),
        fixedExpenses: Joi.array().items(
            Joi.object({
                name: Joi.string().required(),
                amount: Joi.number().positive().required(),
                dueDate: Joi.number().integer().min(1).max(31).required()
            })
        ),
        monthlyBudget: Joi.number().min(0).default(0),
        savingsGoal: Joi.number().min(0).default(0),
        savingsCurrent: Joi.number().min(0).default(0)
    }).or('grossIncome', 'netIncome', 'bankName')
};

const aiSchemas = {
    analyze: Joi.object({
        message: Joi.string().min(1).max(5000).required().messages({
            'string.min': 'Mensagem não pode estar vazia',
            'string.max': 'Mensagem deve ter no máximo 5000 caracteres',
            'any.required': 'Mensagem é obrigatória'
        })
    }),

    analyzeImage: Joi.object({
        image: Joi.string().uri().required()
    })
};

module.exports = {
    authSchemas,
    transactionSchemas,
    profileSchemas,
    aiSchemas
};