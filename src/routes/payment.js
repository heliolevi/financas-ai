const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const authMiddleware = require('../middleware/authMiddleware');

// Rota para criar o checkout (protegida por login)
router.post('/create-checkout', authMiddleware, paymentController.createCheckoutSession);

// Rota do Webhook (NÃO deve ter authMiddleware pois quem chama é o Stripe)
// O middleware raw está configurado diretamente no app.js para esta rota
// router.post('/webhook', ...) - descomentar se quiser usar a rota antiga
// O webhook correto agora está em /api/payments/webhook via app.js

module.exports = router;
