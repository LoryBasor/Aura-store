// src/services/advancedStatsService.js
const { pool } = require('../config/database');

/**
 * Service de statistiques avancées (PRO et BUSINESS uniquement)
 */
class AdvancedStatsService {
  /**
   * Évolution des commandes par période
   * @param {number} userId - ID du vendeur
   * @param {string} period - 'day', 'week', 'month', 'year'
   * @param {number} days - Nombre de jours à analyser
   */
  async getOrdersEvolution(userId, period = 'day', days = 30) {
    let groupBy = 'DATE(created_at)';
    let dateFormat = '%Y-%m-%d';

    switch (period) {
      case 'week':
        groupBy = 'YEARWEEK(created_at, 1)';
        dateFormat = 'Semaine %v %Y';
        break;
      case 'month':
        groupBy = 'DATE_FORMAT(created_at, "%Y-%m")';
        dateFormat = '%Y-%m';
        break;
      case 'year':
        groupBy = 'YEAR(created_at)';
        dateFormat = '%Y';
        break;
    }

    const [results] = await pool.execute(
      `SELECT 
        ${groupBy} as period,
        DATE_FORMAT(MIN(created_at), '${dateFormat}') as label,
        COUNT(*) as order_count,
        SUM(total_amount) as revenue,
        AVG(total_amount) as avg_order_value,
        COUNT(DISTINCT customer_id) as unique_customers
       FROM orders
       WHERE user_id = ? 
         AND deleted_at IS NULL
         AND created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
       GROUP BY ${groupBy}
       ORDER BY period ASC`,
      [userId, days]
    );

    // Remplir les jours manquants avec 0 pour avoir une ligne continue
    if (period === 'day') {
      const filledResults = [];
      const dataMap = new Map();
      
      results.forEach(r => {
        let key = r.period;
        if (key instanceof Date) {
            key = key.toISOString().split('T')[0];
        }
        dataMap.set(key, r);
      });
      
      for (let i = days - 1; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        
        if (dataMap.has(dateStr)) {
          filledResults.push(dataMap.get(dateStr));
        } else {
          filledResults.push({
            period: dateStr,
            label: d.toLocaleDateString('fr-FR'), // Format fr-FR court
            order_count: 0,
            revenue: 0,
            avg_order_value: 0,
            unique_customers: 0
          });
        }
      }
      return filledResults.map(r => ({
        ...r,
        revenue: parseFloat(r.revenue || 0),
        avg_order_value: parseFloat(r.avg_order_value || 0)
      }));
    }

    return results.map(r => ({
      ...r,
      revenue: parseFloat(r.revenue || 0),
      avg_order_value: parseFloat(r.avg_order_value || 0)
    }));
  }

  /**
   * Statistiques par statut de commande
   */
  async getOrdersByStatus(userId) {
    const [results] = await pool.execute(
      `SELECT 
        status,
        COUNT(*) as count,
        SUM(total_amount) as total_revenue,
        AVG(total_amount) as avg_value
       FROM orders
       WHERE user_id = ? AND deleted_at IS NULL
       GROUP BY status`,
      [userId]
    );

    return results.map(r => ({
      ...r,
      total_revenue: parseFloat(r.total_revenue || 0),
      avg_value: parseFloat(r.avg_value || 0)
    }));
  }

  /**
   * Top produits les plus vendus
   */
  async getTopProducts(userId, limit = 10) {
    const [products] = await pool.execute(
      `SELECT 
        p.id,
        p.name,
        p.price,
        p.currency,
        COUNT(o.id) as sales_count,
        SUM(o.quantity) as total_quantity,
        SUM(o.total_amount) as total_revenue,
        AVG(o.total_amount) as avg_order_value
       FROM products p
       LEFT JOIN orders o ON p.id = o.product_id AND o.deleted_at IS NULL
       WHERE p.user_id = ? AND p.deleted_at IS NULL
       GROUP BY p.id
       ORDER BY sales_count DESC, total_revenue DESC`,
      [userId]
    );

    return products.map(p => ({
      ...p,
      total_revenue: parseFloat(p.total_revenue || 0),
      avg_order_value: parseFloat(p.avg_order_value || 0)
    }));
  }

  /**
   * Taux de conversion et panier moyen
   */
  async getConversionMetrics(userId) {
    const [metrics] = await pool.execute(
      `SELECT 
        (SELECT COUNT(DISTINCT id) FROM products WHERE user_id = ? AND deleted_at IS NULL) as total_products,
        (SELECT SUM(view_count) FROM products WHERE user_id = ? AND deleted_at IS NULL) as total_views,
        COUNT(*) as total_orders,
        AVG(total_amount) as avg_basket,
        SUM(total_amount) as total_revenue,
        COUNT(DISTINCT customer_id) as unique_customers
       FROM orders
       WHERE user_id = ? AND deleted_at IS NULL`,
      [userId, userId, userId]
    );

    const data = metrics[0];
    const conversionRate = data.total_views > 0 
      ? ((data.total_orders / data.total_views) * 100).toFixed(2)
      : 0;

    return {
      total_products: data.total_products || 0,
      total_views: data.total_views || 0,
      total_orders: data.total_orders || 0,
      unique_customers: data.unique_customers || 0,
      avg_basket: parseFloat(data.avg_basket || 0),
      total_revenue: parseFloat(data.total_revenue || 0),
      conversion_rate: parseFloat(conversionRate)
    };
  }

  /**
   * Répartition des commandes par tranche horaire
   */
  async getOrdersByHour(userId) {
    const [results] = await pool.execute(
      `SELECT 
        HOUR(created_at) as hour,
        COUNT(*) as order_count,
        SUM(total_amount) as revenue
       FROM orders
       WHERE user_id = ? AND deleted_at IS NULL
       GROUP BY hour
       ORDER BY hour ASC`,
      [userId]
    );

    return results.map(r => ({
      ...r,
      revenue: parseFloat(r.revenue || 0)
    }));
  }

