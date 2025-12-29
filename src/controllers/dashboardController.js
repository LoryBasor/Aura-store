// src/controllers/dashboardController.js
const statsService = require('../services/statsService');
const { successResponse } = require('../utils/response');

/**
 * Contrôleur du dashboard
 */
class DashboardController {
  /**
   * Récupérer toutes les statistiques du dashboard
   * GET /api/dashboard
   */
  async getDashboard(req, res, next) {
    try {
      const stats = await statsService.getDashboardStats(req.user.id);
      
      return successResponse(res, stats);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Récupérer les statistiques par période
   * GET /api/dashboard/stats/:period
   */
  async getStatsByPeriod(req, res, next) {
    try {
      const { period } = req.params;
      const stats = await statsService.getStatsByPeriod(req.user.id, period);
      
      return successResponse(res, { stats, period });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new DashboardController();