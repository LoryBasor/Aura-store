// src/controllers/advancedStatsController.js
const advancedStatsService = require('../services/advancedStatsService');
const { successResponse } = require('../utils/response');

/**
 * Contrôleur des statistiques avancées (PRO et BUSINESS)
 */
class AdvancedStatsController {
  /**
   * Évolution des commandes
   * GET /api/stats/evolution?period=day&days=30
   */
  async getOrdersEvolution(req, res, next) {
    try {
      const { period = 'day', days = 30 } = req.query;
      
      const evolution = await advancedStatsService.getOrdersEvolution(
        req.user.id,
        period,
        parseInt(days)
      );
      
      return successResponse(res, { evolution, period, days: parseInt(days) });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Statistiques par statut
   * GET /api/stats/by-status
   */
  async getOrdersByStatus(req, res, next) {
    try {
      const stats = await advancedStatsService.getOrdersByStatus(req.user.id);
      
      return successResponse(res, { stats });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Top produits
   * GET /api/stats/top-products?limit=10
   */
  async getTopProducts(req, res, next) {
    try {
      const { limit = 10 } = req.query;
      
      const products = await advancedStatsService.getTopProducts(
        req.user.id,
        parseInt(limit)
      );
      
      return successResponse(res, { products });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Métriques de conversion
   * GET /api/stats/conversion
   */
  async getConversionMetrics(req, res, next) {
    try {
      const metrics = await advancedStatsService.getConversionMetrics(req.user.id);
      
      return successResponse(res, { metrics });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Commandes par heure
   * GET /api/stats/by-hour
   */
  async getOrdersByHour(req, res, next) {
    try {
      const stats = await advancedStatsService.getOrdersByHour(req.user.id);
      
      return successResponse(res, { stats });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Analyse clients
   * GET /api/stats/customers
   */
  async getCustomerAnalysis(req, res, next) {
    try {
      const analysis = await advancedStatsService.getCustomerAnalysis(req.user.id);
      
      return successResponse(res, { analysis });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Prévisions
   * GET /api/stats/forecast
   */
  async getForecast(req, res, next) {
    try {
      const forecast = await advancedStatsService.getForecast(req.user.id);
      
      return successResponse(res, { forecast });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Dashboard complet des stats avancées
   * GET /api/stats/complete
   */
  async getCompleteStats(req, res, next) {
    try {
      const [
        evolution,
        byStatus,
        topProducts,
        conversion,
        customers,
        forecast
      ] = await Promise.all([
        advancedStatsService.getOrdersEvolution(req.user.id, 'day', 30),
        advancedStatsService.getOrdersByStatus(req.user.id),
        advancedStatsService.getTopProducts(req.user.id, 5),
        advancedStatsService.getConversionMetrics(req.user.id),
        advancedStatsService.getCustomerAnalysis(req.user.id),
        advancedStatsService.getForecast(req.user.id)
      ]);

      return successResponse(res, {
        evolution,
        by_status: byStatus,
        top_products: topProducts,
        conversion,
        customers,
        forecast
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new AdvancedStatsController();