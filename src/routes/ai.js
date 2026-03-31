/**
 * =============================================================================
 * ROTAS DE INTELIGÊNCIA ARTIFICIAL
 * =============================================================================
 * Endpoints: /api/ai/*
 * Todas as rotas exigem autenticação (JWT)
 * =============================================================================
 */

const express = require('express');
const router = express.Router();
const aiController = require('../controllers/aiController');
const verifyToken = require('../middleware/authMiddleware');
const rateLimit = require('express-rate-limit');

const aiLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 10,
    message: { message: 'Limite de uso da IA excedido. Aguarde um momento.' }
});

// POST /api/ai/analyze → Chat com Lumi (análise financeira)
router.post('/analyze', verifyToken, aiLimiter, aiController.analyzeFinances);

// POST /api/ai/analyze-image → Analisar nota fiscal (imagem)
router.post('/analyze-image', verifyToken, aiLimiter, aiController.analyzeImage);

// GET /api/ai/proactive → Insight proativo para dashboard
router.get('/proactive', verifyToken, aiController.getProactiveInsight);

module.exports = router;
