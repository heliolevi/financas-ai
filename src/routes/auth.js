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
const rateLimit = require('express-rate-limit');

const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: { message: 'Muitas tentativas de login. Tente novamente em 15 minutos.' }
});

const registerLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 3,
    message: { message: 'Muitas tentativas de registro. Tente novamente mais tarde.' }
});

// POST /api/auth/register → Cria novo usuário
router.post('/register', registerLimiter, authController.register);

// POST /api/auth/login → Login e retorna JWT token
router.post('/login', loginLimiter, authController.login);

// GET /api/auth/me → Retorna dados do usuário logado (protegido)
const authMiddleware = require('../middleware/authMiddleware');
router.get('/me', authMiddleware, authController.getMe);

module.exports = router;
