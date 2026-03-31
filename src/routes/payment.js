/**
 * =============================================================================
 * ROTAS DE PAGAMENTOS (STRIPE)
 * =============================================================================
 * Endpoints: /api/payments/*
 * =============================================================================
 */

const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const paymentController = require('../controllers/paymentController');
const authMiddleware = require('../middleware/authMiddleware');

// Rate limiting específico para payments/checkout - maior limite para checkout
const paymentLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 30,  // Aumentado para 30 req/min para checkout
    message: { message: 'Muitas requisições. Tente novamente mais tarde.' }
});

// Wrapper para garantir que o controller receba os parâmetros corretos
const createCheckoutHandler = (req, res, next) => {
    paymentController.createCheckoutSession(req, res).catch(next);
};

// POST /api/payments/create-checkout → Criar sessão de checkout (protegido)
router.post('/create-checkout', paymentLimiter, authMiddleware, createCheckoutHandler);

// Webhook configurado diretamente no app.js (rota /api/payments/webhook)
// Não precisa de authMiddleware pois quem chama é o Stripe

module.exports = router;
