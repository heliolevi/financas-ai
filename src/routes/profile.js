const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/authMiddleware');
const profileController = require('../controllers/profileController');

router.get('/', verifyToken, profileController.getProfile);
router.put('/', verifyToken, profileController.updateProfile);
router.get('/dashboard', verifyToken, profileController.getDashboardData);
router.post('/fixed-expenses', verifyToken, profileController.addFixedExpense);
router.delete('/fixed-expenses/:index', verifyToken, profileController.removeFixedExpense);
router.put('/savings', verifyToken, profileController.updateSavings);

module.exports = router;
