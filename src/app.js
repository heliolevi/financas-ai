const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');

// Importação das rotas
const authRoutes = require('./routes/auth');
const transactionRoutes = require('./routes/transactions');
const aiRoutes = require('./routes/ai');

// Configuração do servidor Express
const app = express();

// Middleware de segurança e parsing
app.use(cors()); // Permite requisições de diferentes origens
app.use(bodyParser.json()); // Converte o corpo da requisição para JSON

// Serve os arquivos estáticos da pasta 'public' (HTML, CSS, JS do frontend)
app.use(express.static(path.join(__dirname, '../public')));

// Definição dos endpoints da API
app.use('/api/auth', authRoutes);         // Rotas de login e registro
app.use('/api/transactions', transactionRoutes); // Rotas de CRUD de gastos e estatísticas
app.use('/api/ai', aiRoutes);             // Rotas de integração com a IA (Lumi)

// Fallback: Qualquer rota não encontrada na API serve o arquivo index.html (Single Page Application)
app.use((req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

module.exports = app;
