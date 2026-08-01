/**
 * Routes des produits
 * 
 * Définit les endpoints pour la gestion des produits
 */

const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');

// Récupérer tous les produits
// GET /api/products
router.get('/', productController.getProducts);

// Récupérer un produit par ID
// GET /api/products/:id
router.get('/:id', productController.getProductById);

// Créer un nouveau produit
// POST /api/products
router.post('/', productController.createProduct);

module.exports = router;
