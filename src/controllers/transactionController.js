const db = require('../config/database');

/**
 * Adiciona uma nova transação financeira vinculada ao usuário logado.
 */
const addTransaction = (req, res) => {
    const { amount, category, description, payment_method, date } = req.body;
    const userId = req.userId; // Obtido do middleware de autenticação

    if (!amount || !category || !payment_method || !date) {
        return res.status(400).json({ message: 'Valor, categoria, método de pagamento e data são obrigatórios' });
    }

    db.run(`INSERT INTO transactions (user_id, amount, category, description, payment_method, date) VALUES (?, ?, ?, ?, ?, ?)`, 
        [userId, amount, category, description, payment_method, date], 
        function(err) {
            if (err) {
                return res.status(500).json({ message: 'Erro ao salvar transação' });
            }
            res.status(201).json({ message: 'Transação registrada com sucesso', id: this.lastID });
        }
    );
};

/**
 * Lista todas as transações do usuário, do mais recente para o mais antigo.
 */
const getTransactions = (req, res) => {
    const userId = req.userId;
    db.all(`SELECT * FROM transactions WHERE user_id = ? ORDER BY date DESC`, [userId], (err, rows) => {
        if (err) {
            return res.status(500).json({ message: 'Erro ao buscar transações' });
        }
        res.status(200).json(rows);
    });
};

/**
 * Remove uma transação.
 * Segurança: Verifica se a transação pertence ao usuário antes de deletar.
 */
const deleteTransaction = (req, res) => {
    const userId = req.userId;
    const { id } = req.params;
    db.run(`DELETE FROM transactions WHERE id = ? AND user_id = ?`, [id, userId], function(err) {
        if (err) {
            return res.status(500).json({ message: 'Erro ao deletar transação' });
        }
        if (this.changes === 0) {
            return res.status(404).json({ message: 'Transação não encontrada ou permissão negada' });
        }
        res.status(200).json({ message: 'Transação removida com sucesso' });
    });
};

/**
 * Agrega dados para compor o Dashboard.
 * Realiza múltiplas consultas SQL para somar totais e agrupar por categorias.
 * Dica: Usamos 'GROUP BY' do SQL para deixar o banco fazer o trabalho pesado de cálculo.
 */
const getDashboardStats = (req, res) => {
    const userId = req.userId;
    
    const queries = {
        total: `SELECT SUM(amount) as total FROM transactions WHERE user_id = ?`,
        byCategory: `SELECT category, SUM(amount) as amount FROM transactions WHERE user_id = ? GROUP BY category ORDER BY amount DESC`,
        byPayment: `SELECT payment_method, SUM(amount) as amount FROM transactions WHERE user_id = ? GROUP BY payment_method`
    };

    db.get(queries.total, [userId], (err, totalRow) => {
        if (err) return res.status(500).json({ message: 'Erro ao calcular total' });
        
        db.all(queries.byCategory, [userId], (err, categories) => {
            if (err) return res.status(500).json({ message: 'Erro ao calcular categorias' });
            
            db.all(queries.byPayment, [userId], (err, payments) => {
                if (err) return res.status(500).json({ message: 'Erro ao calcular métodos de pagamento' });
                
                res.status(200).json({
                    total: totalRow.total || 0,
                    categories,
                    payments
                });
            });
        });
    });
};

module.exports = { addTransaction, getTransactions, deleteTransaction, getDashboardStats };
