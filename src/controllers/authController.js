const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const db = require('../config/database');
const dotenv = require('dotenv');

dotenv.config();

/**
 * Registra um novo usuário no sistema.
 * Criptografa a senha antes de salvar no SQLite.
 */
const register = (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ message: 'Usuário e senha são obrigatórios' });
    }

    // Criptografia da senha (Segurança: nunca salve senhas em texto puro!)
    const hashedPassword = bcrypt.hashSync(password, 8);

    db.run(`INSERT INTO users (username, password) VALUES (?, ?)`, [username, hashedPassword], function(err) {
        if (err) {
            return res.status(500).json({ message: 'Erro ao registrar usuário: ' + err.message });
        }
        res.status(201).json({ message: 'Usuário registrado com sucesso', userId: this.lastID });
    });
};

/**
 * Realiza o login do usuário.
 * Verifica a senha e gera um Token JWT para manter a sessão ativa.
 */
const login = (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ message: 'Usuário e senha são obrigatórios' });
    }

    // Busca o usuário pelo nome
    db.get(`SELECT * FROM users WHERE username = ?`, [username], (err, user) => {
        if (err) {
            return res.status(500).json({ message: 'Erro no servidor ao fazer login' });
        }
        if (!user) {
            return res.status(404).json({ message: 'Usuário não encontrado' });
        }

        // Compara a senha digitada com a senha criptografada no banco
        const passwordIsValid = bcrypt.compareSync(password, user.password);
        if (!passwordIsValid) {
            return res.status(401).json({ message: 'Senha inválida' });
        }

        // Gera o token JWT (Válido por 24 horas)
        // Dica: O JWT permite que o frontend prove quem é o usuário em cada requisição
        const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, {
            expiresIn: 86400 
        });

        res.status(200).json({ auth: true, token: token, username: user.username });
    });
};

module.exports = { register, login };
