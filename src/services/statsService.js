// src/services/statsService.js
const { pool } = require('../config/database');

/**
 * Service de génération de statistiques pour le dashboard
 */
class StatsService {
  /**
   * Récupère toutes les statistiques du vendeur
   * @param {number} userId - ID du vendeur
   * @returns {object} Statistiques complètes
   */
  async getDashboardStats(userId) {
    const [overview, topProducts, recentOrders, customerStats] = await Promise.all([
      this.getOverviewStats(userId),
      this.getTopProducts(userId, 5),
      this.getRecentOrders(userId, 10),
      this.getCustomerStats(userId)
    ]);

    return {
      overview,
      top_products: topProducts,
      recent_orders: recentOrders,
      customer_stats: customerStats
    };
  }

  /**
   * Statistiques générales
   * @param {number} userId - ID du vendeur
   * @returns {object} Vue d'ensemble
   */
  async getOverviewStats(userId) {
    // Statistiques produits
    const [productStats] = await pool.execute(
      `SELECT 
        COUNT(*) as total_products,
        SUM(CASE WHEN is_available = 1 THEN 1 ELSE 0 END) as available_products,
        SUM(view_count) as total_views
       FROM products
       WHERE user_id = ? AND deleted_at IS NULL`,
      [userId]
    );

    // Statistiques commandes
    const [orderStats] = await pool.execute(
      `SELECT 
        COUNT(*) as total_orders,
        SUM(CASE WHEN status = 'nouvelle' THEN 1 ELSE 0 END) as pending_orders,
        SUM(CASE WHEN status = 'livree' THEN 1 ELSE 0 END) as delivered_orders,
        SUM(total_amount) as total_revenue,
        AVG(total_amount) as average_order_value
       FROM orders
       WHERE user_id = ? AND deleted_at IS NULL`,
      [userId]
    );

    // Statistiques clients
    const [customerStats] = await pool.execute(
      `SELECT 
        COUNT(*) as total_customers,
        COUNT(CASE WHEN last_order_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 END) as active_customers
       FROM customers
       WHERE user_id = ? AND deleted_at IS NULL`,
      [userId]
    );

    // Commandes du mois en cours
    const [monthOrders] = await pool.execute(
      `SELECT 
        COUNT(*) as orders_this_month,
        SUM(total_amount) as revenue_this_month
       FROM orders
       WHERE user_id = ? 
         AND deleted_at IS NULL
         AND MONTH(created_at) = MONTH(NOW())
         AND YEAR(created_at) = YEAR(NOW())`,
      [userId]
    );

    return {
      products: {
        total: productStats[0].total_products || 0,
        available: productStats[0].available_products || 0,
        total_views: productStats[0].total_views || 0
      },
      orders: {
        total: orderStats[0].total_orders || 0,
        pending: orderStats[0].pending_orders || 0,
        delivered: orderStats[0].delivered_orders || 0,
        this_month: monthOrders[0].orders_this_month || 0
      },
      revenue: {
        total: parseFloat(orderStats[0].total_revenue || 0),
        average_order: parseFloat(orderStats[0].average_order_value || 0),
        this_month: parseFloat(monthOrders[0].revenue_this_month || 0)
      },
      customers: {
        total: customerStats[0].total_customers || 0,
        active_30_days: customerStats[0].active_customers || 0
      }
    };
  }

  /**
   * Top produits les plus commandés
   * @param {number} userId - ID du vendeur
   * @param {number} limit - Nombre de produits
   * @returns {array} Liste des top produits
   */
  async getTopProducts(userId, limit = 5) {
    limit = Number(limit) || 5;
    const [products] = await pool.execute(
      `SELECT 
        id, name, price, currency, order_count, view_count
       FROM products
       WHERE user_id = ? AND deleted_at IS NULL
       ORDER BY order_count DESC, view_count DESC
       LIMIT ${limit} `,
      [userId]
    );

    return products;
  }

  /**
   * Commandes récentes
   * @param {number} userId - ID du vendeur
   * @param {number} limit - Nombre de commandes
   * @returns {array} Liste des commandes récentes
   */
  async getRecentOrders(userId, limit = 10) {
    limit = Number(limit) || 10;
    const [orders] = await pool.execute(
      `SELECT 
        o.id, o.order_number, o.customer_name, o.product_name, 
        o.total_amount, o.status, o.created_at
       FROM orders o
       WHERE o.user_id = ? AND o.deleted_at IS NULL
       ORDER BY o.created_at DESC
       LIMIT ${limit} `,
      [userId]
    );

    return orders;
  }

  /**
   * Statistiques clients
   * @param {number} userId - ID du vendeur
   * @returns {object} Stats clients
   */
  async getCustomerStats(userId) {
    // Top clients
    const [topCustomers] = await pool.execute(
      `SELECT 
        id, name, phone, total_orders, total_spent
       FROM customers
       WHERE user_id = ? AND deleted_at IS NULL
       ORDER BY total_spent DESC
       LIMIT 5`,
      [userId]
    );

    return {
      top_customers: topCustomers
    };
  }

  /**
   * Statistiques par période
   * @param {number} userId - ID du vendeur
   * @param {string} period - Période (7days, 30days, 90days, 365days)
   * @returns {object} Stats de la période
   */
  async getStatsByPeriod(userId, period = '30days') {
    const days = {
      '7days': 7,
      '30days': 30,
      '90days': 90,
      '365days': 365
    }[period] || 30;

    const [stats] = await pool.execute(
      `SELECT 
        DATE(created_at) as date,
        COUNT(*) as order_count,
        SUM(total_amount) as revenue
       FROM orders
       WHERE user_id = ? 
         AND deleted_at IS NULL
         AND created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
       GROUP BY DATE(created_at)
       ORDER BY date ASC`,
      [userId, days]
    );

    return stats;
  }
}

module.exports = new StatsService(); 