const express = require('express');
const router = express.Router();
const aiController = require('../controllers/aiController');
const verifyToken = require('../middleware/authMiddleware');

router.post('/analyze', verifyToken, aiController.analyzeFinances);

module.exports = router;
