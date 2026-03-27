const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

// Caminho do arquivo do banco de dados SQLite
const dbPath = path.resolve(__dirname, 'database.sqlite');

/**
 * Conexão com o banco de dados.
 * SQLite é um banco de dados em arquivo, ideal para projetos leves e protótipos.
 */
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Erro ao abrir o banco de dados:', err.message);
    } else {
        console.log('Conectado ao banco de dados SQLite.');
        createTables();
    }
});

/**
 * Criação da estrutura das tabelas (Schema).
 * Dica: O comando 'CREATE TABLE IF NOT EXISTS' evita erros ao reiniciar o servidor.
 */
function createTables() {
    db.serialize(() => {
        // Tabela de Usuários (Login e Senha)
        db.run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE,
            password TEXT
        )`);

        // Tabela de Transações (Os gastos do usuário)
        db.run(`CREATE TABLE IF NOT EXISTS transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            amount REAL,
            category TEXT,
            description TEXT,
            payment_method TEXT,
            date TEXT,
            FOREIGN KEY (user_id) REFERENCES users (id)
        )`);

        // Tabela de Mensagens (Cérebro da Lumi - Histórico de Chat)
        db.run(`CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            role TEXT,
            content TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id)
        )`);
    });
}

module.exports = db;
