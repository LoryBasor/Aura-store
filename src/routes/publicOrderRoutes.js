// src/routes/publicOrderRoutes.js
const express = require('express');
const orderController = require('../controllers/orderController');
const { publicLimiter } = require('../middlewares/rateLimiter');
const validateRequest = require('../middlewares/validateRequest');
const { orderSchema } = require('../utils/validators');
const { incrementOrderCount } = require('../middlewares/subscriptionCheck');

const router = express.Router();

/**
 * Créer une commande (PUBLIC)
 * POST /api/public/orders
 */
router.post(
  '/',
  publicLimiter,
  validateRequest(orderSchema),
  orderController.createOrder,
  incrementOrderCount
);

/**
 * ✨ NOUVEAU - Obtenir le statut d'un envoi WhatsApp automatique
 * GET /api/public/orders/job/:jobId
 */
router.get(
  '/job/:jobId',
  publicLimiter,
  orderController.getWhatsAppJobStatus
);

module.exports = router;
