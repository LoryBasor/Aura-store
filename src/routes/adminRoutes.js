// src/routes/adminRoutes.js
const express = require('express');
const { authenticate } = require('../middlewares/auth');
const { requireSuperAdmin } = require('../middlewares/authorization');
const { apiLimiter } = require('../middlewares/rateLimiter');
const { auditLog } = require('../middlewares/auditLogger');
const validateRequest = require('../middlewares/validateRequest');
const Joi = require('joi');

// Controllers
const adminUserController = require('../controllers/admin/userController');
const adminSubscriptionController = require('../controllers/admin/subscriptionController');
const adminDashboardController = require('../controllers/admin/dashboardController');
const adminProductController = require('../controllers/admin/adminProductController');

const router = express.Router();

/**
 * TOUTES les routes admin nécessitent:
 * 1. Authentification
 * 2. Rôle SUPER_ADMIN
 */
router.use(authenticate);
router.use(requireSuperAdmin);
router.use(apiLimiter);

// ==============================================
// ROUTES DASHBOARD
// ==============================================

// Dashboard global
router.get('/dashboard', adminDashboardController.getDashboard);

// Stats par période
router.get('/dashboard/stats/:period', adminDashboardController.getStatsByPeriod);

// Abonnements expirant bientôt
router.get('/dashboard/expiring-subscriptions', adminDashboardController.getExpiringSoon);

// Distribution abonnements
router.get('/dashboard/subscription-distribution', adminDashboardController.getSubscriptionDistribution);

// ==============================================
// ROUTES GESTION VENDEURS
// ==============================================

// Liste vendeurs
router.get('/vendors', adminUserController.listVendors);

// Détails vendeur
router.get('/vendors/:userId', adminUserController.getVendorDetails);

// Suspendre vendeur
router.post(
  '/vendors/:userId/suspend',
  auditLog('user.suspend', 'users'),
  validateRequest(Joi.object({
    reason: Joi.string().min(5).max(500).required()
  })),
  adminUserController.suspendVendor
);

// Réactiver vendeur
router.post(
  '/vendors/:userId/activate',
  auditLog('user.activate', 'users'),
  adminUserController.activateVendor
);

// Désactiver vendeur
router.post(
  '/vendors/:userId/deactivate',
  auditLog('user.deactivate', 'users'),
  adminUserController.deactivateVendor
);

// Réinitialiser mot de passe
router.post(
  '/vendors/:userId/reset-password',
  auditLog('user.reset_password', 'users'),
  validateRequest(Joi.object({
    must_change_password: Joi.boolean().optional()
  })),
  adminUserController.resetPassword
);

// Marquer vendeur comme vérifié
router.post(
  '/vendors/:userId/verify',
  auditLog('user.verify', 'users'),
  adminUserController.verifyVendor
);

// Retirer la vérification du vendeur
router.post(
  '/vendors/:userId/unverify',
  auditLog('user.unverify', 'users'),
  adminUserController.unverifyVendor
);

// ==============================================
// ROUTES GESTION PLANS
// ==============================================

// Liste plans
router.get('/plans', adminSubscriptionController.listPlans);

// Détails plan
router.get('/plans/:id', adminSubscriptionController.getPlan);

// ==============================================
// ROUTES GESTION ABONNEMENTS
// ==============================================

// Stats abonnements
router.get('/subscriptions/stats', adminSubscriptionController.getSubscriptionStats);

// Créer abonnement
router.post(
  '/subscriptions',
  auditLog('subscription.create', 'subscriptions'),
  validateRequest(Joi.object({
    user_id: Joi.number().integer().positive().required(),
    plan_id: Joi.number().integer().positive().required(),
    notes: Joi.string().max(1000).optional().allow('', null)
  })),
  adminSubscriptionController.createSubscription
);

// Historique abonnement
router.get('/subscriptions/:userId/history', adminSubscriptionController.getSubscriptionHistory);

// Changer de plan
router.put(
  '/subscriptions/:userId/plan',
  auditLog('subscription.change', 'subscriptions'),
  validateRequest(Joi.object({
    new_plan_id: Joi.number().integer().positive().required()
  })),
  adminSubscriptionController.changePlan
);

// Prolonger abonnement
router.post(
  '/subscriptions/:userId/extend',
  auditLog('subscription.extend', 'subscriptions'),
  validateRequest(Joi.object({
    days: Joi.number().integer().min(1).max(365).required()
  })),
  adminSubscriptionController.extendSubscription
);

// Annuler abonnement
router.post(
  '/subscriptions/:userId/cancel',
  auditLog('subscription.cancel', 'subscriptions'),
  validateRequest(Joi.object({
    reason: Joi.string().min(5).max(500).required()
  })),
  adminSubscriptionController.cancelSubscription
);

// ==============================================
// ROUTES GESTION PRODUITS
// ==============================================

// Basculer l'indisponibilité admin
router.patch('/products/:id/toggle-admin-disable', adminProductController.toggleAdminDisable);

// Supprimer produit
router.delete('/products/:id', adminProductController.deleteProduct);

// ==============================================
// ROUTES NOTIFICATIONS ADMIN
// ==============================================
const notificationService = require('../services/notificationService');

// Récupérer les notifications
router.get('/notifications', async (req, res, next) => {
  try {
    const { page, unreadOnly } = req.query;
    const result = await notificationService.getAdminNotifications({
      page: parseInt(page) || 1,
      unreadOnly: unreadOnly === 'true'
    });
    res.json({ success: true, data: result });
  } catch (error) { next(error); }
});

// Marquer une notification comme lue
router.put('/notifications/:id/read', async (req, res, next) => {
  try {
    const result = await notificationService.markAsRead(req.params.id);
    res.json({ success: true, data: result });
  } catch (error) { next(error); }
});

// Marquer toutes comme lues
router.put('/notifications/read-all', async (req, res, next) => {
  try {
    const result = await notificationService.markAllAsRead();
    res.json({ success: true, data: result });
  } catch (error) { next(error); }
});

module.exports = router;