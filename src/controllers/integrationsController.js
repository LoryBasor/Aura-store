// src/controllers/integrationsController.js
const socialIntegrationsService = require('../services/socialIntegrationsService');
const { successResponse, errorResponse } = require('../utils/response');

/**
 * Contrôleur des intégrations sociales (BUSINESS uniquement)
 */
class IntegrationsController {
  /**
   * Récupère les intégrations
   * GET /api/integrations
   */
  async getIntegrations(req, res, next) {
    try {
      const integrations = await socialIntegrationsService.getIntegrations(req.user.id);
      
      return successResponse(res, { integrations });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Met à jour les intégrations
   * PUT /api/integrations
   */
  async updateIntegrations(req, res, next) {
    try {
      const updates = req.body;
      
      // Validations
      if (updates.whatsapp_number && !socialIntegrationsService.validateWhatsAppNumber(updates.whatsapp_number)) {
        return errorResponse(
          res,
          'Numéro WhatsApp invalide. Format requis : +237XXXXXXXXX',
          400
        );
      }

      if (updates.instagram_url && !socialIntegrationsService.validateInstagramUrl(updates.instagram_url)) {
        return errorResponse(
          res,
          'URL Instagram invalide. Entrez un nom d\'utilisateur (@username) ou une URL complète',
          400
        );
      }

      if (updates.facebook_url && !socialIntegrationsService.validateFacebookUrl(updates.facebook_url)) {
        return errorResponse(
          res,
          'URL Facebook invalide',
          400
        );
      }

      const integrations = await socialIntegrationsService.updateIntegrations(
        req.user.id,
        updates
      );
      
      return successResponse(
        res,
        { integrations },
        'Intégrations mises à jour'
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * Active/désactive WhatsApp
   * POST /api/integrations/whatsapp/toggle
   */
  async toggleWhatsApp(req, res, next) {
    try {
      const { enabled } = req.body;
      
      const integrations = await socialIntegrationsService.updateIntegrations(
        req.user.id,
        { whatsapp_enabled: enabled }
      );
      
      return successResponse(
        res,
        { integrations },
        `WhatsApp ${enabled ? 'activé' : 'désactivé'}`
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * Active/désactive Instagram
   * POST /api/integrations/instagram/toggle
   */
  async toggleInstagram(req, res, next) {
    try {
      const { enabled } = req.body;
      
      const integrations = await socialIntegrationsService.updateIntegrations(
        req.user.id,
        { instagram_enabled: enabled }
      );
      
      return successResponse(
        res,
        { integrations },
        `Instagram ${enabled ? 'activé' : 'désactivé'}`
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * Active/désactive Facebook
   * POST /api/integrations/facebook/toggle
   */
  async toggleFacebook(req, res, next) {
    try {
      const { enabled } = req.body;
      
      const integrations = await socialIntegrationsService.updateIntegrations(
        req.user.id,
        { facebook_enabled: enabled }
      );
      
      return successResponse(
        res,
        { integrations },
        `Facebook ${enabled ? 'activé' : 'désactivé'}`
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * Teste le message WhatsApp
   * POST /api/integrations/whatsapp/test
   */
  async testWhatsAppMessage(req, res, next) {
    try {
      const integrations = await socialIntegrationsService.getIntegrations(req.user.id);
      
      // Créer un produit de test
      const testProduct = {
        name: 'Produit Test',
        price: 10000,
        currency: 'FCFA'
      };

      const testUrl = socialIntegrationsService.generateWhatsAppUrl(
        testProduct,
        integrations
      );

      if (!testUrl) {
        return errorResponse(
          res,
          'WhatsApp non configuré. Ajoutez un numéro et activez l\'intégration.',
          400
        );
      }
      
      return successResponse(res, { 
        test_url: testUrl,
        message: 'Message de test généré avec succès'
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Aperçu du message personnalisé
   * GET /api/integrations/message-preview
   */
  async getMessagePreview(req, res, next) {
    try {
      const integrations = await socialIntegrationsService.getIntegrations(req.user.id);
      
      const sampleProduct = {
        name: 'Exemple de produit',
        price: 15000,
        currency: 'FCFA'
      };

      let preview = integrations.custom_order_message || '';
      preview = preview
        .replace('{{product_name}}', sampleProduct.name)
        .replace('{{product_price}}', sampleProduct.price)
        .replace('{{currency}}', sampleProduct.currency)
        .replace('{{quantity}}', '1');

      return successResponse(res, { 
        preview,
        original: integrations.custom_order_message
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new IntegrationsController();