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
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    
    // Tipo de mensagem (user = pergunta, assistant = resposta da IA)
    role: { type: String, enum: ['user', 'assistant', 'system'], required: true },
    
    // Conteúdo da mensagem
    content: { type: String, required: true },
    
    // Timestamp para ordenação
    timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Message', messageSchema);
