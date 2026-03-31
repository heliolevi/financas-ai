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
// Removido rate limiter temporariamente para testar
router.post('/create-checkout', authMiddleware, async (req, res) => {
    try {
        await paymentController.createCheckoutSession(req, res);
    } catch (err) {
        console.error('Erro no checkout:', err);
        res.status(500).json({ message: 'Erro ao iniciar pagamento: ' + err.message });
    }
});

// Webhook configurado diretamente no app.js (rota /api/payments/webhook)
// Não precisa de authMiddleware pois quem chama é o Stripe

module.exports = router;
