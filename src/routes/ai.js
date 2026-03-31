const express = require('express');
const router = express.Router();
const aiController = require('../controllers/aiController');
const verifyToken = require('../middleware/authMiddleware');

router.post('/analyze', verifyToken, aiController.analyzeFinances);
router.post('/analyze-image', verifyToken, aiController.analyzeImage);
router.get('/proactive', verifyToken, aiController.getProactiveInsight);

module.exports = router;
