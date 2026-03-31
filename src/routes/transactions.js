const express = require('express');
const router = express.Router();
const transactionController = require('../controllers/transactionController');
const dailySummaryController = require('../controllers/dailySummaryController');
const verifyToken = require('../middleware/authMiddleware');

// Todas as rotas abaixo exigem autenticação (verifyToken)

// Cria uma nova transação
router.post('/', verifyToken, transactionController.addTransaction);
// Busca todas as transações do usuário logado
router.get('/', verifyToken, transactionController.getTransactions);
// Busca estatísticas para o Dashboard (totais, categorias, etc)
router.get('/stats', verifyToken, transactionController.getDashboardStats);
// Importa transações de arquivo CSV/OFX
router.post('/import', verifyToken, transactionController.importTransactions);
// Resumo diário
router.get('/daily-summary', verifyToken, dailySummaryController.getDailySummary);
// Remove uma transação específica pelo ID
router.delete('/:id', verifyToken, transactionController.deleteTransaction);

module.exports = router;
