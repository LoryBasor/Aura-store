// src/services/admin/dashboardService.js
const { pool } = require('../../config/database');
const { USER_ROLES } = require('../../config/constants');

/**
 * Service du dashboard Super Admin
 */
class AdminDashboardService {
  /**
   * Récupère toutes les statistiques globales de la plateforme
   */
  async getGlobalStats() {
    const [stats] = await pool.execute(`
      SELECT 
        -- Utilisateurs
        (SELECT COUNT(*) FROM users WHERE role = ? AND deleted_at IS NULL) as total_vendors,
        (SELECT COUNT(*) FROM users WHERE role = ? AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) AND deleted_at IS NULL) as new_vendors_this_month,
        
        -- Produits
        (SELECT COUNT(*) FROM products WHERE deleted_at IS NULL) as total_products,
        (SELECT COUNT(*) FROM products WHERE is_available = TRUE AND deleted_at IS NULL) as active_products,
        (SELECT SUM(view_count) FROM products WHERE deleted_at IS NULL) as total_views,
        
        -- Commandes
        (SELECT COUNT(*) FROM orders WHERE deleted_at IS NULL) as total_orders,
        (SELECT COUNT(*) FROM orders WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) AND deleted_at IS NULL) as orders_this_month,
        (SELECT SUM(total_amount) FROM orders WHERE deleted_at IS NULL AND status IN ('livree', 'confirmee')) as total_revenue,
        (SELECT SUM(total_amount) FROM orders WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) AND deleted_at IS NULL AND status IN ('livree', 'confirmee')) as revenue_this_month
    `, [USER_ROLES.USER, USER_ROLES.USER]);

    return {
      ...stats[0],
      total_revenue: parseFloat(stats[0].total_revenue || 0),
      revenue_this_month: parseFloat(stats[0].revenue_this_month || 0)
    };
  }

  /**
   * Top vendeurs par chiffre d'affaires
   */
  async getTopVendors(limit = 10) {
    limit = Number(limit) || 10;
    const [vendors] = await pool.execute(
      `SELECT  
        u.id,
        u.email,
        u.business_name,
        u.store_slug,
        sp.name as plan_name,
        COUNT(DISTINCT o.id) as total_orders,
        SUM(CASE WHEN o.status IN ('livree', 'confirmee') THEN o.total_amount ELSE 0 END) as total_revenue,
        COUNT(DISTINCT p.id) as total_products,
        u.created_at
      FROM users u
      LEFT JOIN orders o ON u.id = o.user_id AND o.deleted_at IS NULL
      LEFT JOIN products p ON u.id = p.user_id AND p.deleted_at IS NULL
      LEFT JOIN subscriptions s ON u.id = s.user_id AND s.status IN ('trial', 'active')
      LEFT JOIN subscription_plans sp ON s.plan_id = sp.id
      WHERE u.role = ? AND u.deleted_at IS NULL
      GROUP BY u.id,
      u.email,
      u.business_name,
      u.store_slug,
      sp.name
      ORDER BY total_revenue DESC
      LIMIT ${limit} `,
      [USER_ROLES.USER]
    );

    return vendors.map(v => ({
      ...v,
      total_revenue: parseFloat(v.total_revenue || 0)
    }));
  }

  /**
   * Vendeurs récemment inscrits
   */
  async getRecentVendors(limit = 10) {
    limit = Number(limit) || 10;
    const [vendors] = await pool.execute( 
      `SELECT 
        u.id,
        u.email,
        u.business_name,
        u.account_status,
        s.status as subscription_status,
        sp.name as plan_name,
        u.created_at
      FROM users u
      LEFT JOIN subscriptions s ON u.id = s.user_id AND s.status IN ('trial', 'active')
      LEFT JOIN subscription_plans sp ON s.plan_id = sp.id
      WHERE u.role = ? AND u.deleted_at IS NULL
      ORDER BY u.created_at DESC
      LIMIT ${limit}`,
      [USER_ROLES.USER]
    );

    return vendors;
  }

