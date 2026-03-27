const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const dotenv = require('dotenv');

dotenv.config();

/**
 * Registra um novo usuário no sistema.
 */
const register = async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ message: 'Usuário e senha são obrigatórios' });
    }

    try {
        // Verifica se usuário já existe
        const existingUser = await User.findOne({ username });
        if (existingUser) {
            return res.status(400).json({ message: 'Este nome de usuário já está em uso' });
        }

        // Criptografia da senha
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

        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
            expiresIn: 86400 
        });

        res.status(200).json({ auth: true, token, username: user.username });
    } catch (err) {
        res.status(500).json({ message: 'Erro no servidor ao fazer login' });
    }
};

module.exports = { register, login };
