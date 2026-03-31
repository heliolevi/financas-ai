/**
 * =============================================================================
 * ROTAS DE TRANSAÇÕES
 * =============================================================================
 * Endpoints: /api/transactions/*
 * Todas as rotas exigem autenticação (JWT)
 * =============================================================================
 */

const express = require('express');
const router = express.Router();
const transactionController = require('../controllers/transactionController');
const dailySummaryController = require('../controllers/dailySummaryController');
const verifyToken = require('../middleware/authMiddleware');

// POST /api/transactions → Criar transação
router.post('/', verifyToken, transactionController.addTransaction);

// GET /api/transactions → Listar transações (com filtros month/year)
router.get('/', verifyToken, transactionController.getTransactions);

// GET /api/transactions/stats → Estatísticas do dashboard
router.get('/stats', verifyToken, transactionController.getDashboardStats);

// POST /api/transactions/import → Importar extrato (CSV/OFX/XML)
router.post('/import', verifyToken, transactionController.importTransactions);

// GET /api/transactions/daily-summary → Resumo do dia
router.get('/daily-summary', verifyToken, dailySummaryController.getDailySummary);

// DELETE /api/transactions/:id → Remover transação
router.delete('/:id', verifyToken, transactionController.deleteTransaction);

module.exports = router;
