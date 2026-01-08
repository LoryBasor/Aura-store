// src/controllers/categoryController.js
const categoryService = require('../services/categoryService');
const { successResponse, createdResponse } = require('../utils/response');

/**
 * Contrôleur de gestion des catégories
 */
class CategoryController {
  /**
   * Créer une nouvelle catégorie
   * POST /api/categories
   */
  async createCategory(req, res, next) {
    try {
      const category = await categoryService.createCategory(
        req.user.id,
        req.body
      );
      
      return createdResponse(res, { category }, 'Catégorie créée avec succès');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Récupérer toutes les catégories du vendeur
   * GET /api/categories
   */
  async getCategories(req, res, next) {
    try {
      const categories = await categoryService.getCategoriesByUser(req.user.id);
      
      return successResponse(res, { categories });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Récupérer une catégorie par ID
   * GET /api/categories/:id
   */
  async getCategory(req, res, next) {
    try {
      const category = await categoryService.getCategoryById(
        req.params.id,
        req.user.id
      );
      
      return successResponse(res, { category });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Mettre à jour une catégorie
   * PUT /api/categories/:id
   */
  async updateCategory(req, res, next) {
    try {
      const category = await categoryService.updateCategory(
        req.params.id,
        req.user.id,
        req.body
      );
      
      return successResponse(res, { category }, 'Catégorie mise à jour');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Supprimer une catégorie
   * DELETE /api/categories/:id
   */
  async deleteCategory(req, res, next) {
    try {
      await categoryService.deleteCategory(req.params.id, req.user.id);
      
      return successResponse(res, null, 'Catégorie supprimée');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Réorganiser les catégories
   * POST /api/categories/reorder
   */
  async reorderCategories(req, res, next) {
    try {
      const categories = await categoryService.reorderCategories(
        req.user.id,
        req.body.orders
      );
      
      return successResponse(res, { categories }, 'Ordre mis à jour');
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new CategoryController();