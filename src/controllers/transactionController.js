const db = require('../config/database');

const addTransaction = (req, res) => {
    const { amount, category, description, payment_method, date } = req.body;
    const userId = req.userId;

    if (!amount || !category || !payment_method || !date) {
        return res.status(400).json({ message: 'Amount, category, payment method and date are required' });
    }

    db.run(`INSERT INTO transactions (user_id, amount, category, description, payment_method, date) VALUES (?, ?, ?, ?, ?, ?)`, 
        [userId, amount, category, description, payment_method, date], 
        function(err) {
            if (err) {
                return res.status(500).json({ message: 'Error adding transaction' });
            }
            res.status(201).json({ message: 'Transaction added successfully', id: this.lastID });
        }
    );
};

const getTransactions = (req, res) => {
    const userId = req.userId;
    db.all(`SELECT * FROM transactions WHERE user_id = ? ORDER BY date DESC`, [userId], (err, rows) => {
        if (err) {
            return res.status(500).json({ message: 'Error fetching transactions' });
        }
        res.status(200).json(rows);
    });
};

const deleteTransaction = (req, res) => {
    const userId = req.userId;
    const { id } = req.params;
    db.run(`DELETE FROM transactions WHERE id = ? AND user_id = ?`, [id, userId], function(err) {
        if (err) {
            return res.status(500).json({ message: 'Error deleting transaction' });
        }
        if (this.changes === 0) {
            return res.status(404).json({ message: 'Transaction not found' });
        }
        res.status(200).json({ message: 'Transaction deleted' });
    });
};

const getDashboardStats = (req, res) => {
    const userId = req.userId;
    
    const queries = {
        total: `SELECT SUM(amount) as total FROM transactions WHERE user_id = ?`,
        byCategory: `SELECT category, SUM(amount) as amount FROM transactions WHERE user_id = ? GROUP BY category ORDER BY amount DESC`,
        byPayment: `SELECT payment_method, SUM(amount) as amount FROM transactions WHERE user_id = ? GROUP BY payment_method`
    };

    db.get(queries.total, [userId], (err, totalRow) => {
        if (err) return res.status(500).json({ message: 'Error fetching total' });
        
        db.all(queries.byCategory, [userId], (err, categories) => {
            if (err) return res.status(500).json({ message: 'Error fetching categories' });
            
            db.all(queries.byPayment, [userId], (err, payments) => {
                if (err) return res.status(500).json({ message: 'Error fetching payments' });
                
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
