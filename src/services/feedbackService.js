// src/services/feedbackService.js
// Gestion des avis et suggestions (vendeurs + visiteurs marketplace)
const { pool } = require('../config/database');
const { AppError } = require('../middlewares/errorHandler');
const notificationService = require('./notificationService');

const FEEDBACK_COOLDOWN_DAYS = 3; // Fréquence minimale entre deux avis

class FeedbackService {
  /**
   * Vérifie si un vendeur peut soumettre un avis (cooldown 3 jours)
   */
  async canVendorSubmitFeedback(userId) {
    const [recent] = await pool.execute(
      `SELECT id FROM user_feedback
       WHERE user_id = ? AND source = 'vendor_dashboard'
         AND created_at > DATE_SUB(NOW(), INTERVAL ? DAY)
       LIMIT 1`,
      [userId, FEEDBACK_COOLDOWN_DAYS]
    );
    return recent.length === 0;
  }

  /**
   * Vérifie si un visiteur peut soumettre un avis (cooldown 3 jours, par IP)
   */
  async canVisitorSubmitFeedback(ip) {
    const [recent] = await pool.execute(
      `SELECT id FROM user_feedback
       WHERE visitor_ip = ? AND source = 'marketplace'
         AND created_at > DATE_SUB(NOW(), INTERVAL ? DAY)
       LIMIT 1`,
      [ip, FEEDBACK_COOLDOWN_DAYS]
    );
    return recent.length === 0;
  }

  /**
   * Soumet un avis depuis le dashboard vendeur
   */
  async createVendorFeedback(userId, { rating, category, comment, suggestions }) {
    const canSubmit = await this.canVendorSubmitFeedback(userId);
    if (!canSubmit) {
      throw new AppError(`Vous avez déjà soumis un avis récemment. Attendez ${FEEDBACK_COOLDOWN_DAYS} jours.`, 429);
    }

    if (!rating || rating < 1 || rating > 5) {
      throw new AppError('La note doit être entre 1 et 5.', 400);
    }

    const [result] = await pool.execute(
      `INSERT INTO user_feedback (user_id, source, rating, category, comment, suggestions)
       VALUES (?, 'vendor_dashboard', ?, ?, ?, ?)`,
      [userId, rating, category || 'Satisfaction', comment || null, suggestions || null]
    );

    // Notifier l'admin
    await notificationService.createNotification(
      'new_feedback',
      'Nouvel avis vendeur',
      `Un vendeur a soumis un avis avec ${rating}/5 étoiles.`,
      result.insertId,
      'feedback'
    );

    return { success: true, id: result.insertId };
  }

  /**
   * Soumet un avis depuis le marketplace (visiteur)
   */
  async createMarketplaceFeedback(ip, { rating, category, comment, suggestions }) {
    const canSubmit = await this.canVisitorSubmitFeedback(ip);
    if (!canSubmit) {
      throw new AppError(`Vous avez déjà soumis un avis récemment. Attendez ${FEEDBACK_COOLDOWN_DAYS} jours.`, 429);
    }

    if (!rating || rating < 1 || rating > 5) {
      throw new AppError('La note doit être entre 1 et 5.', 400);
    }

    const [result] = await pool.execute(
      `INSERT INTO user_feedback (visitor_ip, source, rating, category, comment, suggestions)
       VALUES (?, 'marketplace', ?, ?, ?, ?)`,
      [ip, rating, category || 'Satisfaction', comment || null, suggestions || null]
    );

    await notificationService.createNotification(
      'new_feedback',
      'Nouvel avis marketplace',
      `Un visiteur a soumis un avis avec ${rating}/5 étoiles.`,
      result.insertId,
      'feedback'
    );

    return { success: true, id: result.insertId };
  }

  /**
   * Liste tous les avis (admin) avec filtres
   */
  async getAllFeedback({ page = 1, limit = 20, rating = null, source = null, processed = null, dateFrom = null, dateTo = null } = {}) {
    const offset = (page - 1) * limit;
    let conditions = ['1=1'];
    let params = [];

    if (rating) { conditions.push('uf.rating = ?'); params.push(parseInt(rating)); }
    if (source) { conditions.push('uf.source = ?'); params.push(source); }
    if (processed === 'true' || processed === true) { conditions.push('uf.is_processed = TRUE'); }
    if (processed === 'false' || processed === false) { conditions.push('uf.is_processed = FALSE'); }
    if (dateFrom) { conditions.push('uf.created_at >= ?'); params.push(dateFrom); }
    if (dateTo) { conditions.push('uf.created_at <= ?'); params.push(dateTo + ' 23:59:59'); }

    const where = conditions.join(' AND ');

    const [feedback] = await pool.execute(
      `SELECT uf.*, u.business_name, u.email
       FROM user_feedback uf
       LEFT JOIN users u ON uf.user_id = u.id
       WHERE ${where}
       ORDER BY uf.created_at DESC
       LIMIT ${limit} OFFSET ${offset}`,
      params
    );

    const [countResult] = await pool.execute(
      `SELECT COUNT(*) as total FROM user_feedback uf WHERE ${where}`,
      params
    );

    // Statistiques globales
    const [stats] = await pool.execute(
      `SELECT
         AVG(rating) as avg_rating,
         COUNT(*) as total_count,
         SUM(CASE WHEN rating = 5 THEN 1 ELSE 0 END) as five_stars,
         SUM(CASE WHEN rating = 4 THEN 1 ELSE 0 END) as four_stars,
         SUM(CASE WHEN rating = 3 THEN 1 ELSE 0 END) as three_stars,
         SUM(CASE WHEN rating = 2 THEN 1 ELSE 0 END) as two_stars,
         SUM(CASE WHEN rating = 1 THEN 1 ELSE 0 END) as one_star
       FROM user_feedback`
    );

    return {
      feedback,
      stats: stats[0],
      pagination: { page, limit, total: countResult[0].total }
    };
  }

  /**
   * Marque un avis comme traité (admin)
   */
  async markAsProcessed(feedbackId, adminId) {
    const [result] = await pool.execute(
      `UPDATE user_feedback
       SET is_processed = TRUE, processed_at = NOW(), processed_by = ?
       WHERE id = ?`,
      [adminId, feedbackId]
    );

    if (result.affectedRows === 0) {
      throw new AppError('Avis introuvable.', 404);
    }

    return { success: true };
  }
}

module.exports = new FeedbackService();
