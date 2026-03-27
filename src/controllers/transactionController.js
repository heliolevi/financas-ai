const Transaction = require('../models/Transaction');
const mongoose = require('mongoose');

/**
 * Adiciona uma nova transação financeira vinculada ao usuário logado.
 */
const addTransaction = async (req, res) => {
    const { amount, category, description, payment_method, date } = req.body;
    const userId = req.userId;

    if (!amount || !category || !payment_method || !date) {
        return res.status(400).json({ message: 'Valor, categoria, método de pagamento e data são obrigatórios' });
    }

    try {
        const newTransaction = new Transaction({
            user_id: userId,
            amount,
            category,
            description,
            payment_method,
            date
        });

        await newTransaction.save();
        res.status(201).json({ message: 'Transação registrada com sucesso', id: newTransaction._id });
    } catch (err) {
        res.status(500).json({ message: 'Erro ao salvar transação' });
    }
};

/**
 * Lista todas as transações do usuário.
 */
const getTransactions = async (req, res) => {
    const userId = req.userId;
    try {
        const transactions = await Transaction.find({ user_id: userId }).sort({ date: -1, timestamp: -1 });
        // Mapeamos _id para id para manter compatibilidade com o frontend
        const rows = transactions.map(t => ({
            id: t._id,
            amount: t.amount,
            category: t.category,
            description: t.description,
            payment_method: t.payment_method,
            date: t.date
        }));
        res.status(200).json(rows);
    } catch (err) {
        res.status(500).json({ message: 'Erro ao buscar transações' });
    }
};

/**
 * Remove uma transação.
 */
const deleteTransaction = async (req, res) => {
    const userId = req.userId;
    const { id } = req.params;
    try {
        const result = await Transaction.deleteOne({ _id: id, user_id: userId });
        if (result.deletedCount === 0) {
            return res.status(404).json({ message: 'Transação não encontrada ou permissão negada' });
        }
        res.status(200).json({ message: 'Transação removida com sucesso' });
    } catch (err) {
        res.status(500).json({ message: 'Erro ao deletar transação' });
    }
};

/**
 * Agrega dados para compor o Dashboard usando MongoDB Aggregation.
 */
const getDashboardStats = async (req, res) => {
    const userId = new mongoose.Types.ObjectId(req.userId);
    
    try {
        // Total Geral
        const totalResult = await Transaction.aggregate([
            { $match: { user_id: userId } },
            { $group: { _id: null, total: { $sum: "$amount" } } }
        ]);

        // Por Categoria
        const byCategory = await Transaction.aggregate([
            { $match: { user_id: userId } },
            { $group: { _id: "$category", amount: { $sum: "$amount" } } },
            { $sort: { amount: -1 } },
            { $project: { category: "$_id", amount: 1, _id: 0 } }
        ]);

        // Por Método de Pagamento
        const byPayment = await Transaction.aggregate([
            { $match: { user_id: userId } },
            { $group: { _id: "$payment_method", amount: { $sum: "$amount" } } },
            { $project: { payment_method: "$_id", amount: 1, _id: 0 } }
        ]);

        res.status(200).json({
            total: totalResult.length > 0 ? totalResult[0].total : 0,
            categories: byCategory,
            payments: byPayment
        });
    } catch (err) {
        res.status(500).json({ message: 'Erro ao calcular estatísticas' });
    }
};

module.exports = { addTransaction, getTransactions, deleteTransaction, getDashboardStats };
