// src/services/advancedStatsService.js
const { pool } = require('../config/database');

/**
 * Service de statistiques avancées (PRO et BUSINESS uniquement)
 */
class AdvancedStatsService {

  /**
   * Retourne les clauses SQL de filtre par date + les paramètres associés.
   * @param {string|null} startDate - YYYY-MM-DD
   * @param {string|null} endDate   - YYYY-MM-DD
   * @param {number}      days      - Nb de jours (fallback si pas de dates)
   * @param {string}      col       - Colonne de date à filtrer (ex: 'created_at')
   */
  _buildDateFilter(startDate, endDate, days = 30, col = 'created_at') {
    if (startDate && endDate) {
      return {
        clause: `AND ${col} >= ? AND ${col} <= DATE_ADD(?, INTERVAL 1 DAY)`,
        params: [startDate, endDate]
      };
    }
    return {
      clause: `AND ${col} >= DATE_SUB(NOW(), INTERVAL ? DAY)`,
      params: [days]
    };
  }

  /**
   * Évolution des commandes par période
   */
  async getOrdersEvolution(userId, period = 'day', days = 30, startDate = null, endDate = null) {
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

    const { clause: dateCondition, params: dateParamsSuffix } = this._buildDateFilter(startDate, endDate, days);

    const [results] = await pool.execute(
      `SELECT 
        ${groupBy} as period,
        DATE_FORMAT(MIN(created_at), '${dateFormat}') as label,
        COUNT(*) as order_count,
        SUM(CASE WHEN status IN ('livree', 'confirmee') THEN total_amount ELSE 0 END) as revenue,
        AVG(CASE WHEN status IN ('livree', 'confirmee') THEN total_amount ELSE NULL END) as avg_order_value,
        COUNT(DISTINCT customer_id) as unique_customers
       FROM orders
       WHERE user_id = ? 
         AND deleted_at IS NULL
         ${dateCondition}
       GROUP BY ${groupBy}
       ORDER BY period ASC`,
      [userId, ...dateParamsSuffix]
    );

    // Remplir les jours manquants avec 0 pour avoir une ligne continue
    if (period === 'day') {
      const filledResults = [];
      const dataMap = new Map();
      
      results.forEach(r => {
        let key = r.period;
        if (key instanceof Date) key = key.toISOString().split('T')[0];
        dataMap.set(key, r);
      });

      // Générer tous les jours de la plage
      let start = startDate ? new Date(startDate) : (() => { const d = new Date(); d.setDate(d.getDate() - (days - 1)); return d; })();
      const end = endDate ? new Date(endDate) : new Date();
      
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split('T')[0];
        if (dataMap.has(dateStr)) {
          filledResults.push(dataMap.get(dateStr));
        } else {
          filledResults.push({
            period: dateStr,
            label: new Date(dateStr).toLocaleDateString('fr-FR'),
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
   * Statistiques par statut de commande (avec filtre période)
   */
  async getOrdersByStatus(userId, startDate = null, endDate = null, days = 30) {
    const { clause, params } = this._buildDateFilter(startDate, endDate, days);
    const [results] = await pool.execute(
      `SELECT 
        status,
        COUNT(*) as count,
        SUM(total_amount) as total_revenue,
        AVG(total_amount) as avg_value
       FROM orders
       WHERE user_id = ? AND deleted_at IS NULL ${clause}
       GROUP BY status`,
      [userId, ...params]
    );

    return results.map(r => ({
      ...r,
      total_revenue: parseFloat(r.total_revenue || 0),
      avg_value: parseFloat(r.avg_value || 0)
    }));
  }

  /**
   * Top produits les plus vendus (avec filtre période sur les commandes)
   */
  async getTopProducts(userId, limit = 10, startDate = null, endDate = null, days = 30) {
    // Build date filter for the subquery on orders
    let dateWhere, dateParams;
    if (startDate && endDate) {
      dateWhere = `AND o.created_at >= ? AND o.created_at <= DATE_ADD(?, INTERVAL 1 DAY)`;
      dateParams = [startDate, endDate];
    } else {
      dateWhere = `AND o.created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)`;
      dateParams = [days];
    }

    const [products] = await pool.execute(
      `SELECT 
        p.id,
        p.name,
        p.price,
        p.currency,
        COUNT(o.id) as sales_count,
        SUM(o.quantity) as total_quantity,
        SUM(CASE WHEN o.status IN ('livree', 'confirmee') THEN o.total_amount ELSE 0 END) as total_revenue,
        AVG(CASE WHEN o.status IN ('livree', 'confirmee') THEN o.total_amount ELSE NULL END) as avg_order_value
       FROM products p
       LEFT JOIN orders o ON p.id = o.product_id AND o.deleted_at IS NULL ${dateWhere}
       WHERE p.user_id = ? AND p.deleted_at IS NULL
       GROUP BY p.id
       ORDER BY sales_count DESC, total_revenue DESC
       LIMIT ${parseInt(limit, 10)}`,
      [...dateParams, userId]
    );

    return products.map(p => ({
      ...p,
      total_revenue: parseFloat(p.total_revenue || 0),
      avg_order_value: parseFloat(p.avg_order_value || 0)
    }));
  }

  /**
   * Taux de conversion et panier moyen (avec filtre période)
   */
  async getConversionMetrics(userId, startDate = null, endDate = null, days = 30) {
    const { clause, params } = this._buildDateFilter(startDate, endDate, days);
    const [metrics] = await pool.execute(
      `SELECT 
        (SELECT COUNT(DISTINCT id) FROM products WHERE user_id = ? AND deleted_at IS NULL) as total_products,
        (SELECT SUM(view_count) FROM products WHERE user_id = ? AND deleted_at IS NULL) as total_views,
        COUNT(*) as total_orders,
        AVG(CASE WHEN status IN ('livree', 'confirmee') THEN total_amount ELSE NULL END) as avg_basket,
        SUM(CASE WHEN status IN ('livree', 'confirmee') THEN total_amount ELSE 0 END) as total_revenue,
        COUNT(DISTINCT customer_id) as unique_customers
       FROM orders
       WHERE user_id = ? AND deleted_at IS NULL ${clause}`,
      [userId, userId, userId, ...params]
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
   * Répartition des commandes par tranche horaire (avec filtre période)
   */
  async getOrdersByHour(userId, startDate = null, endDate = null, days = 30) {
    const { clause, params } = this._buildDateFilter(startDate, endDate, days);
    const [results] = await pool.execute(
      `SELECT 
        HOUR(created_at) as hour,
        COUNT(*) as order_count,
        SUM(CASE WHEN status IN ('livree', 'confirmee') THEN total_amount ELSE 0 END) as revenue
       FROM orders
       WHERE user_id = ? AND deleted_at IS NULL ${clause}
       GROUP BY hour
       ORDER BY hour ASC`,
      [userId, ...params]
    );

    return results.map(r => ({
      ...r,
      revenue: parseFloat(r.revenue || 0)
    }));
  }

  /**
   * Analyse des clients (fidélité) — basée sur les orders de la période
   */
  async getCustomerAnalysis(userId, startDate = null, endDate = null, days = 30) {
    // Récupérer les données globales de fidélité (table customers)
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
        SUM(CASE WHEN status IN ('livree', 'confirmee') THEN total_amount ELSE 0 END) as revenue
       FROM orders
       WHERE user_id = ? 
         AND deleted_at IS NULL
         AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)`,
      [userId]
    );

    const [previousMonth] = await pool.execute(
      `SELECT 
        COUNT(*) as orders,
        SUM(CASE WHEN status IN ('livree', 'confirmee') THEN total_amount ELSE 0 END) as revenue
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
   * Produits les plus sollicités (par vues) — statique, non filtrable par date
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
   * Performance des catégories (avec filtre période)
   */
  async getCategoryPerformance(userId, startDate = null, endDate = null, days = 30) {
    const { clause, params } = this._buildDateFilter(startDate, endDate, days, 'o.created_at');
    const [categories] = await pool.execute(
      `SELECT 
        c.name, 
        COUNT(o.id) as order_count, 
        SUM(CASE WHEN o.status IN ('livree', 'confirmee') THEN o.total_amount ELSE 0 END) as total_revenue
       FROM orders o
       JOIN products p ON o.product_id = p.id
       JOIN categories c ON p.category_id = c.id
       WHERE o.user_id = ? AND o.deleted_at IS NULL AND p.deleted_at IS NULL ${clause}
       GROUP BY c.id
       ORDER BY total_revenue DESC
       LIMIT 5`,
      [userId, ...params]
    );
    return categories.map(c => ({
      ...c,
      total_revenue: parseFloat(c.total_revenue || 0)
    }));
  }

  /**
   * Liste détaillée des meilleurs clients (avec filtre période sur les orders)
   */
  async getTopCustomers(userId, limit = 10, startDate = null, endDate = null, days = 30) {
    let dateWhere, dateParams;
    if (startDate && endDate) {
      dateWhere = `AND o.created_at >= ? AND o.created_at <= DATE_ADD(?, INTERVAL 1 DAY)`;
      dateParams = [startDate, endDate];
    } else {
      dateWhere = `AND o.created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)`;
      dateParams = [days];
    }

    const [customers] = await pool.execute(
      `SELECT 
        c.name, c.phone, c.email,
        COUNT(o.id) as total_orders,
        SUM(CASE WHEN o.status IN ('livree','confirmee') THEN o.total_amount ELSE 0 END) as total_spent,
        MAX(o.created_at) as last_order_at
       FROM customers c
       JOIN orders o ON c.id = o.customer_id AND o.deleted_at IS NULL ${dateWhere}
       WHERE c.user_id = ? AND c.deleted_at IS NULL
       GROUP BY c.id
       ORDER BY total_spent DESC
       LIMIT ${parseInt(limit, 10)}`,
      [...dateParams, userId]
    );
    return customers.map(c => ({
      ...c,
      total_spent: parseFloat(c.total_spent || 0)
    }));
  }

  /**
   * Statistiques pour une plage de dates spécifique
   */
  async getStatsByDateRange(userId, startDate, endDate) {
    const [metrics] = await pool.execute(
      `SELECT
        COUNT(*) as total_orders,
        SUM(CASE WHEN status IN ('livree', 'confirmee') THEN total_amount ELSE 0 END) as total_revenue,
        AVG(CASE WHEN status IN ('livree', 'confirmee') THEN total_amount ELSE NULL END) as avg_basket,
        COUNT(DISTINCT customer_id) as unique_customers,
        SUM(CASE WHEN status = 'livree' THEN 1 ELSE 0 END) as delivered_orders,
        SUM(CASE WHEN status = 'annulee' THEN 1 ELSE 0 END) as cancelled_orders
       FROM orders
       WHERE user_id = ?
         AND deleted_at IS NULL
         AND created_at >= ?
         AND created_at <= DATE_ADD(?, INTERVAL 1 DAY)`,
      [userId, startDate, endDate]
    );

    const d = metrics[0];
    return {
      total_orders: parseInt(d.total_orders || 0),
      total_revenue: parseFloat(d.total_revenue || 0),
      avg_basket: parseFloat(d.avg_basket || 0),
      unique_customers: parseInt(d.unique_customers || 0),
      delivered_orders: parseInt(d.delivered_orders || 0),
      cancelled_orders: parseInt(d.cancelled_orders || 0)
    };
  }

  /**
   * Comparer deux périodes de dates
   */
  async compareStatsPeriods(userId, p1Start, p1End, p2Start, p2End) {
    const [period1, period2] = await Promise.all([
      this.getStatsByDateRange(userId, p1Start, p1End),
      this.getStatsByDateRange(userId, p2Start, p2End)
    ]);

    const diff = (a, b) => b > 0 ? (((a - b) / b) * 100).toFixed(1) : (a > 0 ? 100 : 0);

    return {
      period1: { start: p1Start, end: p1End, ...period1 },
      period2: { start: p2Start, end: p2End, ...period2 },
      variations: {
        total_orders: parseFloat(diff(period1.total_orders, period2.total_orders)),
        total_revenue: parseFloat(diff(period1.total_revenue, period2.total_revenue)),
        avg_basket: parseFloat(diff(period1.avg_basket, period2.avg_basket)),
        unique_customers: parseFloat(diff(period1.unique_customers, period2.unique_customers))
      }
    };
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