  /**
   * Analyse des clients (fidélité)
   */
  async getCustomerAnalysis(userId) {
    const [analysis] = await pool.execute(
      `SELECT 
        COUNT(*) as total_customers,
        SUM(CASE WHEN total_orders = 1 THEN 1 ELSE 0 END) as one_time_customers,
        SUM(CASE WHEN total_orders >= 2 THEN 1 ELSE 0 END) as repeat_customers,
        AVG(total_orders) as avg_orders_per_customer,
        AVG(total_spent) as avg_spent_per_customer
       FROM customers
       WHERE user_id = ? AND deleted_at IS NULL`,
      [userId]
    );

    const data = analysis[0];
    const repeatRate = data.total_customers > 0
      ? ((data.repeat_customers / data.total_customers) * 100).toFixed(2)
      : 0;

    return {
      total_customers: data.total_customers || 0,
      one_time_customers: data.one_time_customers || 0,
      repeat_customers: data.repeat_customers || 0,
      repeat_rate: parseFloat(repeatRate),
      avg_orders_per_customer: parseFloat(data.avg_orders_per_customer || 0),
      avg_spent_per_customer: parseFloat(data.avg_spent_per_customer || 0)
    };
  }

  /**
   * Prévisions simples basées sur les tendances
   */
  async getForecast(userId) {
    const [lastMonth] = await pool.execute(
      `SELECT 
        COUNT(*) as orders,
        SUM(total_amount) as revenue
       FROM orders
       WHERE user_id = ? 
         AND deleted_at IS NULL
         AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)`,
      [userId]
    );

    const [previousMonth] = await pool.execute(
      `SELECT 
        COUNT(*) as orders,
        SUM(total_amount) as revenue
       FROM orders
       WHERE user_id = ? 
         AND deleted_at IS NULL
         AND created_at >= DATE_SUB(NOW(), INTERVAL 60 DAY)
         AND created_at < DATE_SUB(NOW(), INTERVAL 30 DAY)`,
      [userId]
    );

    const lastOrders = lastMonth[0]?.orders || 0;
    const lastRevenue = parseFloat(lastMonth[0]?.revenue || 0);
    const prevOrders = previousMonth[0]?.orders || 0;
    const prevRevenue = parseFloat(previousMonth[0]?.revenue || 0);

    const orderGrowth = prevOrders > 0 
      ? (((lastOrders - prevOrders) / prevOrders) * 100).toFixed(2)
      : 0;
    
    const revenueGrowth = prevRevenue > 0
      ? (((lastRevenue - prevRevenue) / prevRevenue) * 100).toFixed(2)
      : 0;

    return {
      last_30_days: {
        orders: lastOrders,
        revenue: lastRevenue
      },
      previous_30_days: {
        orders: prevOrders,
        revenue: prevRevenue
      },
      growth: {
        orders: parseFloat(orderGrowth),
        revenue: parseFloat(revenueGrowth)
      },
      trend: orderGrowth > 0 ? 'up' : orderGrowth < 0 ? 'down' : 'stable'
    };
  }

  /**
   * Visibilité de la boutique (Total vues)
   */
  async getStoreVisibility(userId) {
    const [result] = await pool.execute(
      `SELECT SUM(view_count) as total_views 
       FROM products 
       WHERE user_id = ? AND deleted_at IS NULL`,
      [userId]
    );
    return result[0]?.total_views || 0;
  }

  /**
   * Produits les plus sollicités (par vues)
   */
  async getMostSolicitedProducts(userId, limit = 10) {
    const [products] = await pool.execute(
      `SELECT id, name, view_count, order_count, price, currency
       FROM products
       WHERE user_id = ? AND deleted_at IS NULL
       ORDER BY view_count DESC
       LIMIT ${parseInt(limit, 10)}`,
      [userId]
    );
    return products;
  }

  /**
   * Performance des catégories
   */
  async getCategoryPerformance(userId) {
    const [categories] = await pool.execute(
      `SELECT 
        c.name, 
        COUNT(o.id) as order_count, 
        SUM(o.total_amount) as total_revenue
       FROM orders o
       JOIN products p ON o.product_id = p.id
       JOIN categories c ON p.category_id = c.id
       WHERE o.user_id = ? AND o.deleted_at IS NULL AND p.deleted_at IS NULL
       GROUP BY c.id
       ORDER BY total_revenue DESC
       LIMIT 5`,
      [userId]
    );
    return categories.map(c => ({
      ...c,
      total_revenue: parseFloat(c.total_revenue || 0)
    }));
  }

  /**
   * Liste détaillée des meilleurs clients
   */
  async getTopCustomers(userId, limit = 10) {
    const [customers] = await pool.execute(
      `SELECT name, phone, email, total_orders, total_spent, last_order_at
       FROM customers
       WHERE user_id = ? AND deleted_at IS NULL
       ORDER BY total_spent DESC
       LIMIT ${parseInt(limit, 10)}`,
      [userId]
    );
    return customers.map(c => ({
      ...c,
      total_spent: parseFloat(c.total_spent || 0)
    }));
  }

  /**
   * Historique des abonnements
   */
  async getSubscriptionHistory(userId) {
    const [history] = await pool.execute(
      `SELECT s.status, s.started_at as start_date, s.expires_at as end_date, s.created_at, sp.name as plan_name, sp.price
       FROM subscriptions s
       JOIN subscription_plans sp ON s.plan_id = sp.id
       WHERE s.user_id = ?
       ORDER BY s.created_at DESC`,
      [userId]
    );
    return history;
  }
}

module.exports = new AdvancedStatsService();