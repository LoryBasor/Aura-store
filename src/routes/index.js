// src/routes/index.js
const express = require('express');
const authRoutes = require('./authRoutes');
const productRoutes = require('./productRoutes');
const orderRoutes = require('./orderRoutes');
const adminRoutes = require('./adminRoutes');
const dashboardController = require('../controllers/dashboardController');
const productController = require('../controllers/productController');
const { authenticate } = require('../middlewares/auth');
const { checkAccountStatus } = require('../middlewares/authorization');
const { requireActiveSubscription } = require('../middlewares/subscriptionCheck');
const { apiLimiter, publicLimiter } = require('../middlewares/rateLimiter');
const storesRoutes = require('../routes/storesRoutes');

const router = express.Router();

/**
 * Centralisation de toutes les routes
 */

// Routes d'authentification
router.use('/auth', authRoutes);

// Routes Super Admin (préfixe /admin)
router.use('/admin', adminRoutes);

// Routes de gestion des produits (protégées + vérification abonnement)
router.use(
  '/products',
  authenticate,
  checkAccountStatus,
  requireActiveSubscription,
  productRoutes
);

// Routes de gestion des commandes
router.use(
  '/orders',
  authenticate,
  checkAccountStatus,
  orderRoutes
);

// Routes du dashboard vendeur (protégées)
router.get(
  '/dashboard',
  authenticate,
  checkAccountStatus,
  requireActiveSubscription,
  apiLimiter,
  dashboardController.getDashboard
);

router.get(
  '/dashboard/stats/:period',
  authenticate,
  checkAccountStatus,
  requireActiveSubscription,
  apiLimiter,
  dashboardController.getStatsByPeriod
);

// Routes publiques (liens de partage produits)
router.get(
  '/p/:token',
  publicLimiter,
  productController.getProductByShareLink
);

router.use(
  '/store',
  publicLimiter,
  storesRoutes
)

// Route de santé (health check)
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

module.exports = router;