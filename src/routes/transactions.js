const express = require('express');
const router = express.Router();
const transactionController = require('../controllers/transactionController');
const verifyToken = require('../middleware/authMiddleware');

router.post('/', verifyToken, transactionController.addTransaction);
router.get('/', verifyToken, transactionController.getTransactions);
router.delete('/:id', verifyToken, transactionController.deleteTransaction);

module.exports = router;
