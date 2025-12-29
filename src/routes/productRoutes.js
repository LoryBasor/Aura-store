// src/routes/productRoutes.js
const express = require('express');
const productController = require('../controllers/productController');
const { authenticate } = require('../middlewares/auth');
const { ensureOwnership } = require('../middlewares/tenantIsolation');
const { checkPlanLimit } = require('../middlewares/subscriptionCheck');
const validateRequest = require('../middlewares/validateRequest');
const { apiLimiter } = require('../middlewares/rateLimiter');
const { upload } = require('../config/upload');
const { productSchema } = require('../utils/validators');

const router = express.Router(); 

/**
 * Routes de gestion des produits
 * Préfixe: /api/products
 * Toutes les routes nécessitent l'authentification
 */

// Créer un produit (vérifier limite)
router.post(
  '/',
  authenticate,
  apiLimiter,
  checkPlanLimit('products'),
  upload.single('image'),
  validateRequest(productSchema),
  productController.createProduct
);

// Liste des produits du vendeur
router.get(
  '/:search/:is_available',
  authenticate,
  apiLimiter,
  productController.getProducts
);

// Détails d'un produit
router.get(
  '/:id',
  authenticate,
  apiLimiter,
  ensureOwnership('products', 'id'),
  productController.getProduct
);

// Mise à jour d'un produit
router.put(
  '/:id',
  authenticate,
  apiLimiter,
  ensureOwnership('products', 'id'),
  upload.single('image'),
  validateRequest(productSchema),
  productController.updateProduct
);

// Suppression d'un produit
router.delete(
  '/:id',
  authenticate,
  apiLimiter,
  ensureOwnership('products', 'id'),
  productController.deleteProduct
);

module.exports = router;