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

// POST /api/ai/analyze → Chat com Lumi (análise financeira)
router.post('/analyze', verifyToken, aiController.analyzeFinances);

// POST /api/ai/analyze-image → Analisar nota fiscal (imagem)
router.post('/analyze-image', verifyToken, aiController.analyzeImage);

// GET /api/ai/proactive → Insight proativo para dashboard
router.get('/proactive', verifyToken, aiController.getProactiveInsight);

module.exports = router;
