const express = require('express');
const router = express.Router();
const aiController = require('../controllers/aiController');
const verifyToken = require('../middleware/authMiddleware');

// Envia uma mensagem para a IA (Lumi) analisar ou registrar gastos
router.post('/analyze', verifyToken, aiController.analyzeFinances);

module.exports = router;
