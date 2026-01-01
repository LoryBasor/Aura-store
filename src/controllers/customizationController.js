// src/controllers/customizationController.js
const storeCustomizationService = require('../services/storeCustomizationService');
const { successResponse } = require('../utils/response');
const { getImageUrl } = require('../config/upload');

/**
 * Contrôleur de personnalisation (BUSINESS uniquement)
 */
class CustomizationController {
  /**
   * Récupère la configuration
   * GET /api/customization
   */
  async getCustomization(req, res, next) {
    try {
      const config = await storeCustomizationService.getCustomization(req.user.id);
      
      // Formatter les URLs d'images
      config.logo_url = getImageUrl(config.logo_url);
      config.banner_url = getImageUrl(config.banner_url);
      
      return successResponse(res, { customization: config });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Met à jour la configuration
   * PUT /api/customization
   */
  async updateCustomization(req, res, next) {
    try {
      const updates = req.body;
      
      const config = await storeCustomizationService.updateCustomization(
        req.user.id,
        updates
      );
      
      config.logo_url = getImageUrl(config.logo_url);
      config.banner_url = getImageUrl(config.banner_url);
      
      return successResponse(
        res,
        { customization: config },
        'Personnalisation mise à jour'
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * Upload le logo
   * POST /api/customization/logo
   */
  async uploadLogo(req, res, next) {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'Aucun fichier fourni'
        });
      }

      const logoPath = `/${req.file.path.replace(/\\/g, '/')}`;
      
      const config = await storeCustomizationService.uploadLogo(
        req.user.id,
        logoPath
      );
      
      config.logo_url = getImageUrl(config.logo_url);
      config.banner_url = getImageUrl(config.banner_url);
      
      return successResponse(
        res,
        { customization: config },
        'Logo uploadé avec succès'
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * Upload la bannière
   * POST /api/customization/banner
   */
  async uploadBanner(req, res, next) {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'Aucun fichier fourni'
        });
      }

      const bannerPath = `/${req.file.path.replace(/\\/g, '/')}`;
      
      const config = await storeCustomizationService.uploadBanner(
        req.user.id,
        bannerPath
      );
      
      config.logo_url = getImageUrl(config.logo_url);
      config.banner_url = getImageUrl(config.banner_url);
      
      return successResponse(
        res,
        { customization: config },
        'Bannière uploadée avec succès'
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * Supprime le logo
   * DELETE /api/customization/logo
   */
  async deleteLogo(req, res, next) {
    try {
      const config = await storeCustomizationService.deleteLogo(req.user.id);
      
      config.logo_url = getImageUrl(config.logo_url);
      config.banner_url = getImageUrl(config.banner_url);
      
      return successResponse(
        res,
        { customization: config },
        'Logo supprimé'
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * Supprime la bannière
   * DELETE /api/customization/banner
   */
  async deleteBanner(req, res, next) {
    try {
      const config = await storeCustomizationService.deleteBanner(req.user.id);
      
      config.logo_url = getImageUrl(config.logo_url);
      config.banner_url = getImageUrl(config.banner_url);
      
      return successResponse(
        res,
        { customization: config },
        'Bannière supprimée'
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * Réinitialise à la configuration par défaut
   * POST /api/customization/reset
   */
  async resetToDefault(req, res, next) {
    try {
      const config = await storeCustomizationService.resetToDefault(req.user.id);
      
      config.logo_url = getImageUrl(config.logo_url);
      config.banner_url = getImageUrl(config.banner_url);
      
      return successResponse(
        res,
        { customization: config },
        'Configuration réinitialisée'
      );
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new CustomizationController();