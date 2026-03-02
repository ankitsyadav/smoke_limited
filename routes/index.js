const express = require('express');
const router = express.Router();
const { requireAuth, guestOnly } = require('../middleware/auth');
const authController = require('../controllers/authController');
const dashboardController = require('../controllers/dashboardController');
const smokeController = require('../controllers/smokeController');
const analyticsController = require('../controllers/analyticsController');
const settingsController = require('../controllers/settingsController');

// Auth routes (public)
router.get('/login', guestOnly, authController.getLogin);
router.post('/login', guestOnly, authController.postLogin);
router.get('/signup', guestOnly, authController.getSignup);
router.post('/signup', guestOnly, authController.postSignup);
router.get('/logout', authController.logout);

// Protected routes (require login)
router.get('/', requireAuth, dashboardController.getDashboard);
router.post('/smoke', requireAuth, smokeController.logSmoke);
router.post('/api/smoke', requireAuth, smokeController.logSmokeAjax);
router.get('/analytics', requireAuth, analyticsController.getAnalytics);
router.get('/api/analytics', requireAuth, analyticsController.getAnalyticsData);
router.get('/api/analytics/ai', requireAuth, analyticsController.getAnalyticsAI);
router.get('/settings', requireAuth, settingsController.getSettings);
router.post('/settings', requireAuth, settingsController.saveSettings);

module.exports = router;
