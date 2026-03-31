/**
 * =============================================================================
 * MODELO DE MENSAGENS (HISTÓRICO DO CHAT COM LUMI)
 * =============================================================================
 * Armazena o histórico de conversas entre usuário e a IA.
 * Usado para dar contexto às próximas perguntas.
 * =============================================================================
 */

const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
    // Usuário que enviou/recebeu a mensagem
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    
    // Tipo de mensagem (user = pergunta, assistant = resposta da IA)
    role: { type: String, enum: ['user', 'assistant', 'system'], required: true },
    
    // Conteúdo da mensagem (limitado para evitar dados grandes)
    content: { type: String, required: true, maxlength: 10000 },
    
    // Timestamp para ordenação
    timestamp: { type: Date, default: Date.now }
});

// Limpa mensagens antigas periodicamente (para SQLite ou quando TTL não funciona)
messageSchema.statics.cleanOldMessages = async function(userId, maxMessages = 100) {
    const count = await this.countDocuments({ user_id: userId });
    if (count > maxMessages) {
        const toDelete = await this.find({ user_id: userId })
            .sort({ timestamp: 1 })
            .limit(count - maxMessages)
            .select('_id');
        const idsToDelete = toDelete.map(d => d._id);
        await this.deleteMany({ _id: { $in: idsToDelete } });
    }
};

module.exports = mongoose.model('Message', messageSchema);
