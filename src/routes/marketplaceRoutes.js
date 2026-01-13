// src/routes/marketplaceRoutes.js
const express = require('express');
const marketplaceController = require('../controllers/marketplaceController');
const { publicLimiter } = require('../middlewares/rateLimiter');

const router = express.Router();

/**
 * Routes publiques du marketplace
 */

// APIs pour les filtres AJAX
router.get('/api/products', publicLimiter, marketplaceController.getProductsAPI);
router.get('/api/stores', publicLimiter, marketplaceController.getStoresAPI);
router.get('/api/filters', publicLimiter, marketplaceController.getFilters);

module.exports = router;