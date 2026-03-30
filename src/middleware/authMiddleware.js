const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');

dotenv.config();

const verifyToken = (req, res, next) => {
    const token = req.headers['authorization'];
    if (!token) {
        return res.status(403).json({ message: 'No token provided' });
    }

    // Usually "Bearer TOKEN"
    const bearerToken = token.split(' ')[1] || token;

    jwt.verify(bearerToken, process.env.JWT_SECRET, (err, decoded) => {
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
