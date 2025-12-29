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
        (SELECT COUNT(*) FROM users WHERE role = ? AND account_status = 'active' AND deleted_at IS NULL) as active_vendors,
        (SELECT COUNT(*) FROM users WHERE role = ? AND account_status = 'suspended' AND deleted_at IS NULL) as suspended_vendors,
        (SELECT COUNT(*) FROM users WHERE role = ? AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) AND deleted_at IS NULL) as new_vendors_30_days,
        
        -- Produits
        (SELECT COUNT(*) FROM products WHERE deleted_at IS NULL) as total_products,
        (SELECT COUNT(*) FROM products WHERE is_available = TRUE AND deleted_at IS NULL) as available_products,
        
        -- Commandes
        (SELECT COUNT(*) FROM orders WHERE deleted_at IS NULL) as total_orders,
        (SELECT COUNT(*) FROM orders WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) AND deleted_at IS NULL) as orders_last_30_days,
        (SELECT SUM(total_amount) FROM orders WHERE deleted_at IS NULL) as total_revenue,
        (SELECT SUM(total_amount) FROM orders WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) AND deleted_at IS NULL) as revenue_last_30_days,
        
        -- Clients
        (SELECT COUNT(*) FROM customers WHERE deleted_at IS NULL) as total_customers,
        
        -- Abonnements
        (SELECT COUNT(*) FROM subscriptions WHERE status = 'trial') as trial_subscriptions,
        (SELECT COUNT(*) FROM subscriptions WHERE status = 'active') as active_subscriptions,
        (SELECT COUNT(*) FROM subscriptions WHERE status = 'expired') as expired_subscriptions
    `, [USER_ROLES.USER, USER_ROLES.USER, USER_ROLES.USER, USER_ROLES.USER]);

    return {
      vendors: {
        total: stats[0].total_vendors || 0,
        active: stats[0].active_vendors || 0,
        suspended: stats[0].suspended_vendors || 0,
        new_last_30_days: stats[0].new_vendors_30_days || 0
      },
      products: {
        total: stats[0].total_products || 0,
        available: stats[0].available_products || 0
      },
      orders: {
        total: stats[0].total_orders || 0,
        last_30_days: stats[0].orders_last_30_days || 0
      },
      revenue: {
        total: parseFloat(stats[0].total_revenue || 0),
        last_30_days: parseFloat(stats[0].revenue_last_30_days || 0)
      },
      customers: {
        total: stats[0].total_customers || 0
      },
      subscriptions: {
        trial: stats[0].trial_subscriptions || 0,
        active: stats[0].active_subscriptions || 0,
        expired: stats[0].expired_subscriptions || 0
      }
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
        SUM(o.total_amount) as total_revenue,
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
        SUM(total_amount) as revenue
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
        (SELECT COUNT(*) FROM users WHERE role = ? AND deleted_at IS NULL) as total_signups,
        (SELECT COUNT(DISTINCT user_id) FROM subscriptions WHERE status IN ('trial', 'active')) as active_users
    `, [USER_ROLES.USER]);

    const totalSignups = stats[0].total_signups || 0;
    const activeUsers = stats[0].active_users || 0;
    const conversionRate = totalSignups > 0 ? (activeUsers / totalSignups * 100).toFixed(2) : 0;

    return {
      total_signups: totalSignups,
      active_users: activeUsers,
      conversion_rate: parseFloat(conversionRate)
    };
  }
}

module.exports = new AdminDashboardService();