  /**
   * Commandes récentes (toute la plateforme)
   */
  async getRecentOrders(limit = 20) {
    limit = Number(limit) || 20;
    const [orders] = await pool.execute(
      `SELECT 
        o.id,
        o.order_number,
        o.customer_name,
        o.product_name,
        o.total_amount,
        o.status,
        o.created_at,
        u.business_name as vendor_name,
        u.email as vendor_email
      FROM orders o
      JOIN users u ON o.user_id = u.id
      WHERE o.deleted_at IS NULL
      ORDER BY o.created_at DESC
      LIMIT ${limit}` 
    );

    return orders.map(o => ({
      ...o,
      total_amount: parseFloat(o.total_amount)
    }));
  }

  /**
   * Statistiques par période (graphiques)
   */
  async getStatsByPeriod(period = '30days') {
    const days = {
      '7days': 7,
      '30days': 30,
      '90days': 90,
      '365days': 365
    }[period] || 30;

    // Commandes par jour
    const [orderStats] = await pool.execute(
      `SELECT 
        DATE(created_at) as date,
        COUNT(*) as order_count,
        SUM(CASE WHEN status IN ('livree', 'confirmee') THEN total_amount ELSE 0 END) as revenue
      FROM orders
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
        AND deleted_at IS NULL
      GROUP BY DATE(created_at)
      ORDER BY date ASC`,
      [days]
    );

    // Nouveaux vendeurs par jour
    const [vendorStats] = await pool.execute(
      `SELECT 
        DATE(created_at) as date,
        COUNT(*) as vendor_count
      FROM users
      WHERE role = ?
        AND created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
        AND deleted_at IS NULL
      GROUP BY DATE(created_at)
      ORDER BY date ASC`,
      [USER_ROLES.USER, days]
    );

    return {
      orders: orderStats.map(s => ({
        date: s.date,
        count: s.order_count,
        revenue: parseFloat(s.revenue || 0)
      })),
      vendors: vendorStats
    };
  }

  /**
   * Abonnements expirant bientôt (alertes)
   */
  async getExpiringSoon(days = 7) {
    const [subscriptions] = await pool.execute(
      `SELECT 
        s.*,
        u.email,
        u.business_name,
        sp.name as plan_name,
        DATEDIFF(s.expires_at, NOW()) as days_remaining
      FROM subscriptions s
      JOIN users u ON s.user_id = u.id
      JOIN subscription_plans sp ON s.plan_id = sp.id
      WHERE s.status IN ('trial', 'active')
        AND s.expires_at <= DATE_ADD(NOW(), INTERVAL ? DAY)
        AND s.expires_at >= NOW()
      ORDER BY s.expires_at ASC`,
      [days]
    );

    return subscriptions;
  }

  /**
   * Distribution des abonnements par plan
   */
  async getSubscriptionDistribution() {
    const [distribution] = await pool.execute(`
      SELECT 
        sp.name as plan_name,
        sp.slug as plan_slug,
        COUNT(s.id) as count,
        s.status
      FROM subscriptions s
      JOIN subscription_plans sp ON s.plan_id = sp.id
      WHERE s.status IN ('trial', 'active')
      GROUP BY sp.id, s.status
      ORDER BY sp.display_order
    `);

    return distribution;
  }

  /**
   * Taux de conversion (inscription -> abonnement actif)
   */
  async getConversionRate() {
    const [stats] = await pool.execute(`
      SELECT 
        (SELECT COALESCE(SUM(view_count), 0) FROM products WHERE deleted_at IS NULL) as total_views,
        (SELECT COUNT(*) FROM orders WHERE deleted_at IS NULL) as total_orders
    `);

    const totalViews = parseInt(stats[0].total_views || 0);
    const totalOrders = parseInt(stats[0].total_orders || 0);
    const conversionRate = totalViews > 0 ? (totalOrders / totalViews * 100).toFixed(2) : 0;

    return {
      total_views: totalViews,
      total_orders: totalOrders,
      conversion_rate: parseFloat(conversionRate)
    };
  }
}

module.exports = new AdminDashboardService();