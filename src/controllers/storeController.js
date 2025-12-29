// src/controllers/storeController.js
const storeService = require("../services/storeService");
const { successResponse } = require('../utils/response');

/**
 * Contrôleur de la boutique publique
 */
class StoreController {
  /**
   * Récupère tous les produits d'une boutique par store_slug
   * GET /api/store/:storeSlug
   */
  async getStoreBySlug(req, res, next) {
    try {
      const { storeSlug } = req.params;

      const store = await storeService.getStore(storeSlug);
      return successResponse(res, store, "chargement de la boutique réussi ");

    } catch (error) {
      console.error('Erreur récupération boutique:', error);
      next(error);
    }
  }
}

module.exports = new StoreController();