const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const authMiddleware = require('../middleware/authMiddleware');

// Rota para criar o checkout (protegida por login)
router.post('/create-checkout', authMiddleware, paymentController.createCheckoutSession);

// Rota do Webhook (NÃO deve ter authMiddleware pois quem chama é o Stripe)
// IMPORTANTE: Esta rota precisa receber o body como stream/buffer no app.js
router.post('/webhook', express.raw({ type: 'application/json' }), paymentController.webhook);

module.exports = router;
