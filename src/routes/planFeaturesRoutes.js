// src/routes/planFeaturesRoutes.js
const express = require('express');
const { authenticate } = require('../middlewares/auth');
const { checkAccountStatus } = require('../middlewares/authorization');
const { requireActiveSubscription } = require('../middlewares/subscriptionCheck');
const { requireMinimalPlan, checkPlanAccess } = require('../middlewares/checkPlanAccess');
const { apiLimiter } = require('../middlewares/rateLimiter');
const { upload } = require('../config/upload');
const Joi = require('joi');
const validateRequest = require('../middlewares/validateRequest');

// Controllers
const advancedStatsController = require('../controllers/advancedStatsController');
const exportController = require('../controllers/exportController');
const customizationController = require('../controllers/customizationController');
const integrationsController = require('../controllers/integrationsController');

const router = express.Router();

/**
 * Toutes les routes nécessitent authentification et abonnement actif
 */
router.use(authenticate);
router.use(checkAccountStatus);
router.use(requireActiveSubscription);
router.use(apiLimiter);

// ============================================
// ROUTES STATISTIQUES AVANCÉES (PRO et BUSINESS)
// ============================================

/**
 * Évolution des commandes
 * GET /api/features/stats/evolution
 */
router.get(
  '/stats/evolution',
  requireMinimalPlan('pro'),
  advancedStatsController.getOrdersEvolution
);

/**
 * Statistiques par statut
 * GET /api/features/stats/by-status
 */
router.get(
  '/stats/by-status',
  requireMinimalPlan('pro'),
  advancedStatsController.getOrdersByStatus
);

/**
 * Top produits
 * GET /api/features/stats/top-products
 */
router.get(
  '/stats/top-products',
  requireMinimalPlan('pro'),
  advancedStatsController.getTopProducts
);

/**
 * Métriques de conversion
 * GET /api/features/stats/conversion
 */
router.get(
  '/stats/conversion',
  requireMinimalPlan('pro'),
  advancedStatsController.getConversionMetrics
);

/**
 * Commandes par heure
 * GET /api/features/stats/by-hour
 */
router.get(
  '/stats/by-hour',
  requireMinimalPlan('pro'),
  advancedStatsController.getOrdersByHour
);

/**
 * Analyse clients
 * GET /api/features/stats/customers
 */
router.get(
  '/stats/customers',
  requireMinimalPlan('pro'),
  advancedStatsController.getCustomerAnalysis
);

/**
 * Prévisions
 * GET /api/features/stats/forecast
 */
router.get(
  '/stats/forecast',
  requireMinimalPlan('pro'),
  advancedStatsController.getForecast
);

/**
 * Dashboard complet
 * GET /api/features/stats/complete
 */
router.get(
  '/stats/complete',
  requireMinimalPlan('pro'),
  advancedStatsController.getCompleteStats
);

// ============================================
// ROUTES EXPORT (PRO et BUSINESS)
// ============================================

/**
 * Export commandes JSON
 * GET /api/features/export/orders/json
 */
router.get(
  '/export/orders/json',
  requireMinimalPlan('pro'),
  exportController.exportOrdersJSON
);

/**
 * Export produits JSON
 * GET /api/features/export/products/json
 */
router.get(
  '/export/products/json',
  requireMinimalPlan('pro'),
  exportController.exportProductsJSON
);

/**
 * Export statistiques JSON
 * GET /api/features/export/stats/json
 */
router.get(
  '/export/stats/json',
  requireMinimalPlan('pro'),
  exportController.exportStatsJSON
);

/**
 * Export commandes Excel
 * GET /api/features/export/orders/excel
 */
router.get(
  '/export/orders/excel',
  requireMinimalPlan('pro'),
  exportController.exportOrdersExcel
);

/**
 * Export produits Excel
 * GET /api/features/export/products/excel
 */
router.get(
  '/export/products/excel',
  requireMinimalPlan('pro'),
  exportController.exportProductsExcel
);

// ============================================
// ROUTES PERSONNALISATION (BUSINESS uniquement)
// ============================================

/**
 * Récupère la configuration
 * GET /api/features/customization
 */
router.get(
  '/customization',
  checkPlanAccess('business'),
  customizationController.getCustomization
);

/**
 * Met à jour la configuration
 * PUT /api/features/customization
 */
