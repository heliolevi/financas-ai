/**
 * =============================================================================
 * ROTAS DE ANALYTICS
 * =============================================================================
 * Endpoints: /api/analytics/*
 * Todas as rotas exigem autenticação (JWT)
 * =============================================================================
 */

const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/authMiddleware');
const analyticsController = require('../controllers/analyticsController');

// GET /api/analytics/predict → Previsão de gastos
router.get('/predict', verifyToken, analyticsController.predictExpenses);

// GET /api/analytics/subscriptions → Detectar assinaturas recorrentes
router.get('/subscriptions', verifyToken, analyticsController.detectSubscriptions);

// GET /api/analytics/ai-insight → Insight rápido via IA
router.get('/ai-insight', verifyToken, analyticsController.getAIInsight);

module.exports = router;
