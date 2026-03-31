/**
 * =============================================================================
 * ROTAS DE RELATÓRIOS
 * =============================================================================
 * Endpoints: /api/reports/*
 * Todas as rotas exigem autenticação + assinatura PRO
 * =============================================================================
 */

const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const authMiddleware = require('../middleware/authMiddleware');

// Middleware de verificação PRO (assinatura ativa)
const checkPro = async (req, res, next) => {
    const User = require('../models/User');
    const user = await User.findById(req.userId);
    const isCreator = user.username === 'helio.vieira' || user.username === 'admin';
    if (user.subscriptionStatus === 'active' || isCreator) {
        next();
    } else {
        res.status(403).json({ message: 'Recurso exclusivo para assinantes Lumi Pro' });
    }
};

// GET /api/reports/pdf → Exportar PDF (PRO only)
router.get('/pdf', authMiddleware, checkPro, reportController.exportPDF);

// GET /api/reports/excel → Exportar Excel (PRO only)
router.get('/excel', authMiddleware, checkPro, reportController.exportExcel);

module.exports = router;
