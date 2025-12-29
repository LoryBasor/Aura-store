// src/controllers/productController.js
const productService = require('../services/productService');
const { successResponse, createdResponse } = require('../utils/response');
const { buildWhatsAppOrderUrl } = require('../utils/helpers');

/**
 * Contrôleur de gestion des produits
 */
class ProductController {
  /**
   * Créer un nouveau produit
   * POST /api/products
   */
  async createProduct(req, res, next) {
    try {
      const imagePath = req.file ? `/${req.file.path.replace(/\\/g, '/')}` : null;
       
      const product = await productService.createProduct(
        req.user.id,
        req.body,
        imagePath
      );
      
      return createdResponse(res, { product }, 'Produit créé avec succès');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Récupérer tous les produits du vendeur
   * GET /api/products/:search
   */
  async getProducts(req, res, next) {
    try {
      const page = req.params.page;
      const limit = req.params.limit;
      const is_available = req.params.is_available;
      const search = req.params.search;
      const result = await productService.getProductsByUser(req.user.id, search , {
        page: parseInt(page) || 1,
        limit: parseInt(limit) || 20,
        is_available: is_available
      });
      
      return successResponse(res, result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Récupérer un produit par ID
   * GET /api/products/:id
   */
  async getProduct(req, res, next) {
    try {
      const product = await productService.getProductById(
        req.params.id,
        req.user.id
      );
      
      return successResponse(res, { product });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Mettre à jour un produit
   * PUT /api/products/:id
   */
  async updateProduct(req, res, next) {
    try {
      const newImagePath = req.file ? `/${req.file.path.replace(/\\/g, '/')}` : null;
      
      const product = await productService.updateProduct(
        req.params.id,
        req.user.id,
        req.body,
        newImagePath
      );
      
      return successResponse(res, { product }, 'Produit mis à jour');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Supprimer un produit
   * DELETE /api/products/:id
   */
  async deleteProduct(req, res, next) {
    try {
      await productService.deleteProduct(req.params.id, req.user.id);
      
      return successResponse(res, null, 'Produit supprimé');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Récupérer un produit via son lien de partage (PUBLIC)
   * GET /p/:token
   */
  async getProductByShareLink(req, res, next) {
    try {
      const product = await productService.getProductByShareToken(req.params.token);
      
      // Générer le lien WhatsApp si numéro disponible
      let whatsapp_url = null;
      if (product.whatsapp_number) {
        whatsapp_url = buildWhatsAppOrderUrl(product, product.whatsapp_number);
      }
      
      return successResponse(res, {
        product,
        vendor: {
          business_name: product.business_name,
          store_slug: product.store_slug
        },
        whatsapp_url
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new ProductController();