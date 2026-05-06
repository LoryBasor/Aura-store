// src/controllers/admin/adminProductController.js
const { pool } = require('../../config/database');
const { successResponse } = require('../../utils/response');
const { AppError } = require('../../middlewares/errorHandler');
const productService = require('../../services/productService');

class AdminProductController {
  /**
   * Basculer l'indisponibilité forcée par l'admin
   * PATCH /api/admin/products/:id/toggle-admin-disable
   */
  async toggleAdminDisable(req, res, next) {
    try {
      const { id } = req.params;
      
      // Récupérer le statut actuel
      const [products] = await pool.execute(
        'SELECT admin_disabled, user_id FROM products WHERE id = ? AND deleted_at IS NULL',
        [id]
      );

      if (products.length === 0) {
        throw new AppError('Produit introuvable', 404);
      }

      const newStatus = !products[0].admin_disabled;

      // Mettre à jour admin_disabled ET is_available (si désactivé par admin, on met is_available à false)
      await pool.execute(
        'UPDATE products SET admin_disabled = ?, is_available = ? WHERE id = ?',
        [newStatus, newStatus ? false : true, id]
      );

      return successResponse(res, { admin_disabled: newStatus }, `Produit ${newStatus ? 'désactivé' : 'réactivé'} par l'admin`);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Supprimer un produit (Admin)
   * DELETE /api/admin/products/:id
   */
  async deleteProduct(req, res, next) {
    try {
      const { id } = req.params;

      // Récupérer le user_id pour appeler le productService
      const [products] = await pool.execute(
        'SELECT user_id FROM products WHERE id = ? AND deleted_at IS NULL',
        [id]
      );

      if (products.length === 0) {
        throw new AppError('Produit introuvable', 404);
      }

      await productService.deleteProduct(id, products[0].user_id);

      return successResponse(res, null, 'Produit supprimé par l\'admin');
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new AdminProductController();
