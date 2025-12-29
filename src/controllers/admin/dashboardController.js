// src/controllers/admin/dashboardController.js
const adminDashboardService = require('../../services/admin/dashboardService');
const { successResponse } = require('../../utils/response');

/**
 * Contrôleur du dashboard Super Admin
 */
class AdminDashboardController {
  /**
   * Dashboard global
   * GET /api/admin/dashboard
   */
  async getDashboard(req, res, next) {
    try {
      const [globalStats, topVendors, recentVendors, recentOrders, conversionRate] = await Promise.all([
        adminDashboardService.getGlobalStats(),
        adminDashboardService.getTopVendors(10),
        adminDashboardService.getRecentVendors(10),
        adminDashboardService.getRecentOrders(20),
        adminDashboardService.getConversionRate()
      ]);

      return successResponse(res, {
        stats: globalStats,
        top_vendors: topVendors,
        recent_vendors: recentVendors,
        recent_orders: recentOrders,
        conversion: conversionRate
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Statistiques par période
   * GET /api/admin/dashboard/stats/:period
   */
  async getStatsByPeriod(req, res, next) {
    try {
      const { period } = req.params;
      const stats = await adminDashboardService.getStatsByPeriod(period);
      
      return successResponse(res, { stats, period });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Abonnements expirant bientôt
   * GET /api/admin/dashboard/expiring-subscriptions
   */
  async getExpiringSoon(req, res, next) {
    try {
      const { days = 7 } = req.query;
      const subscriptions = await adminDashboardService.getExpiringSoon(parseInt(days));
      
      return successResponse(res, { subscriptions, days: parseInt(days) });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Distribution des abonnements par plan
   * GET /api/admin/dashboard/subscription-distribution
   */
  async getSubscriptionDistribution(req, res, next) {
    try {
      const distribution = await adminDashboardService.getSubscriptionDistribution();
      
      return successResponse(res, { distribution });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new AdminDashboardController();