router.put(
  '/customization',
  checkPlanAccess('business'),
  validateRequest(Joi.object({
    store_title: Joi.string().max(255).optional().allow('', null),
    store_description: Joi.string().max(1000).optional().allow('', null),
    primary_color: Joi.string().pattern(/^#[0-9A-Fa-f]{3,8}$/).optional(),
    secondary_color: Joi.string().pattern(/^#[0-9A-Fa-f]{3,8}$/).optional(),
    text_color: Joi.string().pattern(/^#[0-9A-Fa-f]{3,8}$/).optional(),
    title_color: Joi.string().pattern(/^#[0-9A-Fa-f]{3,8}$/).optional(),
    description_color: Joi.string().pattern(/^#[0-9A-Fa-f]{3,8}$/).optional(),
    background_color: Joi.string().pattern(/^#[0-9A-Fa-f]{3,8}$/).optional(),
    font_family: Joi.string().max(100).optional().allow('', null),
    product_layout: Joi.string().valid('grid', 'list').optional(),
    button_style: Joi.string().valid('solid', 'outline', 'rounded').optional(),
    footer_text: Joi.string().max(500).optional().allow('', null),
    order_message: Joi.string().max(500).optional().allow('', null),
    show_product_count: Joi.boolean().optional(),
    show_social_links: Joi.boolean().optional(),
    show_contact_info: Joi.boolean().optional()
  })),
  customizationController.updateCustomization
);

/**
 * Upload logo
 * POST /api/features/customization/logo
 */
router.post(
  '/customization/logo',
  checkPlanAccess('business'),
  upload.single('logo'),
  customizationController.uploadLogo
);

/**
 * Upload bannière
 * POST /api/features/customization/banner
 */
router.post(
  '/customization/banner',
  checkPlanAccess('business'),
  upload.single('banner'),
  customizationController.uploadBanner
);

/**
 * Supprime le logo
 * DELETE /api/features/customization/logo
 */
router.delete(
  '/customization/logo',
  checkPlanAccess('business'),
  customizationController.deleteLogo
);

/**
 * Supprime la bannière
 * DELETE /api/features/customization/banner
 */
router.delete(
  '/customization/banner',
  checkPlanAccess('business'),
  customizationController.deleteBanner
);

/**
 * Réinitialise à la config par défaut
 * POST /api/features/customization/reset
 */
router.post(
  '/customization/reset',
  checkPlanAccess('business'),
  customizationController.resetToDefault
);

// ============================================
// ROUTES INTÉGRATIONS SOCIALES (BUSINESS uniquement)
// ============================================

/**
 * Récupère les intégrations
 * GET /api/features/integrations
 */
router.get(
  '/integrations',
  checkPlanAccess('business'),
  integrationsController.getIntegrations
);

/**
 * Met à jour les intégrations
 * PUT /api/features/integrations
 */
router.put(
  '/integrations',
  checkPlanAccess('business'),
  validateRequest(Joi.object({
    whatsapp_number: Joi.string().pattern(/^[0-9+\s()-]+$/).optional(),
    whatsapp_enabled: Joi.boolean().optional(),
    instagram_url: Joi.string().max(255).optional().allow('', null),
    instagram_enabled: Joi.boolean().optional(),
    facebook_url: Joi.string().max(255).optional().allow('', null),
    facebook_enabled: Joi.boolean().optional(),
    custom_order_message: Joi.string().max(1000).optional()
  })),
  integrationsController.updateIntegrations
);

/**
 * Toggle WhatsApp
 * POST /api/features/integrations/whatsapp/toggle
 */
router.post(
  '/integrations/whatsapp/toggle',
  checkPlanAccess('business'),
  validateRequest(Joi.object({
    enabled: Joi.boolean().required()
  })),
  integrationsController.toggleWhatsApp
);

/**
 * Toggle Instagram
 * POST /api/features/integrations/instagram/toggle
 */
router.post(
  '/integrations/instagram/toggle',
  checkPlanAccess('business'),
  validateRequest(Joi.object({
    enabled: Joi.boolean().required()
  })),
  integrationsController.toggleInstagram
);

/**
 * Toggle Facebook
 * POST /api/features/integrations/facebook/toggle
 */
router.post(
  '/integrations/facebook/toggle',
  checkPlanAccess('business'),
  validateRequest(Joi.object({
    enabled: Joi.boolean().required()
  })),
  integrationsController.toggleFacebook
);

/**
 * Teste le message WhatsApp
 * POST /api/features/integrations/whatsapp/test
 */
router.post(
  '/integrations/whatsapp/test',
  checkPlanAccess('business'),
  integrationsController.testWhatsAppMessage
);

/**
 * Aperçu du message personnalisé
 * GET /api/features/integrations/message-preview
 */
router.get(
  '/integrations/message-preview',
  checkPlanAccess('business'),
  integrationsController.getMessagePreview
);

module.exports = router;