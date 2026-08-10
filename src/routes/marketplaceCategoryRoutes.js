// src/routes/marketplaceCategoryRoutes.js
// Routes PUBLIQUES pour les catégories Marketplace (lecture seule)
const express = require('express');
const marketplaceCategoryService = require('../services/marketplaceCategoryService');
const { successResponse } = require('../utils/response');

const router = express.Router();

/**
 * GET /api/marketplace-categories
 * Retourne la liste des catégories Marketplace actives (pour le frontend vendeur et les filtres publics)
 */
router.get('/', async (req, res, next) => {
  try {
    const categories = await marketplaceCategoryService.getActiveCategories();
    return successResponse(res, { categories });
  } catch (error) { next(error); }
});

module.exports = router;
