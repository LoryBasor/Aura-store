// src/controllers/advancedStatsController.js
const advancedStatsService = require('../services/advancedStatsService');
const { successResponse } = require('../utils/response');

/**
 * Contrôleur des statistiques avancées (PRO et BUSINESS)
 */
class AdvancedStatsController {
  /**
   * Évolution des commandes
   * GET /api/features/stats/evolution?period=day&days=30&start=YYYY-MM-DD&end=YYYY-MM-DD
   */
  async getOrdersEvolution(req, res, next) {
    try {
      const { period = 'day', days = 30, start = null, end = null } = req.query;
      const evolution = await advancedStatsService.getOrdersEvolution(
        req.user.id, period, parseInt(days), start, end
      );
      return successResponse(res, { evolution, period, days: parseInt(days), start, end });
    } catch (error) { next(error); }
  }

  /**
   * Statistiques par statut
   * GET /api/features/stats/by-status
   */
  async getOrdersByStatus(req, res, next) {
    try {
      const stats = await advancedStatsService.getOrdersByStatus(req.user.id);
      return successResponse(res, { stats });
    } catch (error) { next(error); }
  }

  /**
   * Top produits
   * GET /api/features/stats/top-products?limit=10
   */
  async getTopProducts(req, res, next) {
    try {
      const { limit = 10 } = req.query;
      const products = await advancedStatsService.getTopProducts(req.user.id, parseInt(limit));
      return successResponse(res, { products });
    } catch (error) { next(error); }
  }

  /**
   * Métriques de conversion
   * GET /api/features/stats/conversion
   */
  async getConversionMetrics(req, res, next) {
    try {
      const metrics = await advancedStatsService.getConversionMetrics(req.user.id);
      return successResponse(res, { metrics });
    } catch (error) { next(error); }
  }

  /**
   * Commandes par heure
   * GET /api/features/stats/by-hour
   */
  async getOrdersByHour(req, res, next) {
    try {
      const stats = await advancedStatsService.getOrdersByHour(req.user.id);
      return successResponse(res, { stats });
    } catch (error) { next(error); }
  }

  /**
   * Analyse clients
   * GET /api/features/stats/customers
   */
  async getCustomerAnalysis(req, res, next) {
    try {
      const analysis = await advancedStatsService.getCustomerAnalysis(req.user.id);
      return successResponse(res, { analysis });
    } catch (error) { next(error); }
  }

  /**
   * Prévisions
   * GET /api/features/stats/forecast
   */
  async getForecast(req, res, next) {
    try {
      const forecast = await advancedStatsService.getForecast(req.user.id);
      return successResponse(res, { forecast });
    } catch (error) { next(error); }
  }

  /**
   * Stats pour une plage de dates
   * GET /api/features/stats/by-date-range?start=YYYY-MM-DD&end=YYYY-MM-DD
   */
  async getStatsByDateRange(req, res, next) {
    try {
      const { start, end } = req.query;
      if (!start || !end) {
        return res.status(400).json({ error: 'Les paramètres start et end sont requis.' });
      }
      const stats = await advancedStatsService.getStatsByDateRange(req.user.id, start, end);
      return successResponse(res, { stats, start, end });
    } catch (error) { next(error); }
  }

  /**
   * Comparer deux périodes
   * GET /api/features/stats/compare?p1Start=...&p1End=...&p2Start=...&p2End=...
   */
  async compareStatsPeriods(req, res, next) {
    try {
      const { p1Start, p1End, p2Start, p2End } = req.query;
      if (!p1Start || !p1End || !p2Start || !p2End) {
        return res.status(400).json({ error: 'Les 4 paramètres de période sont requis.' });
      }
      const comparison = await advancedStatsService.compareStatsPeriods(
        req.user.id, p1Start, p1End, p2Start, p2End
      );
      return successResponse(res, { comparison });
    } catch (error) { next(error); }
  }

  /**
   * Dashboard complet des stats avancées
   * GET /api/features/stats/complete
   */
  async getCompleteStats(req, res, next) {
    try {
      const [evolution, byStatus, topProducts, conversion, customers, forecast] = await Promise.all([
        advancedStatsService.getOrdersEvolution(req.user.id, 'day', 30),
        advancedStatsService.getOrdersByStatus(req.user.id),
        advancedStatsService.getTopProducts(req.user.id, 5),
        advancedStatsService.getConversionMetrics(req.user.id),
        advancedStatsService.getCustomerAnalysis(req.user.id),
        advancedStatsService.getForecast(req.user.id)
      ]);
      return successResponse(res, { evolution, by_status: byStatus, top_products: topProducts, conversion, customers, forecast });
    } catch (error) { next(error); }
  }
}

module.exports = new AdvancedStatsController();