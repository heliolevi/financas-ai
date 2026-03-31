/**
 * =============================================================================
 * FINANÇAS AI - LUMI GOLD
 * =============================================================================
 * Servidor Express.js com API REST para gerenciamento financeiro pessoal.
 * Inclui autenticação JWT, integração com IA (Groq/Llama), Stripe payments,
 * importação de extratos (CSV/OFX/XML) e dashboard com estatísticas.
 * 
 * ESTRUTURA:
 * - /api/auth     → Login, registro, dados do usuário
 * - /api/transactions → CRUD de transações, estatísticas, importação
 * - /api/ai      → Chat com Lumi (IA), análise de imagens
 * - /api/profile → Perfil financeiro, metas, alertas
 * - /api/analytics → Previsões, assinaturas, insights
 * - /api/reports → Exportação PDF/Excel
 * - /api/payments → Checkout Stripe, webhooks
 * =============================================================================
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
require('./config/database'); // Inicializa a conexão com o MongoDB

// Importação das rotas
const authRoutes = require('./routes/auth');
const transactionRoutes = require('./routes/transactions');
const aiRoutes = require('./routes/ai');
const paymentRoutes = require('./routes/payment');
const reportRoutes = require('./routes/reports');
const profileRoutes = require('./routes/profile');
const analyticsRoutes = require('./routes/analytics');
const paymentController = require('./controllers/paymentController');

// Configuração do servidor Express
const app = express();

app.use(cors());

// IMPORTANTE: Rota do Webhook do Stripe DEVE vir ANTES do express.json()
// pois precisa do raw body para verificar a assinatura
app.use('/api/payments/webhook', express.raw({ type: 'application/json' }), paymentController.webhookRaw);

// Rotas normais do payment (com body parser)
app.use('/api/payments', paymentRoutes);

app.use(express.json());

// Serve os arquivos estáticos da pasta 'public' (HTML, CSS, JS do frontend)
app.use(express.static(path.join(__dirname, '../public')));

// Definição dos endpoints da API
app.use('/api/auth', authRoutes);         // Rotas de login e registro
app.use('/api/transactions', transactionRoutes); // Rotas de CRUD de gastos e estatísticas
app.use('/api/ai', aiRoutes);             // Rotas de integração com a IA (Lumi)
app.use('/api/reports', reportRoutes);    // Exportação de relatórios
app.use('/api/profile', profileRoutes);   // Rotas de perfil e dashboard
app.use('/api/analytics', analyticsRoutes); // Rotas de analytics (predição, assinaturas)

// Fallback: Qualquer rota não encontrada na API serve o arquivo index.html (Single Page Application)
app.use((req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

module.exports = app;
