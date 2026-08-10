// src/controllers/admin/adminCategoryController.js
const marketplaceCategoryService = require('../../services/marketplaceCategoryService');
const { successResponse, createdResponse } = require('../../utils/response');
const { AppError } = require('../../middlewares/errorHandler');
const { slugify } = require('../../utils/helpers');

/**
 * Contrôleur Admin — Gestion des catégories Marketplace
 * Accessible uniquement aux SUPER_ADMIN (garanti par adminRoutes.js)
 */
class AdminCategoryController {
  /**
   * GET /api/admin/marketplace-categories
   */
  async listCategories(req, res, next) {
    try {
      const categories = await marketplaceCategoryService.getAllCategories();
      return successResponse(res, { categories });
    } catch (error) { next(error); }
  }

  /**
   * POST /api/admin/marketplace-categories
   */
  async createCategory(req, res, next) {
    try {
      const { name, description, icon, display_order, is_active } = req.body;
      if (!name || !name.trim()) throw new AppError('Le nom est requis', 400);

      const slug = slugify(name);
      const existing = await marketplaceCategoryService.getCategoryBySlug(slug);
      if (existing) throw new AppError('Une catégorie avec ce nom (slug) existe déjà', 409);

      const id = await marketplaceCategoryService.createCategory({ name: name.trim(), slug, description, icon, display_order, is_active });
      const category = await marketplaceCategoryService.getCategoryById(id);
      return createdResponse(res, { category }, 'Catégorie Marketplace créée');
    } catch (error) { next(error); }
  }

  /**
   * GET /api/admin/marketplace-categories/:id
   */
  async getCategory(req, res, next) {
    try {
      const category = await marketplaceCategoryService.getCategoryById(req.params.id);
      if (!category) throw new AppError('Catégorie introuvable', 404);
      return successResponse(res, { category });
    } catch (error) { next(error); }
  }

  /**
   * PUT /api/admin/marketplace-categories/:id
   */
  async updateCategory(req, res, next) {
    try {
      const { name, description, icon, display_order, is_active } = req.body;
      if (!name || !name.trim()) throw new AppError('Le nom est requis', 400);

      const existing = await marketplaceCategoryService.getCategoryById(req.params.id);
      if (!existing) throw new AppError('Catégorie introuvable', 404);

      const slug = slugify(name);
      await marketplaceCategoryService.updateCategory(req.params.id, { name: name.trim(), slug, description, icon, display_order, is_active });
      const updated = await marketplaceCategoryService.getCategoryById(req.params.id);
      return successResponse(res, { category: updated }, 'Catégorie mise à jour');
    } catch (error) { next(error); }
  }

  /**
   * PATCH /api/admin/marketplace-categories/:id/toggle
   */
  async toggleStatus(req, res, next) {
    try {
      const category = await marketplaceCategoryService.getCategoryById(req.params.id);
      if (!category) throw new AppError('Catégorie introuvable', 404);
      await marketplaceCategoryService.toggleStatus(req.params.id, !category.is_active);
      return successResponse(res, null, `Catégorie ${category.is_active ? 'désactivée' : 'activée'}`);
    } catch (error) { next(error); }
  }

  /**
   * DELETE /api/admin/marketplace-categories/:id
   */
  async deleteCategory(req, res, next) {
    try {
      const category = await marketplaceCategoryService.getCategoryById(req.params.id);
      if (!category) throw new AppError('Catégorie introuvable', 404);
      if (category.product_count > 0) {
        throw new AppError(`Impossible de supprimer : ${category.product_count} produit(s) référencent cette catégorie. Réassignez-les d'abord.`, 400);
      }
      await marketplaceCategoryService.deleteCategory(req.params.id);
      return successResponse(res, null, 'Catégorie Marketplace supprimée');
    } catch (error) { next(error); }
  }
}

module.exports = new AdminCategoryController();
