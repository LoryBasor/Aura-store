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
// ROUTES PUBLIQUES
// ========================================

/**
 * Créer une commande (PUBLIC - depuis lien produit)
 * POST /api/orders
 */
router.post(
  '/',
  publicLimiter,
  validateRequest(orderSchema),
  orderController.createOrder,
  incrementOrderCount
);

/**
 * Créer une commande depuis un lien public (PUBLIC - depuis lien public)
 * POST /api/orders/public
 */
router.post(
  '/public',
  publicLimiter,
  validateRequest(Joi.object({
    product_token: Joi.string().required().messages({
      'any.required': 'Token produit requis'
    }),
    customer_name: Joi.string().min(2).max(255).required().messages({
      'any.required': 'Nom client requis',
      'string.min': 'Nom minimum 2 caractères'
    }),
    customer_phone: Joi.string().pattern(/^\+\d(?:\s?\d){9,14}$/).required().messages({
      'string.pattern.base': 'Numéro de téléphone invalide',
      'any.required': 'Téléphone requis'
    }),
    customer_address: Joi.string().max(500).optional().allow('', null),
    quantity: Joi.number().integer().min(1).max(1000).required().messages({
      'any.required': 'Quantité requise',
      'number.min': 'Quantité minimum 1'
    }),
    notes: Joi.string().max(1000).optional().allow('', null)
  })),
  orderController.createOrderFromPublicLink,
  incrementOrderCount
);

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
