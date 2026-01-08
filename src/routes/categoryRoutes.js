// src/routes/categoryRoutes.js
const express = require('express');
const categoryController = require('../controllers/categoryController');
const { authenticate } = require('../middlewares/auth');
const { apiLimiter } = require('../middlewares/rateLimiter');

const router = express.Router();

/**
 * Routes de gestion des catégories
 * Préfixe: /api/categories
 * Toutes les routes nécessitent l'authentification
 */

// Créer une catégorie
router.post(
  '/',
  authenticate,
  apiLimiter,
  categoryController.createCategory
);

// Liste des catégories du vendeur
router.get(
  '/',
  authenticate,
  apiLimiter,
  categoryController.getCategories
);

// Réorganiser les catégories
router.post(
  '/reorder',
  authenticate,
  apiLimiter,
  categoryController.reorderCategories
);

// Détails d'une catégorie
router.get(
  '/:id',
  authenticate,
  apiLimiter,
  categoryController.getCategory
);

// Mise à jour d'une catégorie
router.put(
  '/:id',
  authenticate,
  apiLimiter,
  categoryController.updateCategory
);

// Suppression d'une catégorie
router.delete(
  '/:id',
  authenticate,
  apiLimiter,
  categoryController.deleteCategory
);

module.exports = router;