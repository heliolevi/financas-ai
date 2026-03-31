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

// Rate limiting específico para payments/checkout (mais generoso)
const paymentLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 10,
    message: { message: 'Muitas requisições. Tente novamente mais tarde.' }
});

// POST /api/payments/create-checkout → Criar sessão de checkout (protegido)
router.post('/create-checkout', paymentLimiter, authMiddleware, paymentController.createCheckoutSession);

// Webhook configurado diretamente no app.js (rota /api/payments/webhook)
// Não precisa de authMiddleware pois quem chama é o Stripe

module.exports = router;
