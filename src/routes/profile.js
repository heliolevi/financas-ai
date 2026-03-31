const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/authMiddleware');
const profileController = require('../controllers/profileController');
const proactiveAlerts = require('../services/proactiveAlerts');

router.get('/', verifyToken, profileController.getProfile);
router.put('/', verifyToken, profileController.updateProfile);
router.get('/dashboard', verifyToken, profileController.getDashboardData);
router.post('/fixed-expenses', verifyToken, profileController.addFixedExpense);
router.delete('/fixed-expenses/:index', verifyToken, profileController.removeFixedExpense);
router.put('/savings', verifyToken, profileController.updateSavings);
router.get('/alerts', verifyToken, async (req, res) => {
    try {
        const alerts = await proactiveAlerts.getProactiveAlerts(req.userId);
        res.json(alerts);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
