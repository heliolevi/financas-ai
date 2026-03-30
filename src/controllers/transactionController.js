const Transaction = require('../models/Transaction');
const mongoose = require('mongoose');

/**
 * Adiciona uma nova transação financeira vinculada ao usuário logado.
 */
const addTransaction = async (req, res) => {
    const { amount, category, description, payment_method, date, installments = 1 } = req.body;
    const userId = req.userId;

    if (!amount || !category || !payment_method || !date) {
        return res.status(400).json({ message: 'Valor, categoria, método de pagamento e data são obrigatórios' });
    }

    if (amount <= 0) {
        return res.status(400).json({ message: 'O valor da transação deve ser maior que zero' });
    }

    try {
        const numInstallments = parseInt(installments) || 1;
        const baseDate = new Date(date + 'T12:00:00'); // T12:00:00 evita problemas de fuso horário
        const installmentAmount = amount / numInstallments;
        const groupId = numInstallments > 1 ? 'GRP-' + Date.now().toString(36) + Math.random().toString(36).substring(2, 5) : null;

        for (let i = 0; i < numInstallments; i++) {
            const currentMonthDate = new Date(baseDate);
            currentMonthDate.setMonth(baseDate.getMonth() + i);
            const dateStr = currentMonthDate.toISOString().split('T')[0];

            const descSuffix = numInstallments > 1 ? ` (${i + 1}/${numInstallments})` : '';
            
            const newTransaction = new Transaction({
                user_id: userId,
                amount: installmentAmount,
                category,
                description: (description || 'Sem descrição') + descSuffix,
                payment_method,
                date: dateStr,
                installments: numInstallments,
                installment_index: i + 1,
                group_id: groupId
            });

            await newTransaction.save();
        }

        res.status(201).json({ message: 'Transação(ões) registrada(s) com sucesso' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Erro ao salvar transação' });
    }
};

/**
 * Lista todas as transações do usuário.
 */
const getTransactions = async (req, res) => {
    const userId = req.userId;
    try {
        // Limite de 100 transações para evitar lentidão no frontend básico
        const transactions = await Transaction.find({ user_id: userId })
            .sort({ date: -1, timestamp: -1 })
            .limit(100);
            
        // Mapeamos _id para id para manter compatibilidade com o frontend
        const rows = transactions.map(t => ({
            id: t._id,
            amount: t.amount,
            category: t.category,
            description: t.description,
            payment_method: t.payment_method,
            date: t.date,
            group_id: t.group_id
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
    const { deleteAll } = req.query;

    try {
        const transaction = await Transaction.findOne({ _id: id, user_id: userId });
        if (!transaction) {
            return res.status(404).json({ message: 'Transação não encontrada ou permissão negada' });
        }

        if (deleteAll === 'true' && transaction.group_id) {
            const result = await Transaction.deleteMany({ group_id: transaction.group_id, user_id: userId });
            return res.status(200).json({ message: `${result.deletedCount} parcelas removidas com sucesso` });
        }

        await Transaction.deleteOne({ _id: id });
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
