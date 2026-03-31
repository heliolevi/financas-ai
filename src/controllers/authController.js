/**
 * =============================================================================
 * CONTROLADOR DE AUTENTICAÇÃO
 * =============================================================================
 * Responsável por: Registro, Login, e recuperação de dados do usuário.
 * JWT token é gerado com validade de 24h.
 * =============================================================================
 */

const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const dotenv = require('dotenv');

dotenv.config();

/**
 * Registra um novo usuário no sistema.
 * Validausername mínimo 3 caracteres e senha mínimo 6 caracteres.
 * Hash da senha é gerado com bcrypt (8 rounds).
 * 
 * @param {Object} req - Requisição com { username, password }
 * @param {Object} res - Resposta HTTP
 */
const register = async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ message: 'Usuário e senha são obrigatórios' });
    }

    if (password.length < 6) {
        return res.status(400).json({ message: 'A senha deve ter pelo menos 6 caracteres' });
    }

    try {
        // Verifica se usuário já existe
        const existingUser = await User.findOne({ username });
        if (existingUser) {
            return res.status(400).json({ message: 'Este nome de usuário já está em uso' });
        }

        // Criptografia da senha (8 rounds = bom equilíbrio segurança/performance)
        const hashedPassword = bcrypt.hashSync(password, 8);

        const newUser = new User({
            username,
            password: hashedPassword
        });

        await newUser.save();
        res.status(201).json({ message: 'Usuário registrado com sucesso', userId: newUser._id });
    } catch (err) {
        res.status(500).json({ message: 'Erro ao registrar usuário: ' + err.message });
    }
};

/**
 * Realiza o login do usuário.
 * Valida credenciais e retorna JWT token com dados do usuário.
 * 
 * @param {Object} req - Requisição com { username, password }
 * @param {Object} res - Resposta HTTP com { token, username, subscriptionStatus }
 */
const login = async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ message: 'Usuário e senha são obrigatórios' });
    }

    try {
        const user = await User.findOne({ username });
        if (!user) {
            return res.status(404).json({ message: 'Usuário não encontrado' });
        }

        const passwordIsValid = user.comparePassword(password);
        if (!passwordIsValid) {
            return res.status(401).json({ message: 'Senha inválida' });
        }

        // Gera token JWT com ID do usuário (validade 24h = 86400 segundos)
        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
            expiresIn: 86400 
        });

        res.status(200).json({ 
            auth: true, 
            token, 
            username: user.username,
            subscriptionStatus: user.subscriptionStatus
        });
    } catch (err) {
        res.status(500).json({ message: 'Erro no servidor ao fazer login' });
    }
};

/**
 * Retorna os dados do usuário logado (útil para atualizar o status Pro).
 * Remove o campo password da resposta por segurança.
 * 
 * @param {Object} req - Requisição com userId anexado pelo middleware
 * @param {Object} res - Resposta HTTP com dados do usuário
 */
const getMe = async (req, res) => {
    try {
        const user = await User.findById(req.userId).select('-password');
        res.json(user);
    } catch (err) {
        res.status(500).json({ message: 'Erro ao buscar dados do usuário' });
    }
};

module.exports = { register, login, getMe };
