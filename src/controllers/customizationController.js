// src/controllers/customizationController.js
const storeCustomizationService = require('../services/storeCustomizationService');
const { successResponse } = require('../utils/response');
const { uploadImage } = require('../config/cloudinary');

/**
 * Contrôleur de personnalisation (BUSINESS uniquement)
 * Utilise Cloudinary pour l'upload des images
 */
class CustomizationController {
  /**
   * Récupère la configuration
   * GET /api/customization
   */
  async getCustomization(req, res, next) {
    try {
      const config = await storeCustomizationService.getCustomization(req.user.id);
      
      // Les URLs Cloudinary sont déjà complètes, pas de transformation nécessaire
      
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
   * Upload le logo vers Cloudinary
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

      // Upload vers Cloudinary
      let logoData;
      try {
        const uploadResult = await uploadImage(
          req.file.buffer,
          'customization/logos',
          req.user.id
        );
        
        logoData = {
          url: uploadResult.url,
          public_id: uploadResult.public_id
        };
      } catch (uploadError) {
        console.error('Erreur upload logo:', uploadError);
        return res.status(500).json({
          success: false,
          message: 'Échec de l\'upload du logo'
        });
      }
      
      const config = await storeCustomizationService.uploadLogo(
        req.user.id,
        logoData
      );
      
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
   * Upload la bannière vers Cloudinary
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

      // Upload vers Cloudinary
      let bannerData;
      try {
        const uploadResult = await uploadImage(
          req.file.buffer,
          'customization/banners',
          req.user.id
        );
        
        bannerData = {
          url: uploadResult.url,
          public_id: uploadResult.public_id
        };
      } catch (uploadError) {
        console.error('Erreur upload bannière:', uploadError);
        return res.status(500).json({
          success: false,
          message: 'Échec de l\'upload de la bannière'
        });
      }
      
      const config = await storeCustomizationService.uploadBanner(
        req.user.id,
        bannerData
      );
      
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
   * Supprime le logo de Cloudinary
   * DELETE /api/customization/logo
   */
  async deleteLogo(req, res, next) {
    try {
      const config = await storeCustomizationService.deleteLogo(req.user.id);
      
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
   * Supprime la bannière de Cloudinary
   * DELETE /api/customization/banner
   */
  async deleteBanner(req, res, next) {
    try {
      const config = await storeCustomizationService.deleteBanner(req.user.id);
      
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