const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// Rota para registro de novo usuário
router.post('/register', authController.register);
// Rota para login de usuário existente
router.post('/login', authController.login);

// Rota para pegar dados do usuário logado
const authMiddleware = require('../middleware/authMiddleware');
router.get('/me', authMiddleware, authController.getMe);

module.exports = router;
