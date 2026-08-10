// src/routes/index.js
const express = require('express');
const authRoutes = require('./authRoutes');
const productRoutes = require('./productRoutes');
const orderRoutes = require('./orderRoutes');
const adminRoutes = require('./adminRoutes');
const storesRoutes = require('./storesRoutes');
const planFeaturesRoutes = require('./planFeaturesRoutes'); // ✨ NOUVEAU
const dashboardController = require('../controllers/dashboardController');
const productController = require('../controllers/productController');
const { authenticate } = require('../middlewares/auth');
const { checkAccountStatus } = require('../middlewares/authorization');
const { requireActiveSubscription } = require('../middlewares/subscriptionCheck');
const { attachUserPlan } = require('../middlewares/checkPlanAccess'); // ✨ NOUVEAU
const { apiLimiter, publicLimiter } = require('../middlewares/rateLimiter');
const categoryRoutes = require('./categoryRoutes');
const feedbackRoutes = require('./feedbackRoutes');
const reportRoutes = require('./reportRoutes');
const messagingRoutes = require('./messagingRoutes');
const whatsappRoutes = require('./whatsappRoutes'); // ✨ NOUVEAU WhatsApp Automation
const marketplaceCategoryPublicRoutes = require('./marketplaceCategoryRoutes'); // ✨ Catégories Marketplace publiques

const router = express.Router();

/**
 * Centralisation de toutes les routes
 */

// Routes d'authentification
router.use('/auth', authRoutes);

// Routes publiques pour les commandes
const publicOrderRoutes = require('./publicOrderRoutes');
router.use('/public/orders', publicOrderRoutes);

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

router.use(
  '/categories',
  authenticate,
  categoryRoutes
);
// Routes de gestion des commandes
router.use(
  '/orders',
  authenticate,
  checkAccountStatus,
  orderRoutes
);

router.use(
  '/features',
  planFeaturesRoutes
);

// Nouvelles fonctionnalités
router.use('/feedback', feedbackRoutes);
router.use('/reports', reportRoutes);
router.use('/messages', messagingRoutes);
router.use('/whatsapp', whatsappRoutes); // ✨ NOUVEAU WhatsApp Automation
router.use('/marketplace-categories', publicLimiter, marketplaceCategoryPublicRoutes); // ✨ Catégories Marketplace publiques

// Routes du dashboard vendeur (protégées)
router.get(
  '/dashboard',
  authenticate,
  checkAccountStatus,
  requireActiveSubscription,
  attachUserPlan, // ✨ Attache le plan pour utilisation dans le dashboard
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

// Routes boutiques publiques
router.use(
  '/store',
  publicLimiter,
  storesRoutes
);

// Routes marketplace publiques
const marketplaceRoutes = require('./marketplaceRoutes');
router.use(
  '/marketplace',
  publicLimiter,
  marketplaceRoutes
);

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