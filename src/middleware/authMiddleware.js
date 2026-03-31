/**
 * =============================================================================
 * MIDDLEWARE DE AUTENTICAÇÃO JWT
 * =============================================================================
 * Verifica se o token JWT enviado no header Authorization é válido.
 * Extrai o userId do token para ser usado nas rotas protegidas.
 * =============================================================================
 */

const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');

dotenv.config();

/**
 * Verifica o token JWT e anexa o userId ao request.
 * @param {Object} req - Objeto de requisição do Express
 * @param {Object} res - Objeto de resposta do Express
 * @param {Function} next - Função next do middleware
 */
const verifyToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    
    if (!authHeader) {
        return res.status(403).json({ message: 'No token provided' });
    }

    let token;
    if (authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
    } else if (authHeader.length > 20) {
        token = authHeader;
    } else {
        return res.status(401).json({ message: 'Invalid authorization header format' });
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        if (err) {
            if (err.name === 'TokenExpiredError') {
                return res.status(401).json({ message: 'Sessão expirada. Por favor, faça login novamente.' });
            }
            return res.status(401).json({ message: 'Acesso negado. Token inválido.' });
        }
        req.userId = decoded.id;
        next();
    });
};

module.exports = verifyToken;
