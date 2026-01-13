// src/controllers/admin/userController.js
const userManagementService = require('../../services/admin/userManagementService');
const { successResponse, paginatedResponse } = require('../../utils/response');
const { captureOldState } = require('../../middlewares/auditLogger');

/**
 * Contrôleur de gestion des vendeurs (Super Admin)
 */
class AdminUserController {
  /**
   * Liste tous les vendeurs
   * GET /api/admin/vendors
   */
  async listVendors(req, res, next) {
    try {
      const { page, limit, status, search } = req.query;
      
      const result = await userManagementService.listAllVendors({
        page: parseInt(page) || 1,
        limit: parseInt(limit) || 20,
        status,
        search
      });
      
      return paginatedResponse(res, result.vendors, result.pagination);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Récupère les détails d'un vendeur
   * GET /api/admin/vendors/:userId
   */
  async getVendorDetails(req, res, next) {
    try {
      const details = await userManagementService.getVendorDetails(req.params.userId);
      
      return successResponse(res, details);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Suspend un vendeur
   * POST /api/admin/vendors/:userId/suspend
   */
  async suspendVendor(req, res, next) {
    try {
      const { reason } = req.body;
      
      // Capturer l'état avant modification (pour audit)
      await captureOldState(req, 'users', req.params.userId);
      
      await userManagementService.suspendVendor(
        req.params.userId,
        reason,
        req.user.id
      );
      
      req.auditNotes = `Suspension: ${reason}`;
      
      return successResponse(res, null, 'Vendeur suspendu avec succès');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Réactive un vendeur
   * POST /api/admin/vendors/:userId/activate
   */
  async activateVendor(req, res, next) {
    try {
      await captureOldState(req, 'users', req.params.userId);
      
      await userManagementService.activateVendor(
        req.params.userId,
        req.user.id
      );
      
      return successResponse(res, null, 'Vendeur réactivé avec succès');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Désactive définitivement un vendeur
   * POST /api/admin/vendors/:userId/deactivate
   */
  async deactivateVendor(req, res, next) {
    try {
      await captureOldState(req, 'users', req.params.userId);
      
      await userManagementService.deactivateVendor(
        req.params.userId,
        req.user.id
      );
      
      return successResponse(res, null, 'Vendeur désactivé avec succès');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Réinitialise le mot de passe d'un vendeur
   * POST /api/admin/vendors/:userId/reset-password
   */
  async resetPassword(req, res, next) {
    try {
      const { must_change_password = true } = req.body;
      
      // Générer un mot de passe temporaire
      const tempPassword = userManagementService.generateTemporaryPassword();
      
      await userManagementService.resetVendorPassword(
        req.params.userId,
        tempPassword,
        must_change_password,
        req.user.id
      );
      
      req.auditNotes = 'Mot de passe réinitialisé';
      
      return successResponse(
        res,
        { temporary_password: tempPassword },
        'Mot de passe réinitialisé. Communiquez le mot de passe temporaire au vendeur.'
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * Marque un vendeur comme vérifié
   * POST /api/admin/vendors/:userId/verify
   */
  async verifyVendor(req, res, next) {
    try {
      await captureOldState(req, 'users', req.params.userId);
      
      await userManagementService.verifyVendor(
        req.params.userId,
        req.user.id
      );
      
      req.auditNotes = 'Vendeur marqué comme vérifié';
      
      return successResponse(res, null, 'Vendeur marqué comme vérifié avec succès');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Retire la vérification d'un vendeur
   * POST /api/admin/vendors/:userId/unverify
   */
  async unverifyVendor(req, res, next) {
    try {
      await captureOldState(req, 'users', req.params.userId);
      
      await userManagementService.unverifyVendor(
        req.params.userId,
        req.user.id
      );
      
      req.auditNotes = 'Vérification du vendeur retirée';
      
      return successResponse(res, null, 'Vérification du vendeur retirée avec succès');
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new AdminUserController();