// src/routes/marketplaceRoutes.js
const express = require('express');
const marketplaceController = require('../controllers/marketplaceController');
const { publicLimiter } = require('../middlewares/rateLimiter');

const router = express.Router();

/**
 * Routes publiques du marketplace
 */

// Page principale marketplace
router.get('/', publicLimiter, marketplaceController.getHome);

// Page liste produits
router.get('/products', publicLimiter, marketplaceController.getProducts);

// Page liste boutiques
router.get('/stores', publicLimiter, marketplaceController.getStores);

// APIs pour les filtres AJAX
router.get('/api/products', publicLimiter, marketplaceController.getProductsAPI);
router.get('/api/stores', publicLimiter, marketplaceController.getStoresAPI);
router.get('/api/filters', publicLimiter, marketplaceController.getFilters);

module.exports = router;