/**
 * =============================================================================
 * ROTAS DE PAGAMENTOS (STRIPE)
 * =============================================================================
 */

const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const authMiddleware = require('../middleware/authMiddleware');

// POST /api/payments/create-checkout
router.post('/create-checkout', authMiddleware, async (req, res) => {
    console.log('🔄 Rota /create-checkout chamada');
    
    try {
        // Chama o controller diretamente
        const result = await paymentController.createCheckoutSession(req, res);
        return result;
    } catch (err) {
        console.error('❌ Erro na rota:', err);
        return res.status(500).json({ message: 'Erro interno: ' + err.message });
    }
});

module.exports = router;