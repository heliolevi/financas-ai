const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');

dotenv.config();

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
