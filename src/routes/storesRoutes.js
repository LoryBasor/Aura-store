// src/routes/storeRoutes.js
const express = require('express');
const storeController = require('../controllers/storeController');
const { publicLimiter } = require('../middlewares/rateLimiter');

const router = express.Router();

/**
 * Route publique pour afficher tous les produits d'une boutique
 * GET /api/store/:storeSlug
 */
router.get('/:storeSlug', publicLimiter, storeController.getStoreBySlug);

module.exports = router;