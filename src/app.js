const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
require('./config/database'); // Inicializa a conexão com o MongoDB

// Importação das rotas
const authRoutes = require('./routes/auth');
const transactionRoutes = require('./routes/transactions');
const aiRoutes = require('./routes/ai');
const paymentRoutes = require('./routes/payment');
const reportRoutes = require('./routes/reports');
const profileRoutes = require('./routes/profile');

// Configuração do servidor Express
const app = express();

// Middleware de segurança - NOTA: Webhook do Stripe precisa do raw body ANTES do json()
app.use(cors()); 

// Rota do Webhook do Stripe (deve vir antes do express.json() global)
app.use('/api/payments', paymentRoutes);

app.use(express.json()); // Converte o corpo das outras requisições para JSON

// Serve os arquivos estáticos da pasta 'public' (HTML, CSS, JS do frontend)
app.use(express.static(path.join(__dirname, '../public')));

// Definição dos endpoints da API
app.use('/api/auth', authRoutes);         // Rotas de login e registro
app.use('/api/transactions', transactionRoutes); // Rotas de CRUD de gastos e estatísticas
app.use('/api/ai', aiRoutes);             // Rotas de integração com a IA (Lumi)
app.use('/api/reports', reportRoutes);    // Exportação de relatórios
app.use('/api/profile', profileRoutes);   // Rotas de perfil e dashboard

// Fallback: Qualquer rota não encontrada na API serve o arquivo index.html (Single Page Application)
app.use((req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

module.exports = app;
