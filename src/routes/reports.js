const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const authMiddleware = require('../middleware/authMiddleware');

// Rotas protegidas (apenas usuários logados e Pro podem exportar)
// Nota: O bloqueio de "Pro" será validado aqui também para segurança
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

router.get('/pdf', authMiddleware, checkPro, reportController.exportPDF);
router.get('/excel', authMiddleware, checkPro, reportController.exportExcel);

module.exports = router;
