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
