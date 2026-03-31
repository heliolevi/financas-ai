/**
 * =============================================================================
 * ROTAS DE AUTENTICAÇÃO
 * =============================================================================
 * Endpoints: /api/auth/*
 * =============================================================================
 */

const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// POST /api/auth/register → Cria novo usuário
router.post('/register', authController.register);

// POST /api/auth/login → Login e retorna JWT token
router.post('/login', authController.login);

// GET /api/auth/me → Retorna dados do usuário logado (protegido)
const authMiddleware = require('../middleware/authMiddleware');
router.get('/me', authMiddleware, authController.getMe);

module.exports = router;
