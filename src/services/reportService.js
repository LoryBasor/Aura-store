// src/services/reportService.js
// Signalements de produits et boutiques
const { pool } = require('../config/database');
const { AppError } = require('../middlewares/errorHandler');
const notificationService = require('./notificationService');
const emailService = require('./emailService');

const REPORT_COOLDOWN_HOURS = 24; // Un même IP ne peut signaler le même item qu'une fois par 24h

class ReportService {
  /**
   * Signale un produit
   */
  async reportProduct(productId, ip, { reason, description }) {
    // Vérifier l'existence du produit
    const [products] = await pool.execute(
      'SELECT p.id, p.name, u.business_name FROM products p JOIN users u ON p.user_id = u.id WHERE p.id = ? AND p.deleted_at IS NULL',
      [productId]
    );
    if (products.length === 0) throw new AppError('Produit introuvable.', 404);

    // Anti-doublon : même IP + même produit dans les 24h
    const [existing] = await pool.execute(
      `SELECT id FROM product_reports
       WHERE product_id = ? AND reporter_ip = ?
         AND created_at > DATE_SUB(NOW(), INTERVAL ? HOUR)`,
      [productId, ip, REPORT_COOLDOWN_HOURS]
    );
    if (existing.length > 0) {
      throw new AppError('Vous avez déjà signalé ce produit récemment.', 429);
    }

    const [result] = await pool.execute(
      `INSERT INTO product_reports (product_id, reporter_ip, reason, description)
       VALUES (?, ?, ?, ?)`,
      [productId, ip, reason, description || null]
    );

    const product = products[0];

    // Notifier l'admin (notification BDD + email)
    await notificationService.createNotification(
      'new_report',
      `Signalement : ${product.name}`,
      `Un produit de "${product.business_name}" a été signalé pour : ${reason}`,
      result.insertId,
      'product_report'
    );

    emailService.sendReportNotificationToAdmin('product', {
      'Produit': product.name,
      'Boutique': product.business_name,
      'Raison': reason,
      'Description': description || 'Aucune'
    }).catch(err => console.error('[ReportService] Email admin:', err));

    return { success: true, id: result.insertId };
  }

  /**
   * Signale une boutique
   */
  async reportStore(vendorId, ip, { reason, description }) {
    // Vérifier l'existence du vendeur
    const [vendors] = await pool.execute(
      'SELECT id, business_name, store_slug FROM users WHERE id = ? AND deleted_at IS NULL',
      [vendorId]
    );
    if (vendors.length === 0) throw new AppError('Boutique introuvable.', 404);

    // Anti-doublon
    const [existing] = await pool.execute(
      `SELECT id FROM store_reports
       WHERE vendor_id = ? AND reporter_ip = ?
         AND created_at > DATE_SUB(NOW(), INTERVAL ? HOUR)`,
      [vendorId, ip, REPORT_COOLDOWN_HOURS]
    );
    if (existing.length > 0) {
      throw new AppError('Vous avez déjà signalé cette boutique récemment.', 429);
    }

    const [result] = await pool.execute(
      `INSERT INTO store_reports (vendor_id, reporter_ip, reason, description)
       VALUES (?, ?, ?, ?)`,
      [vendorId, ip, reason, description || null]
    );

    const vendor = vendors[0];

    await notificationService.createNotification(
      'new_report',
      `Signalement boutique : ${vendor.business_name}`,
      `La boutique "${vendor.business_name}" a été signalée pour : ${reason}`,
      result.insertId,
      'store_report'
    );

    emailService.sendReportNotificationToAdmin('store', {
      'Boutique': vendor.business_name,
      'Raison': reason,
      'Description': description || 'Aucune'
    }).catch(err => console.error('[ReportService] Email admin:', err));

    return { success: true, id: result.insertId };
  }

  /**
   * Liste les signalements produits (admin)
   */
  async getProductReports({ page = 1, limit = 20, status = null } = {}) {
    const offset = (page - 1) * limit;
    const whereClause = status ? 'WHERE pr.status = ?' : '';
    const params = status ? [status] : [];

    const [reports] = await pool.execute(
      `SELECT pr.*, p.name as product_name, p.slug as product_slug,
              u.business_name, u.store_slug
       FROM product_reports pr
       JOIN products p ON pr.product_id = p.id
       JOIN users u ON p.user_id = u.id
       ${whereClause}
       ORDER BY pr.created_at DESC
       LIMIT ${limit} OFFSET ${offset}`,
      params
    );

    const [count] = await pool.execute(
      `SELECT COUNT(*) as total FROM product_reports pr ${whereClause}`,
      params
    );

    return { reports, pagination: { page, limit, total: count[0].total } };
  }

  /**
   * Liste les signalements boutiques (admin)
   */
  async getStoreReports({ page = 1, limit = 20, status = null } = {}) {
    const offset = (page - 1) * limit;
    const whereClause = status ? 'WHERE sr.status = ?' : '';
    const params = status ? [status] : [];

    const [reports] = await pool.execute(
      `SELECT sr.*, u.business_name, u.store_slug, u.email
       FROM store_reports sr
       JOIN users u ON sr.vendor_id = u.id
       ${whereClause}
       ORDER BY sr.created_at DESC
       LIMIT ${limit} OFFSET ${offset}`,
      params
    );

    const [count] = await pool.execute(
      `SELECT COUNT(*) as total FROM store_reports sr ${whereClause}`,
      params
    );

    return { reports, pagination: { page, limit, total: count[0].total } };
  }

  /**
   * Met à jour le statut d'un signalement (admin)
   */
  async updateReportStatus(type, reportId, status, adminId) {
    const table = type === 'product' ? 'product_reports' : 'store_reports';
    const [result] = await pool.execute(
      `UPDATE ${table} SET status = ?, reviewed_at = NOW(), reviewed_by = ? WHERE id = ?`,
      [status, adminId, reportId]
    );
    if (result.affectedRows === 0) throw new AppError('Signalement introuvable.', 404);
    return { success: true };
  }
}

module.exports = new ReportService();
