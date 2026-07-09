// src/services/exportService.js
const { pool } = require('../config/database');
const ExcelJS = require('exceljs');

/**
 * Service d'export des données (PRO et BUSINESS uniquement)
 */
class ExportService {
  /**
   * Exporte les commandes en JSON
   */
  async exportOrdersJSON(userId) {
    const [orders] = await pool.execute(
      `SELECT 
        o.id,
        o.order_number,
        o.customer_name,
        o.customer_phone,
        o.customer_address,
        o.product_name,
        o.product_price,
        o.quantity,
        o.total_amount,
        o.status,
        o.notes,
        o.created_at,
        o.updated_at
       FROM orders o
       WHERE o.user_id = ? AND o.deleted_at IS NULL
       ORDER BY o.created_at DESC`,
      [userId]
    );

    return orders.map(o => ({
      ...o,
      product_price: parseFloat(o.product_price),
      total_amount: parseFloat(o.total_amount)
    }));
  }

  /**
   * Exporte les produits en JSON
   */
  async exportProductsJSON(userId) {
    const [products] = await pool.execute(
      `SELECT 
        p.id,
        p.name,
        p.slug,
        p.description,
        p.price,
        p.currency,
        p.stock_quantity,
        p.is_available,
        p.view_count,
        p.order_count,
        p.created_at,
        p.updated_at
       FROM products p
       WHERE p.user_id = ? AND p.deleted_at IS NULL
       ORDER BY p.created_at DESC`,
      [userId]
    );

    return products.map(p => ({
      ...p,
      price: parseFloat(p.price)
    }));
  }

  /**
   * Exporte les statistiques en JSON
   */
  async exportStatsJSON(userId) {
    const advancedStatsService = require('./advancedStatsService');

    const [stats, topProducts, ordersByStatus, metrics, customerAnalysis] = await Promise.all([
      this.getBasicStats(userId),
      advancedStatsService.getTopProducts(userId, 20),
      advancedStatsService.getOrdersByStatus(userId),
      advancedStatsService.getConversionMetrics(userId),
      advancedStatsService.getCustomerAnalysis(userId)
    ]);

    return {
      overview: stats,
      top_products: topProducts,
      orders_by_status: ordersByStatus,
      conversion_metrics: metrics,
      customer_analysis: customerAnalysis,
      exported_at: new Date().toISOString()
    };
  }

  /**
   * Statistiques de base
   */
  async getBasicStats(userId) {
    const [stats] = await pool.execute(
      `SELECT 
        (SELECT COUNT(*) FROM products WHERE user_id = ? AND deleted_at IS NULL) as total_products,
        (SELECT COUNT(*) FROM orders WHERE user_id = ? AND deleted_at IS NULL) as total_orders,
        (SELECT SUM(total_amount) FROM orders WHERE user_id = ? AND deleted_at IS NULL AND status IN ('livree', 'confirmee')) as total_revenue,
        (SELECT COUNT(*) FROM customers WHERE user_id = ? AND deleted_at IS NULL) as total_customers`,
      [userId, userId, userId, userId]
    );

    return {
      total_products: stats[0].total_products || 0,
      total_orders: stats[0].total_orders || 0,
      total_revenue: parseFloat(stats[0].total_revenue || 0),
      total_customers: stats[0].total_customers || 0
    };
  }

  /**
   * Exporte les commandes en Excel
   */
  async exportOrdersExcel(userId) {
    const orders = await this.exportOrdersJSON(userId);
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Commandes');

    // Définir les colonnes
    worksheet.columns = [
      { header: 'Numéro', key: 'order_number', width: 20 },
      { header: 'Client', key: 'customer_name', width: 25 },
      { header: 'Téléphone', key: 'customer_phone', width: 15 },
      { header: 'Adresse', key: 'customer_address', width: 30 },
      { header: 'Produit', key: 'product_name', width: 25 },
      { header: 'Prix unitaire', key: 'product_price', width: 12 },
      { header: 'Quantité', key: 'quantity', width: 10 },
      { header: 'Montant total', key: 'total_amount', width: 15 },
      { header: 'Statut', key: 'status', width: 15 },
      { header: 'Notes', key: 'notes', width: 30 },
      { header: 'Date création', key: 'created_at', width: 20 }
    ];

    // Style de l'en-tête
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4F46E5' }
    };
    worksheet.getRow(1).font = { color: { argb: 'FFFFFFFF' }, bold: true };

    // Ajouter les données
    orders.forEach(order => {
      worksheet.addRow({
        order_number: order.order_number,
        customer_name: order.customer_name,
        customer_phone: order.customer_phone,
        customer_address: order.customer_address,
        product_name: order.product_name,
        product_price: order.product_price,
        quantity: order.quantity,
        total_amount: order.total_amount,
        status: order.status,
        notes: order.notes,
        created_at: new Date(order.created_at).toLocaleString('fr-FR')
      });
    });

    // Format des nombres
    worksheet.getColumn('product_price').numFmt = '#,##0.00';
    worksheet.getColumn('total_amount').numFmt = '#,##0.00';

    return workbook;
  }

  /**
   * Exporte les produits en Excel
   */
  async exportProductsExcel(userId) {
    const products = await this.exportProductsJSON(userId);
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Produits');

    worksheet.columns = [
      { header: 'ID', key: 'id', width: 10 },
      { header: 'Nom', key: 'name', width: 30 },
      { header: 'Description', key: 'description', width: 40 },
      { header: 'Prix', key: 'price', width: 12 },
      { header: 'Devise', key: 'currency', width: 10 },
      { header: 'Stock', key: 'stock_quantity', width: 10 },
      { header: 'Disponible', key: 'is_available', width: 12 },
      { header: 'Vues', key: 'view_count', width: 10 },
      { header: 'Commandes', key: 'order_count', width: 12 },
      { header: 'Date création', key: 'created_at', width: 20 }
    ];

    // Style de l'en-tête
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF10B981' }
    };
    worksheet.getRow(1).font = { color: { argb: 'FFFFFFFF' }, bold: true };

    products.forEach(product => {
      worksheet.addRow({
        id: product.id,
        name: product.name,
        description: product.description,
        price: product.price,
        currency: product.currency,
        stock_quantity: product.stock_quantity,
        is_available: product.is_available ? 'Oui' : 'Non',
        view_count: product.view_count,
        order_count: product.order_count,
        created_at: new Date(product.created_at).toLocaleString('fr-FR')
      });
    });

    worksheet.getColumn('price').numFmt = '#,##0.00';

    return workbook;
  }
}

module.exports = new ExportService();