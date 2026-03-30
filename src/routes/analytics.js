const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/authMiddleware');
const analyticsController = require('../controllers/analyticsController');

router.get('/predict', verifyToken, analyticsController.predictExpenses);
router.get('/subscriptions', verifyToken, analyticsController.detectSubscriptions);
router.get('/ai-insight', verifyToken, analyticsController.getAIInsight);

module.exports = router;
