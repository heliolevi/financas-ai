/**
 * =============================================================================
 * ROTAS DE PAGAMENTOS (STRIPE)
 * =============================================================================
 * Endpoints: /api/payments/*
 * =============================================================================
 */

const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const authMiddleware = require('../middleware/authMiddleware');

// POST /api/payments/create-checkout → Criar sessão de checkout (protegido)
router.post('/create-checkout', authMiddleware, paymentController.createCheckoutSession);

// Webhook configurado diretamente no app.js (rota /api/payments/webhook)
// Não precisa de authMiddleware pois quem chama é o Stripe

module.exports = router;
