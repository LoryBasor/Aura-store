// src/routes/orderRoutes.js
const express = require('express');
const Joi = require('joi');
const orderController = require('../controllers/orderController');
const { authenticate } = require('../middlewares/auth');
const { ensureOwnership } = require('../middlewares/tenantIsolation');
const { incrementOrderCount } = require('../middlewares/subscriptionCheck');
const validateRequest = require('../middlewares/validateRequest');
const { apiLimiter, publicLimiter } = require('../middlewares/rateLimiter');
const { orderSchema, updateOrderStatusSchema, manualOrderSchema, updateOrderSchema } = require('../utils/validators');

const router = express.Router();

/**
 * Routes de gestion des commandes
 * Préfixe: /api/orders
 */

// ========================================
// ROUTES PROTÉGÉES (VENDEUR)
// ========================================

/**
 * Créer une commande manuelle (VENDEUR)
 * POST /api/orders/manual
 */
router.post(
  '/manual',
  authenticate,
  apiLimiter,
  validateRequest(manualOrderSchema),
  orderController.createManualOrder,
  incrementOrderCount
);

/**
 * Statistiques des commandes (doit être avant /:id)
 * GET /api/orders/stats
 */
router.get(
  '/stats',
  authenticate,
  apiLimiter,
  orderController.getOrderStats
);

/**
 * Liste des commandes du vendeur
 * GET /api/orders
 */
router.get(
  '/',
  authenticate,
  apiLimiter,
  orderController.getOrders
);

/**
 * Détails d'une commande
 * GET /api/orders/:id
 */
router.get(
  '/:id',
  authenticate,
  apiLimiter,
  ensureOwnership('orders', 'id'),
  orderController.getOrder
);

/**
 * Mise à jour d'une commande
 * PUT /api/orders/:id
 */
router.put(
  '/:id',
  authenticate,
  apiLimiter,
  ensureOwnership('orders', 'id'),
  validateRequest(updateOrderSchema),
  orderController.updateOrder
);

/**
 * Mise à jour du statut
 * PATCH /api/orders/:id/status
 */
router.patch(
  '/:id/status',
  authenticate,
  apiLimiter,
  ensureOwnership('orders', 'id'),
  validateRequest(updateOrderStatusSchema),
  orderController.updateOrderStatus
);

/**
 * Suppression d'une commande
 * DELETE /api/orders/:id
 */
router.delete(
  '/:id',
  authenticate,
  apiLimiter,
  ensureOwnership('orders', 'id'),
  orderController.deleteOrder
);

module.exports = router;
