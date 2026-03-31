/**
 * =============================================================================
 * ROTAS DE PERFIL
 * =============================================================================
 * Endpoints: /api/profile/*
 *Todas as rotas exigem autenticação (JWT)
 * =============================================================================
 */

const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/authMiddleware');
const profileController = require('../controllers/profileController');
const proactiveAlerts = require('../services/proactiveAlerts');

// GET /api/profile → Dados do perfil
router.get('/', verifyToken, profileController.getProfile);

// PUT /api/profile → Atualizar perfil
router.put('/', verifyToken, profileController.updateProfile);

// GET /api/profile/dashboard → Dados agregados do dashboard
router.get('/dashboard', verifyToken, profileController.getDashboardData);

// POST /api/profile/fixed-expenses → Adicionar despesa fixa
router.post('/fixed-expenses', verifyToken, profileController.addFixedExpense);

// DELETE /api/profile/fixed-expenses/:index → Remover despesa fixa
router.delete('/fixed-expenses/:index', verifyToken, profileController.removeFixedExpense);

// PUT /api/profile/savings → Atualizar economia atual
router.put('/savings', verifyToken, profileController.updateSavings);

// GET /api/profile/alerts → Alertas proativos
router.get('/alerts', verifyToken, async (req, res) => {
    try {
        const alerts = await proactiveAlerts.getProactiveAlerts(req.userId);
        res.json(alerts);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
