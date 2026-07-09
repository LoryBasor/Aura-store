// src/routes/reportRoutes.js
const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const { authenticate } = require('../middlewares/auth');
const { publicLimiter, authLimiter } = require('../middlewares/rateLimiter');
const Joi = require('joi');
const validateRequest = require('../middlewares/validateRequest');

const productReportSchema = Joi.object({
  reason: Joi.string().valid('Arnaque', 'Produit interdit', 'Faux produit', 'Mauvaise description', 'Spam', 'Autre').required(),
  description: Joi.string().max(1000).optional().allow('', null)
});

const storeReportSchema = Joi.object({
  reason: Joi.string().valid('Arnaque', 'Produits interdits', 'Faux vendeur', 'Contenu inapproprié', 'Spam', 'Autre').required(),
  description: Joi.string().max(1000).optional().allow('', null)
});

// Signaler un produit (public)
router.post('/product/:productId',
  publicLimiter,
  validateRequest(productReportSchema),
  reportController.reportProduct
);

// Signaler une boutique (public)
router.post('/store/:vendorId',
  publicLimiter,
  validateRequest(storeReportSchema),
  reportController.reportStore
);

// Admin — liste signalements produits
router.get('/admin/products',
  authenticate,
  reportController.getProductReports
);

// Admin — liste signalements boutiques
router.get('/admin/stores',
  authenticate,
  reportController.getStoreReports
);

// Admin — changer statut signalement produit
router.put('/admin/product/:id/status',
  authenticate,
  validateRequest(Joi.object({ status: Joi.string().valid('pending', 'reviewed', 'resolved', 'dismissed').required() })),
  reportController.updateProductReportStatus
);

// Admin — changer statut signalement boutique
router.put('/admin/store/:id/status',
  authenticate,
  validateRequest(Joi.object({ status: Joi.string().valid('pending', 'reviewed', 'resolved', 'dismissed').required() })),
  reportController.updateStoreReportStatus
);

module.exports = router;
