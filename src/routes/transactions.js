const express = require('express');
const router = express.Router();
const transactionController = require('../controllers/transactionController');
const verifyToken = require('../middleware/authMiddleware');

// Todas as rotas abaixo exigem autenticação (verifyToken)

// Cria uma nova transação
router.post('/', verifyToken, transactionController.addTransaction);
// Busca todas as transações do usuário logado
router.get('/', verifyToken, transactionController.getTransactions);
// Busca estatísticas para o Dashboard (totais, categorias, etc)
router.get('/stats', verifyToken, transactionController.getDashboardStats);
// Remove uma transação específica pelo ID
router.delete('/:id', verifyToken, transactionController.deleteTransaction);

module.exports = router;
