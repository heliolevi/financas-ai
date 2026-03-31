/**
 * =============================================================================
 * CONEXÃO COM MONGODB ATLAS
 * =============================================================================
 * MongoDB é um banco de dados NoSQL baseado em documentos,
 * excelente para persistência na nuvem (Netlify/Render/Heroku).
 * =============================================================================
 */

const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

const REQUIRED_ENV_VARS = ['JWT_SECRET', 'MONGODB_URI'];
const OPTIONAL_ENV_VARS = ['GROQ_API_KEY', 'STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'STRIPE_PRICE_ID', 'FRONTEND_URL'];

function validateEnvVars() {
    const missing = REQUIRED_ENV_VARS.filter(v => !process.env[v]);
    if (missing.length > 0) {
        console.warn(`⚠️ AVISO: Variáveis de ambiente obrigatórias não definidas: ${missing.join(', ')}`);
    }
    
    OPTIONAL_ENV_VARS.forEach(v => {
        if (!process.env[v]) {
            console.warn(`⚠️ AVISO: Variável opcional não definida: ${v}`);
        }
    });
    
    if (process.env.JWT_SECRET === 'supersecretkey_change_me') {
        console.warn('⚠️ AVISO: JWT_SECRET está usando valor padrão! Altere em produção.');
    }
}

validateEnvVars();

/**
 * Estabelece conexão com o MongoDB usando a URI do arquivo .env.
 * @returns {Promise<void>}
 */
const connectDB = async () => {
    try {
        const uri = process.env.MONGODB_URI;
        if (!uri) {
            throw new Error('MONGODB_URI não definida nas variáveis de ambiente');
        }

        await mongoose.connect(uri);
        console.log('✅ Conectado ao MongoDB com sucesso!');
    } catch (err) {
        console.error('❌ Erro de conexão com MongoDB:', err.message);
        process.exit(1); // Encerra o app se não conseguir conectar
    }
};

// Iniciamos a conexão
connectDB();

module.exports = mongoose.connection;
